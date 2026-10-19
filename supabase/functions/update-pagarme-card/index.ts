import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  STATUS_COM_FATURA_EM_ABERTO,
  type ResultadoCobranca,
  cobrarFaturaEmAberto,
  consultarAssinatura,
} from "./cobrarFaturaEmAberto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAGARME_API = "https://api.pagar.me/core/v5";

const log = (s: string, d?: unknown) =>
  console.log(`[UPDATE-PAGARME-CARD] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

const extractGatewayMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const errors = (payload as Record<string, unknown>).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0] as Record<string, unknown>;
    if (typeof first?.message === "string") return first.message;
  }
  const message = (payload as Record<string, unknown>).message;
  if (typeof message === "string") return message;
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } =
      await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id as string;

    const { card_token } = (await req.json()) as { card_token?: string };
    if (!card_token) {
      return new Response(
        JSON.stringify({ error: "card_token é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: assinatura } = await supabaseAdmin
      .from("assinaturas")
      .select("id, pagarme_subscription_id, pagarme_customer_id, payment_method, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (!assinatura?.pagarme_subscription_id || !assinatura?.pagarme_customer_id) {
      return new Response(
        JSON.stringify({ error: "Sua assinatura não é cobrada no cartão, então não há cartão para trocar." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Só assinatura recorrente no cartão: com PIX o pagarme_subscription_id pode ser
    // de uma assinatura de cartão antiga, e o PATCH voltaria a cobrar por ela.
    if (assinatura.payment_method !== "credit_card") {
      return new Response(
        JSON.stringify({ error: "Sua assinatura é paga por PIX, então não há cartão para trocar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pagarmeKey = Deno.env.get("PAGARME_SECRET_KEY");
    if (!pagarmeKey) throw new Error("PAGARME_SECRET_KEY não configurada.");
    const pagarmeAuth = `Basic ${btoa(`${pagarmeKey}:`)}`;

    // Fatura em aberto (past_due/unpaid): antes de mexer em qualquer coisa, confere se
    // a assinatura ainda existe na Pagar.me. Cancelada lá = trocar cartão não adianta.
    const temFaturaEmAberto = STATUS_COM_FATURA_EM_ABERTO.includes(assinatura.status ?? "");
    if (temFaturaEmAberto) {
      const consulta = await consultarAssinatura(assinatura.pagarme_subscription_id, { pagarmeAuth, log });
      if ("erro" in consulta) {
        log("Erro ao consultar assinatura", { erro: consulta.erro });
        throw new Error("Não foi possível consultar sua assinatura na Pagar.me. Tente novamente em instantes.");
      }
      if (consulta.cancelada) {
        log("Assinatura cancelada na Pagar.me", { subscriptionId: assinatura.pagarme_subscription_id });
        return new Response(
          JSON.stringify({
            success: false,
            cobranca: "assinatura_cancelada",
            mensagem: "Sua assinatura foi cancelada na operadora de pagamento depois das cobranças recusadas. Para voltar a ter acesso, assine um plano novamente.",
            status_assinatura: assinatura.status,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 1. Cria o novo cartão no customer a partir do token
    log("Criando novo cartão", {
      customerId: assinatura.pagarme_customer_id,
    });
    const cardRes = await fetch(
      `${PAGARME_API}/customers/${assinatura.pagarme_customer_id}/cards`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: pagarmeAuth,
        },
        body: JSON.stringify({ token: card_token }),
      }
    );
    const cardData = await cardRes.json();
    if (!cardRes.ok) {
      log("Erro ao criar cartão", { status: cardRes.status, erro: extractGatewayMessage(cardData) });
      throw new Error(
        extractGatewayMessage(cardData) || "Falha ao salvar novo cartão."
      );
    }
    const newCardId = cardData.id as string;

    // 2. Atualiza a subscription para usar o novo cartão
    log("Atualizando card_id na subscription", { newCardId });
    const subRes = await fetch(
      `${PAGARME_API}/subscriptions/${assinatura.pagarme_subscription_id}/card`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: pagarmeAuth,
        },
        body: JSON.stringify({ card_id: newCardId }),
      }
    );
    const subData = await subRes.json();
    if (!subRes.ok) {
      log("Erro ao atualizar subscription", { status: subRes.status, erro: extractGatewayMessage(subData) });
      throw new Error(
        extractGatewayMessage(subData) ||
          "Falha ao vincular novo cartão à assinatura."
      );
    }

    // 3. Atualiza o registro local
    await supabaseAdmin
      .from("assinaturas")
      .update({
        pagarme_card_id: newCardId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assinatura.id);

    log("Cartão atualizado com sucesso");

    // 4. Fatura em aberto: coloca o cartão novo na cobrança que falhou e retenta.
    // A liberação do acesso continua sendo do webhook (charge.paid confirmado na API).
    const resultado: ResultadoCobranca = temFaturaEmAberto
      ? await cobrarFaturaEmAberto(assinatura.pagarme_subscription_id, newCardId, { pagarmeAuth, log })
      : { cobranca: "nao_necessaria" };
    log("Resultado da cobrança", resultado);

    return new Response(
      JSON.stringify({
        success: true,
        card_id: newCardId,
        last_four_digits: cardData.last_four_digits,
        brand: cardData.brand,
        status_assinatura: assinatura.status,
        ...resultado,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});