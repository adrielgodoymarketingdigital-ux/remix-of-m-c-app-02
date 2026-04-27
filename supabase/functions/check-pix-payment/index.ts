import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { PLANO_NOMES, type PlanoTipoPago } from "../_shared/planos-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAGARME_API = "https://api.pagar.me/core/v5";

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-PIX-PAYMENT] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Autenticação ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // ── 2. Validar body ──────────────────────────────────────────────
    const body = await req.json();
    const { order_id } = body as { order_id?: string };

    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Buscar registro local ─────────────────────────────────────
    const { data: pagamento, error: fetchError } = await supabaseAdmin
      .from("pagamentos_pix")
      .select("*")
      .eq("pagarme_order_id", order_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);

    if (!pagamento) {
      return new Response(
        JSON.stringify({ status: "not_found", paid: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se já está pago no banco, retorna direto
    if (pagamento.status === "paid") {
      log("Já pago no banco", { order_id });
      return new Response(
        JSON.stringify({ status: "paid", paid: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Consultar Pagar.me diretamente ────────────────────────────
    const pagarmeKey = Deno.env.get("PAGARME_SECRET_KEY");
    if (!pagarmeKey) throw new Error("PAGARME_SECRET_KEY não configurada.");

    const pagarmeAuth = btoa(`${pagarmeKey}:`);

    log("Consultando Pagar.me", { order_id });

    const pagarmeRes = await fetch(`${PAGARME_API}/orders/${order_id}`, {
      headers: { Authorization: `Basic ${pagarmeAuth}` },
    });

    if (!pagarmeRes.ok) {
      log("Erro ao consultar Pagar.me", { status: pagarmeRes.status });
      return new Response(
        JSON.stringify({ status: "pending", paid: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const order = await pagarmeRes.json();
    log("Status na Pagar.me", { order_id, status: order.status });

    const isPaid = order.status === "paid";

    if (!isPaid) {
      return new Response(
        JSON.stringify({ status: order.status, paid: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 5. Pago! Atualizar banco e ativar assinatura ─────────────────
    const charge = order.charges?.[0];
    const paidAt = charge?.paid_at || order.closed_at || new Date().toISOString();

    // Atualizar pagamentos_pix
    await supabaseAdmin
      .from("pagamentos_pix")
      .update({
        status: "paid",
        paid_at: paidAt,
        pagarme_charge_id: charge?.id ?? pagamento.pagarme_charge_id,
        pagarme_transaction_id:
          charge?.last_transaction?.id ?? pagamento.pagarme_transaction_id,
      })
      .eq("id", pagamento.id);

    log("pagamentos_pix atualizado para paid", { id: pagamento.id });

    // Ativar assinatura
    const planoTipo = pagamento.plano_tipo as string;
    const isAnual = planoTipo.includes("anual");
    const dataInicio = new Date().toISOString();
    const dataFim = new Date(
      Date.now() + (isAnual ? 365 : 30) * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: assinaturaExistente } = await supabaseAdmin
      .from("assinaturas")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (assinaturaExistente) {
      await supabaseAdmin
        .from("assinaturas")
        .update({
          plano_tipo: planoTipo,
          status: "active",
          data_inicio: dataInicio,
          data_fim: dataFim,
          data_proxima_cobranca: dataFim,
          payment_provider: "pagarme",
          payment_method: "pix",
          updated_at: dataInicio,
          bloqueado_admin: false,
          bloqueado_admin_em: null,
          bloqueado_admin_motivo: null,
          bloqueado_tipo: null,
        })
        .eq("user_id", userId);
      log("Assinatura atualizada", { userId, planoTipo });
    } else {
      await supabaseAdmin
        .from("assinaturas")
        .insert({
          user_id: userId,
          plano_tipo: planoTipo,
          status: "active",
          data_inicio: dataInicio,
          data_fim: dataFim,
          data_proxima_cobranca: dataFim,
          payment_provider: "pagarme",
          payment_method: "pix",
        });
      log("Assinatura criada", { userId, planoTipo });
    }

    // Notificação admin
    await supabaseAdmin.from("admin_notifications").insert({
      tipo: "nova_assinatura_pix",
      titulo: "Nova assinatura via PIX!",
      mensagem: `Pagamento PIX confirmado para plano ${planoTipo} (verificação manual)`,
      dados: {
        user_id: userId,
        plano_tipo: planoTipo,
        pagarme_order_id: order_id,
        valor_centavos: pagamento.valor_centavos,
      },
    });

    // Dispatch push admin
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const valorBRL = (pagamento.valor_centavos / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
      });
      await fetch(`${supabaseUrl}/functions/v1/dispatch-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          event_type: "SUBSCRIPTION_CREATED",
          payload: {
            user_id: userId,
            valor: valorBRL,
            plano_nome: PLANO_NOMES[planoTipo as PlanoTipoPago] || planoTipo,
            payment_method: "pix",
          },
        }),
      });
    } catch (err) {
      log("Erro ao disparar push admin", { error: String(err) });
    }

    log("✅ Pagamento PIX confirmado e assinatura ativada", { userId, planoTipo });

    return new Response(
      JSON.stringify({ status: "paid", paid: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
