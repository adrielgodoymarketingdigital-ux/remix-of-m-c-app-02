import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  PRECOS_CENTAVOS,
  PLANO_NOMES,
  PAGARME_PLAN_IDS,
  type PlanoTipoPago,
} from "../_shared/planos-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAGARME_API = "https://api.pagar.me/core/v5";

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-PAGARME-SUBSCRIPTION] ${step}${d}`);
};

const VALID_PLANS = Object.keys(PRECOS_CENTAVOS) as PlanoTipoPago[];

const sanitizeDigits = (value?: string | null) =>
  value?.replace(/\D/g, "") ?? "";

const isValidCPF = (cpf: string) => {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
};

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
    const userEmail = userData.user.email as string;
    if (!userId || !userEmail) throw new Error("Usuário não autenticado.");
    log("Usuário autenticado", { userId });

    // ── 2. Validar body ──────────────────────────────────────────────
    const body = await req.json();
    const { plan_code, card_token, cpf, holder_name } = body as {
      plan_code?: string;
      card_token?: string;
      cpf?: string;
      holder_name?: string;
    };

    if (!plan_code || !VALID_PLANS.includes(plan_code as PlanoTipoPago)) {
      return new Response(
        JSON.stringify({
          error: `plan_code inválido. Aceitos: ${VALID_PLANS.join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!card_token || typeof card_token !== "string") {
      return new Response(
        JSON.stringify({ error: "card_token é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cpfDigits = sanitizeDigits(cpf);
    if (!isValidCPF(cpfDigits)) {
      return new Response(
        JSON.stringify({ error: "Informe um CPF válido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plano = plan_code as PlanoTipoPago;
    const pagarmePlanId = PAGARME_PLAN_IDS[plano];
    const displayName = PLANO_NOMES[plano];
    const valorCentavos = PRECOS_CENTAVOS[plano];
    log("Plano validado", { plano, pagarmePlanId, valorCentavos });

    // ── 3. Chave Pagar.me ────────────────────────────────────────────
    const pagarmeKey = Deno.env.get("PAGARME_SECRET_KEY");
    if (!pagarmeKey) throw new Error("PAGARME_SECRET_KEY não configurada.");
    const pagarmeAuth = `Basic ${btoa(`${pagarmeKey}:`)}`;

    // ── 4. Buscar perfil ─────────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("nome, celular")
      .eq("user_id", userId)
      .maybeSingle();

    const customerName =
      (holder_name || profile?.nome || userEmail.split("@")[0]).trim();
    const rawPhone = sanitizeDigits(profile?.celular);
    const customerPhone = rawPhone.length >= 10 ? rawPhone : "11999999999";

    // ── 5. Reaproveitar/criar customer ───────────────────────────────
    const { data: existing } = await supabaseAdmin
      .from("assinaturas")
      .select("pagarme_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    let customerId: string | null = existing?.pagarme_customer_id ?? null;

    if (!customerId) {
      log("Criando customer na Pagar.me");
      const customerRes = await fetch(`${PAGARME_API}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: pagarmeAuth,
        },
        body: JSON.stringify({
          name: customerName,
          email: userEmail,
          type: "individual",
          document: cpfDigits,
          document_type: "cpf",
          phones: {
            mobile_phone: {
              country_code: "55",
              area_code: customerPhone.substring(0, 2),
              number: customerPhone.substring(2),
            },
          },
          metadata: { user_id: userId },
        }),
      });
      const customerData = await customerRes.json();
      if (!customerRes.ok) {
        log("Erro ao criar customer", { body: customerData });
        throw new Error(
          extractGatewayMessage(customerData) ||
            "Falha ao criar cliente na Pagar.me."
        );
      }
      customerId = customerData.id as string;
      log("Customer criado", { customerId });
    } else {
      log("Customer existente reaproveitado", { customerId });
    }

    // ── 6. Criar subscription ────────────────────────────────────────
    const subscriptionPayload = {
      plan_id: pagarmePlanId,
      customer_id: customerId,
      payment_method: "credit_card",
      card_token,
      // Salva o cartão para próximas cobranças
      // (o Pagar.me cria automaticamente o card a partir do token)
      metadata: {
        user_id: userId,
        plano_tipo: plano,
      },
    };

    log("Criando subscription na Pagar.me");
    const subRes = await fetch(`${PAGARME_API}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: pagarmeAuth,
      },
      body: JSON.stringify(subscriptionPayload),
    });
    const subData = await subRes.json();

    if (!subRes.ok) {
      log("Erro ao criar subscription", {
        status: subRes.status,
        body: subData,
      });
      throw new Error(
        extractGatewayMessage(subData) ||
          "Falha ao criar assinatura na Pagar.me."
      );
    }

    log("Subscription criada", {
      subscriptionId: subData.id,
      status: subData.status,
    });

    // ── 7. Verificar status da primeira cobrança ─────────────────────
    const currentCharge = subData.current_charge ?? subData.charges?.[0];
    const chargeStatus = currentCharge?.status;
    const lastTransaction = currentCharge?.last_transaction;
    const cardId =
      lastTransaction?.card?.id ??
      currentCharge?.card?.id ??
      null;

    const paymentApproved =
      subData.status === "active" ||
      chargeStatus === "paid" ||
      chargeStatus === "captured";

    if (
      chargeStatus === "failed" ||
      lastTransaction?.status === "not_authorized" ||
      lastTransaction?.status === "refused"
    ) {
      const reason =
        extractGatewayMessage(lastTransaction?.gateway_response) ||
        lastTransaction?.acquirer_message ||
        "Cartão recusado pela operadora.";
      log("Cobrança recusada", { reason });
      throw new Error(`Pagamento recusado: ${reason}`);
    }

    // ── 8. Atualizar/criar registro em assinaturas ───────────────────
    const isAnual = plano.includes("anual");
    const dataInicio = new Date().toISOString();
    const dataFim = new Date(
      Date.now() + (isAnual ? 365 : 30) * 24 * 60 * 60 * 1000
    ).toISOString();

    const baseData = {
      plano_tipo: plano,
      status: paymentApproved ? "active" : "pending",
      data_inicio: dataInicio,
      data_fim: dataFim,
      data_proxima_cobranca: dataFim,
      payment_provider: "pagarme",
      payment_method: "credit_card",
      pagarme_customer_id: customerId,
      pagarme_subscription_id: subData.id,
      pagarme_card_id: cardId,
      updated_at: dataInicio,
    };

    const { data: assinaturaExistente } = await supabaseAdmin
      .from("assinaturas")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (assinaturaExistente) {
      await supabaseAdmin
        .from("assinaturas")
        .update(baseData)
        .eq("user_id", userId);

      // Remover bloqueio "ate_assinar"
      await supabaseAdmin
        .from("assinaturas")
        .update({
          bloqueado_admin: false,
          bloqueado_admin_em: null,
          bloqueado_admin_motivo: null,
          bloqueado_tipo: null,
        })
        .eq("user_id", userId)
        .eq("bloqueado_tipo", "ate_assinar");

      log("Assinatura atualizada", { userId });
    } else {
      await supabaseAdmin
        .from("assinaturas")
        .insert({ user_id: userId, ...baseData });
      log("Assinatura criada", { userId });
    }

    // ── 9. Notificação admin (se aprovada) ───────────────────────────
    if (paymentApproved) {
      await supabaseAdmin.from("admin_notifications").insert({
        tipo: "nova_assinatura_cartao",
        titulo: "Nova assinatura via Cartão!",
        mensagem: `Pagamento aprovado para plano ${displayName}`,
        dados: {
          user_id: userId,
          plano_tipo: plano,
          pagarme_subscription_id: subData.id,
          valor_centavos: valorCentavos,
        },
      });
    }

    return new Response(
      JSON.stringify({
        subscription_id: subData.id,
        customer_id: customerId,
        status: subData.status,
        approved: paymentApproved,
        plan: {
          code: plano,
          name: displayName,
          amount_cents: valorCentavos,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { message: msg });
    const status =
      msg.includes("recusado") ||
      msg.includes("CPF válido") ||
      msg.includes("plan_code") ||
      msg.includes("card_token")
        ? 400
        : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});