import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { PLANOS_PAGOS } from "./cobrarFaturaEmAberto.ts";
import { fimDoPeriodoPago, planoParaRestaurar, trocarCartao } from "./trocarCartao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[UPDATE-PAGARME-CARD] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } =
      await supabaseClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id as string;

    const { card_token } = (await req.json()) as { card_token?: string };
    if (!card_token) return json({ error: "card_token é obrigatório." }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: assinatura } = await supabaseAdmin
      .from("assinaturas")
      .select("id, pagarme_subscription_id, pagarme_customer_id, payment_method, status, plano_tipo, data_fim")
      .eq("user_id", userId)
      .maybeSingle();

    if (!assinatura?.pagarme_subscription_id || !assinatura?.pagarme_customer_id) {
      return json({ error: "Sua assinatura não é cobrada no cartão, então não há cartão para trocar." }, 404);
    }

    // Só assinatura recorrente no cartão: com PIX o pagarme_subscription_id pode ser
    // de uma assinatura de cartão antiga, e o PATCH voltaria a cobrar por ela.
    if (assinatura.payment_method !== "credit_card") {
      return json({ error: "Sua assinatura é paga por PIX, então não há cartão para trocar." }, 400);
    }

    const pagarmeKey = Deno.env.get("PAGARME_SECRET_KEY");
    if (!pagarmeKey) throw new Error("PAGARME_SECRET_KEY não configurada.");
    const pagarmeAuth = `Basic ${btoa(`${pagarmeKey}:`)}`;

    // Plano pago conhecido, para "assinar de novo" e para restaurar depois de uma cobrança
    // paga: o plano local se for pago; senão (ex.: virou Free ao fim de uma liberação)
    // o anterior à liberação. Buscado ANTES: sem plano conhecido, trocarCartao não cobra.
    let planoSugerido: string | null = null;
    if (PLANOS_PAGOS.includes(assinatura.plano_tipo ?? "")) {
      planoSugerido = assinatura.plano_tipo;
    } else {
      const { data: lib } = await supabaseAdmin
        .from("liberacoes_temporarias")
        .select("plano_anterior")
        .eq("user_id", userId)
        .order("concedido_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (PLANOS_PAGOS.includes(lib?.plano_anterior ?? "")) planoSugerido = lib!.plano_anterior;
    }

    const resposta = await trocarCartao(
      {
        plano_tipo: assinatura.plano_tipo,
        status: assinatura.status,
        data_fim: assinatura.data_fim,
        pagarme_subscription_id: assinatura.pagarme_subscription_id,
        pagarme_customer_id: assinatura.pagarme_customer_id,
      },
      card_token,
      new Date(),
      { pagarmeAuth, log },
      planoSugerido,
    );

    if (resposta.trocou) {
      const agora = new Date();
      const atualizacao: Record<string, unknown> = { pagarme_card_id: resposta.cardId, updated_at: agora.toISOString() };

      // Cobrança paga (confirmada pela API da Pagar.me) numa conta Free com assinatura
      // viva: o webhook não volta o plano, então ele é restaurado aqui. O período segue
      // a regra do webhook; o webhook do charge.paid confirma depois, como sempre.
      const plano = planoParaRestaurar(assinatura.plano_tipo, resposta.corpo, resposta.planoPagarme, planoSugerido);
      if (plano) {
        const fim = fimDoPeriodoPago(agora, plano).toISOString();
        Object.assign(atualizacao, { plano_tipo: plano, status: "active", data_fim: fim, data_proxima_cobranca: fim });
        log("Plano restaurado após cobrança paga", { de: assinatura.plano_tipo, para: plano, data_fim: fim });
      }

      // .eq no plano lido: se outro processo mudou o plano no meio, não sobrescreve.
      await supabaseAdmin
        .from("assinaturas")
        .update(atualizacao)
        .eq("id", assinatura.id)
        .eq("plano_tipo", assinatura.plano_tipo);
      log("Cartão atualizado", { cobranca: resposta.corpo.cobranca });
    }

    const acessoValido = resposta.trocou && resposta.corpo.acesso_pago_valido;
    return json({ ...resposta.corpo, plano_sugerido: acessoValido ? null : planoSugerido });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { msg });
    return json({ error: msg }, 500);
  }
});
