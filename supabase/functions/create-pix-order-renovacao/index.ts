import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  PRECOS_CENTAVOS,
  PLANO_NOMES,
  type PlanoTipoPago,
} from "../_shared/planos-config.ts";
import { corsHeaders } from "../_shared/cors.ts";

// URL do n8n para notificações
const N8N_WEBHOOK_RENOVACAO = "https://n8n.appmec.in/webhook/renovacao-pix";

const PAGARME_API = "https://api.pagar.me/core/v5";
const PIX_EXPIRATION_SECONDS = 3600;

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PIX-RENOVACAO] ${step}${d}`);
};

const sanitizeDigits = (value?: string | null) => value?.replace(/\D/g, "") ?? "";

const isValidCPF = (cpf: string) => {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
};

const VALID_PLANS = Object.keys(PRECOS_CENTAVOS) as PlanoTipoPago[];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, plan_code, cpf } = body as {
      user_id?: string;
      plan_code?: string;
      cpf?: string;
    };

    if (!user_id || !plan_code || !cpf) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios: user_id, plan_code, cpf." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!VALID_PLANS.includes(plan_code as PlanoTipoPago)) {
      return new Response(
        JSON.stringify({ error: `plan_code inválido. Valores aceitos: ${VALID_PLANS.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cpfDigits = sanitizeDigits(cpf);
    if (!isValidCPF(cpfDigits)) {
      return new Response(
        JSON.stringify({ error: "Informe um CPF válido para gerar o PIX." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plano = plan_code as PlanoTipoPago;
    const amount = PRECOS_CENTAVOS[plano];
    const displayName = PLANO_NOMES[plano];

    const pagarmeKey = Deno.env.get("PAGARME_SECRET_KEY");
    if (!pagarmeKey) throw new Error("PAGARME_SECRET_KEY não configurada.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Buscar dados do usuário
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nome, email, celular")
      .eq("user_id", user_id)
      .maybeSingle();

    // Buscar email em auth.users como fallback
    let userEmail = profile?.email ?? null;
    if (!userEmail) {
      const searchRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/auth/v1/admin/users?filter=${encodeURIComponent(user_id)}&page=1&per_page=1`,
        {
          headers: {
            "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
          },
        }
      );
      const searchData = await searchRes.json();
      userEmail = searchData?.users?.[0]?.email ?? null;
    }

    const customerName = profile?.nome || (userEmail?.split("@")[0] ?? "Cliente");
    const rawPhone = sanitizeDigits(profile?.celular);
    const customerPhone = rawPhone.length >= 10 ? rawPhone : "11999999999";

    log("Criando PIX renovação", { user_id, plano, amount });

    // Criar order PIX na Pagar.me
    const pagarmeAuth = btoa(`${pagarmeKey}:`);
    const orderPayload = {
      items: [{ amount, description: `Renovação ${displayName}`, quantity: 1 }],
      customer: {
        name: customerName,
        email: userEmail ?? `${user_id}@appmec.in`,
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
      payments: [{ payment_method: "pix", pix: { expires_in: PIX_EXPIRATION_SECONDS } }],
      metadata: { user_id, plano_tipo: plano, origem: "renovacao" },
      closed: true,
    };

    const pagarmeRes = await fetch(`${PAGARME_API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${pagarmeAuth}` },
      body: JSON.stringify(orderPayload),
    });

    const pagarmeData = await pagarmeRes.json();

    if (!pagarmeRes.ok) {
      log("Erro Pagar.me", { status: pagarmeRes.status, body: pagarmeData });
      throw new Error(pagarmeData?.message ?? "Erro ao criar cobrança PIX.");
    }

    const charge = pagarmeData.charges?.[0];
    const lastTransaction = charge?.last_transaction;
    const qrCode = lastTransaction?.qr_code ?? null;
    const qrCodeUrl = lastTransaction?.qr_code_url ?? null;

    if (!qrCode) {
      throw new Error("QR Code PIX não foi gerado. Tente novamente.");
    }

    const pixExpiration = new Date(Date.now() + PIX_EXPIRATION_SECONDS * 1000).toISOString();

    // Salvar em pagamentos_pix
    await supabaseAdmin.from("pagamentos_pix").insert({
      user_id,
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

    log("PIX salvo", { orderId: pagarmeData.id });

    // Notificar n8n (fire-and-forget)
    fetch(N8N_WEBHOOK_RENOVACAO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id,
        email: userEmail ?? "",
        nome: profile?.nome ?? "",
        telefone: profile?.celular ?? "",
        valor: amount / 100,
        plano_tipo: plano,
        pagarme_order_id: pagarmeData.id,
      }),
    }).catch((err) => log("⚠️ Erro ao notificar n8n (não crítico)", { error: String(err) }));

    return new Response(
      JSON.stringify({
        order_id: pagarmeData.id,
        status: pagarmeData.status,
        qr_code: qrCode,
        qr_code_url: qrCodeUrl,
        pix_copy_paste: qrCode,
        expires_at: pixExpiration,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { message: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
