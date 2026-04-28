import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  PRECOS_CENTAVOS,
  PLANO_NOMES,
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
  console.log(`[CREATE-PIX-ORDER] ${step}${d}`);
};

const VALID_PLANS = Object.keys(PRECOS_CENTAVOS) as PlanoTipoPago[];

const sanitizeDigits = (value?: string | null) => value?.replace(/\D/g, "") ?? "";

const isValidCPF = (cpf: string) => {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(cpf[i]) * (10 - i);
  }

  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) {
    return false;
  }

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(cpf[i]) * (11 - i);
  }

  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;

  return digit === Number(cpf[10]);
};

const extractGatewayErrorMessage = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const gatewayResponse = (payload as Record<string, unknown>).gateway_response;
  if (!gatewayResponse || typeof gatewayResponse !== "object") {
    return null;
  }

  const errors = (gatewayResponse as Record<string, unknown>).errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return null;
  }

  const firstError = errors[0];
  if (
    firstError &&
    typeof firstError === "object" &&
    typeof (firstError as { message?: unknown }).message === "string"
  ) {
    return (firstError as { message: string }).message;
  }

  return null;
};

const buildPixFailureMessage = (gatewayMessage?: string | null) => {
  if (gatewayMessage?.includes("action_forbidden")) {
    return "O gateway recusou a geração do PIX. Confira se o PIX está habilitado na sua conta e use um CPF válido do pagador.";
  }

  if (gatewayMessage) {
    return `Não foi possível gerar o PIX: ${gatewayMessage}`;
  }

  return "QR Code PIX não foi gerado. Tente novamente.";
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

    if (!userId || !userEmail) {
      throw new Error("Usuário não autenticado.");
    }
    log("Usuário autenticado", { userId });

    // ── 2. Validar body ──────────────────────────────────────────────
    const body = await req.json();
    const { plan_code, cpf } = body as { plan_code?: string; cpf?: string };

    if (!plan_code || !VALID_PLANS.includes(plan_code as PlanoTipoPago)) {
      log("plan_code inválido", { plan_code });
      return new Response(
        JSON.stringify({
          error: `plan_code inválido. Valores aceitos: ${VALID_PLANS.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cpfDigits = sanitizeDigits(cpf);
    if (!isValidCPF(cpfDigits)) {
      return new Response(
        JSON.stringify({ error: "Informe um CPF válido para gerar o PIX." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const plano = plan_code as PlanoTipoPago;
    const fullAmount = PRECOS_CENTAVOS[plano];
    const displayName = PLANO_NOMES[plano];
    log("Plano validado", { plano, fullAmount, displayName });

    // ── 2b. Verificar upgrade (pro-rata) ─────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let amount = fullAmount;
    let isUpgrade = false;
    let creditAmount = 0;
    let currentPlanLabel = "";

    const { data: currentSub } = await supabaseAdmin
      .from("assinaturas")
      .select("plano_tipo, status, data_inicio, data_fim")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle();

    if (currentSub && currentSub.plano_tipo && currentSub.data_fim) {
      const currentPlano = currentSub.plano_tipo as string;
      const currentPrice = PRECOS_CENTAVOS[currentPlano as PlanoTipoPago] ?? 0;

      // Só calcular pro-rata se o plano atual é pago e o novo é mais caro
      if (currentPrice > 0 && fullAmount > currentPrice) {
        const dataFim = new Date(currentSub.data_fim).getTime();
        const dataInicio = new Date(currentSub.data_inicio ?? currentSub.data_fim).getTime();
        const now = Date.now();

        const totalDays = Math.max((dataFim - dataInicio) / (1000 * 60 * 60 * 24), 1);
        const remainingDays = Math.max((dataFim - now) / (1000 * 60 * 60 * 24), 0);

        if (remainingDays > 0) {
          creditAmount = Math.round((remainingDays / totalDays) * currentPrice);
          const diff = fullAmount - creditAmount;
          // Mínimo de R$1,00 (100 centavos) para a Pagar.me processar
          amount = Math.max(diff, 100);
          isUpgrade = true;
          currentPlanLabel = PLANO_NOMES[currentPlano as PlanoTipoPago] ?? currentPlano;

          log("🔄 Upgrade detectado (pro-rata)", {
            currentPlano,
            currentPrice,
            totalDays: Math.round(totalDays),
            remainingDays: Math.round(remainingDays * 10) / 10,
            creditAmount,
            originalAmount: fullAmount,
            adjustedAmount: amount,
          });
        }
      }
    }

    // ── 3. Chave Pagar.me ────────────────────────────────────────────
    const pagarmeKey = Deno.env.get("PAGARME_SECRET_KEY");
    if (!pagarmeKey) {
      throw new Error("PAGARME_SECRET_KEY não configurada.");
    }

    // ── 4. Buscar nome do perfil (opcional) ──────────────────────────
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("nome, celular")
      .eq("user_id", userId)
      .maybeSingle();

    const customerName = profile?.nome || userEmail.split("@")[0];
    const rawPhone = sanitizeDigits(profile?.celular);
    const customerPhone = rawPhone.length >= 10 ? rawPhone : "11999999999";

    log("Dados do cliente", {
      customerName,
      phoneLength: rawPhone.length,
      usingFallback: rawPhone.length < 10,
      cpfProvided: true,
    });

    // ── 5. Criar pedido PIX na Pagar.me ──────────────────────────────
    const PIX_EXPIRATION_SECONDS = 3600; // 1 hora

    const orderPayload = {
      items: [
        {
          amount,
          description: isUpgrade
            ? `Upgrade ${currentPlanLabel} → ${displayName} (pro-rata)`
            : `Assinatura ${displayName}`,
          quantity: 1,
        },
      ],
      customer: {
        name: customerName,
        email: userEmail,
        type: "individual",
        document: cpfDigits,
        phones: {
          mobile_phone: {
            country_code: "55",
            area_code: customerPhone.substring(0, 2),
            number: customerPhone.substring(2),
          },
        },
      },
      payments: [
        {
          payment_method: "pix",
          pix: {
            expires_in: PIX_EXPIRATION_SECONDS,
          },
        },
      ],
      metadata: {
        user_id: userId,
        plano_tipo: plano,
      },
      closed: true,
    };

    log("Enviando pedido à Pagar.me");

    const pagarmeAuth = btoa(`${pagarmeKey}:`);

    const pagarmeRes = await fetch(`${PAGARME_API}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${pagarmeAuth}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const pagarmeData = await pagarmeRes.json();
    const initialGatewayMessage = extractGatewayErrorMessage(
      pagarmeData?.charges?.[0]?.last_transaction
    );

    if (!pagarmeRes.ok) {
      log("Erro Pagar.me", { status: pagarmeRes.status, body: pagarmeData });
      throw new Error(
        buildPixFailureMessage(
          initialGatewayMessage ||
            pagarmeData?.message ||
            JSON.stringify(pagarmeData)
        )
      );
    }

    log("Pedido Pagar.me criado", {
      orderId: pagarmeData.id,
      status: pagarmeData.status,
    });

    // ── 6. Extrair dados do QR Code ──────────────────────────────────
    const charge = pagarmeData.charges?.[0];
    const lastTransaction = charge?.last_transaction;
    const gatewayMessage = extractGatewayErrorMessage(lastTransaction);

    if (
      pagarmeData.status === "failed" ||
      charge?.status === "failed" ||
      lastTransaction?.status === "failed"
    ) {
      log("Transação PIX falhou no gateway", {
        orderId: pagarmeData.id,
        orderStatus: pagarmeData.status,
        chargeStatus: charge?.status,
        transactionStatus: lastTransaction?.status,
        gatewayMessage,
      });
      throw new Error(buildPixFailureMessage(gatewayMessage));
    }

    const qrCode = lastTransaction?.qr_code ?? null;
    const qrCodeUrl = lastTransaction?.qr_code_url ?? null;
    const pixCopyPaste = lastTransaction?.qr_code ?? qrCode;

    if (!qrCode) {
      log("QR Code não retornado pela Pagar.me", { charge, gatewayMessage });
      throw new Error(buildPixFailureMessage(gatewayMessage));
    }

    // ── 7. Salvar na tabela pagamentos_pix ────────────────────────────
    // supabaseAdmin já criado no passo 2b

    const pixExpiration = new Date(
      Date.now() + PIX_EXPIRATION_SECONDS * 1000
    ).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("pagamentos_pix")
      .insert({
        user_id: userId,
        plano_tipo: plano,
        valor_centavos: amount,
        status: "pending",
        pagarme_order_id: pagarmeData.id,
        pagarme_charge_id: charge?.id ?? null,
        pagarme_transaction_id: lastTransaction?.id ?? null,
        pix_qr_code: qrCode,
        pix_qr_code_url: qrCodeUrl,
        pix_expiration: pixExpiration,
      });

    if (insertError) {
      log("Erro ao salvar pagamento", { error: insertError.message });
    } else {
      log("Pagamento PIX salvo no banco");
    }

    // ── 8. Retornar resposta ──────────────────────────────────────────
    const responseBody: Record<string, unknown> = {
      order_id: pagarmeData.id,
      status: pagarmeData.status,
      qr_code: qrCode,
      qr_code_url: qrCodeUrl,
      pix_copy_paste: pixCopyPaste,
      expires_at: pixExpiration,
      plan: {
        code: plano,
        name: displayName,
        amount_cents: amount,
      },
    };

    if (isUpgrade) {
      responseBody.is_upgrade = true;
      responseBody.original_amount_cents = fullAmount;
      responseBody.credit_amount_cents = creditAmount;
      responseBody.upgrade_from = currentPlanLabel;
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { message: msg });

    const status =
      msg.includes("CPF válido") ||
      msg.includes("gateway recusou") ||
      msg.includes("Não foi possível gerar o PIX")
        ? 400
        : 500;

    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});