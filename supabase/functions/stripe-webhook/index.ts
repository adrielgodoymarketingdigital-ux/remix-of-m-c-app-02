import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const META_PIXEL_ID = Deno.env.get("META_PIXEL_ID");

const stripe = new Stripe(STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

// Mapeamento dos Price IDs
const PRICE_TO_PLAN: Record<string, string> = {
  // Novos IDs (nova conta Stripe)
  price_1TCTqfFu8jWFILvSyfTI73ff: "basico_mensal",
  price_1TCTrRFu8jWFILvSl50ZKqpy: "intermediario_mensal",
  price_1TCTrnFu8jWFILvS4hBfmUiz: "profissional_mensal",
  price_1TCTszFu8jWFILvSLajvpW8A: "basico_anual",
  price_1TCTtTFu8jWFILvSwTuoRvm8: "intermediario_anual",
  price_1TCTtxFu8jWFILvSZgjoxpX6: "profissional_anual",
  // IDs legados (conta anterior - para usuários existentes)
  price_1SkxEACjA5c0MuV8VVfibyhD: "basico_mensal",
  price_1SkxLbCjA5c0MuV8M6rYpYd6: "intermediario_mensal",
  price_1SkxObCjA5c0MuV8G3OccySn: "profissional_mensal",
  price_1SkxQnCjA5c0MuV8J0F7vf5m: "basico_anual",
  price_1SkxRPCjA5c0MuV8cgcNtFsf: "intermediario_anual",
  price_1SkxSNCjA5c0MuV8yJ5ZLr7o: "profissional_anual",
  price_1SlDtpCjA5c0MuV8RAmPGdHb: "basico_mensal",
  price_1SlDxDCjA5c0MuV8eaynwHC5: "intermediario_mensal",
  price_1SSFGSCjA5c0MuV8tQE82qGs: "profissional_anual",
  price_1SSFE6CjA5c0MuV8wQcFYhHf: "intermediario_anual",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[${timestamp}] [STRIPE-WEBHOOK] ${step}${detailsStr}\n`);
};

// Helper function to hash email with SHA256
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Função para localizar assinaturas
async function findSubscriptionRecord(subscriptionId: string, customerId?: string) {
  logStep("🔍 Buscando assinatura", { subscriptionId, customerId });

  // Tentar por subscription ID primeiro
  if (subscriptionId) {
    const { data } = await supabaseAdmin
      .from("assinaturas")
      .select("id, user_id")
      .eq("stripe_subscription_id", subscriptionId)
      .single();

    if (data) {
      logStep("✅ Assinatura encontrada por subscription_id", { id: data.id });
      return data;
    }
  }

  // Tentar por customer ID
  if (customerId) {
    const { data: byCustomer } = await supabaseAdmin
      .from("assinaturas")
      .select("id, user_id")
      .eq("stripe_customer_id", customerId)
      .single();

    if (byCustomer) {
      logStep("✅ Assinatura encontrada por customer_id", { id: byCustomer.id });
      return byCustomer;
    }
  }

  return null;
}

// Função para buscar assinatura por email do customer
async function findSubscriptionByCustomerEmail(customerId: string) {
  logStep("🔍 Buscando assinatura por email do customer", { customerId });

  try {
    const customer = await stripe.customers.retrieve(customerId);
    
    if (customer.deleted || !("email" in customer) || !customer.email) {
      logStep("⚠️ Customer não tem email válido");
      return null;
    }

    const email = customer.email;
    logStep("📧 Email do customer encontrado", { email });

    // Buscar usuário pelo email
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users.users.find((u) => u.email === email);

    if (!user) {
      logStep("⚠️ Usuário não encontrado pelo email", { email });
      return null;
    }

    // Buscar assinatura pelo user_id
    const { data: subscription } = await supabaseAdmin
      .from("assinaturas")
      .select("id, user_id")
      .eq("user_id", user.id)
      .single();

    if (subscription) {
      logStep("✅ Assinatura encontrada pelo email", { id: subscription.id, userId: user.id });
      return subscription;
    }

    return null;
  } catch (err) {
    logStep("❌ Erro ao buscar por email", { error: String(err) });
    return null;
  }
}

// Helper para converter timestamp do Stripe de forma segura
function safeTimestampToISO(timestamp: number | null | undefined): string | null {
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
    return null;
  }
  try {
    const date = new Date(timestamp * 1000);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch {
    return null;
  }
}

// Send event to Meta Conversions API
async function sendMetaCapiEvent(
  eventName: string,
  eventId: string,
  email: string,
  metadata: Record<string, any>,
  customData: Record<string, any>
) {
  if (!META_ACCESS_TOKEN || !META_PIXEL_ID) {
    logStep("⚠️ Meta CAPI não configurado", { 
      hasToken: !!META_ACCESS_TOKEN, 
      hasPixelId: !!META_PIXEL_ID 
    });
    return;
  }

  try {
    const emailHash = await hashEmail(email);
    
    // Log detalhado dos dados do usuário
    logStep("📊 Meta CAPI - Dados do usuário", {
      emailHash: emailHash.substring(0, 10) + '...',
      fbp: metadata.fbp || "NÃO ENVIADO",
      fbc: metadata.fbc || "NÃO ENVIADO",
      client_ip: metadata.client_ip ? "PRESENTE" : "AUSENTE",
      client_user_agent: metadata.client_user_agent ? "PRESENTE" : "AUSENTE",
    });

    // Construir user_data removendo campos undefined/null
    const userData: Record<string, any> = {
      em: [emailHash],
    };
    
    if (metadata.fbp) userData.fbp = metadata.fbp;
    if (metadata.fbc) userData.fbc = metadata.fbc;
    if (metadata.client_ip) userData.client_ip_address = metadata.client_ip;
    if (metadata.client_user_agent) userData.client_user_agent = metadata.client_user_agent;

    const eventData = {
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: metadata.event_source_url || "https://appmec.in/obrigado",
        user_data: userData,
        custom_data: {
          value: customData.value,
          currency: customData.currency || "BRL",
          content_name: customData.content_name,
          content_category: "subscription",
          content_ids: customData.content_ids || [],
        },
      }],
    };

    logStep("📤 Enviando para Meta CAPI", { 
      eventName, 
      pixelId: META_PIXEL_ID,
      userDataKeys: Object.keys(userData),
    });

    const apiUrl = `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`;
    logStep("🌐 Meta CAPI URL", { url: apiUrl.replace(META_ACCESS_TOKEN!, "***TOKEN***") });
    
    const response = await fetch(
      apiUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
      }
    );

    const result = await response.json();
    
    if (response.ok) {
      logStep("✅ Meta CAPI sucesso", result);
    } else {
      logStep("❌ Meta CAPI erro", { status: response.status, result });
    }
  } catch (err) {
    logStep("❌ Meta CAPI falha", { error: String(err) });
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    logStep("❌ Erro na validação do webhook", { error: String(err) });
    return new Response("Webhook error", { status: 400 });
  }

  logStep(`📩 Evento recebido: ${event.type}`, { eventId: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;

      // 🔥 EVENTOS DE REEMBOLSO 🔥
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case "refund.created":
        await handleRefundCreated(event.data.object as Stripe.Refund);
        break;

      default:
        logStep("ℹ️ Evento ignorado", { type: event.type });
    }
  } catch (err) {
    logStep("❌ Erro interno ao processar evento", { error: String(err) });
    return new Response("Internal error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handler para reembolsos de cobrança
async function handleChargeRefunded(charge: Stripe.Charge) {
  const customerId = charge.customer as string;
  const refundedAmount = charge.amount_refunded / 100;
  const totalAmount = charge.amount / 100;
  const currency = charge.currency.toUpperCase();
  const isFullRefund = charge.refunded;

  logStep("💸 REEMBOLSO DETECTADO", {
    chargeId: charge.id,
    customerId,
    refundedAmount: `${refundedAmount} ${currency}`,
    totalAmount: `${totalAmount} ${currency}`,
    isFullRefund,
    refundStatus: charge.status,
  });

  // Buscar assinatura - primeiro por customerId, depois por email como fallback
  let record = await findSubscriptionRecord("", customerId);

  if (!record) {
    logStep("⚠️ Assinatura não encontrada por customerId, tentando por email...");
    record = await findSubscriptionByCustomerEmail(customerId);
  }

  if (!record) {
    logStep("❌ Nenhuma assinatura encontrada para esse customer", { customerId });
    return;
  }

  // Atualizar para demonstração (revogar acesso completamente)
  // IMPORTANTE: Limpar stripe_subscription_id para evitar que o sistema
  // detecte uma "subscription real" e libere acesso indevidamente
  // O trigger trigger_crm_automacao será acionado automaticamente
  const { error } = await supabaseAdmin
    .from("assinaturas")
    .update({
      status: "canceled",
      plano_tipo: "demonstracao",
      stripe_subscription_id: null,
      stripe_price_id: null,
      trial_with_card: false,
      data_fim: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", record.id);

  if (error) {
    logStep("❌ Erro ao atualizar assinatura após reembolso", { error });
  } else {
    logStep("✅ Assinatura revertida para trial após reembolso (CRM automático)", {
      recordId: record.id,
      userId: record.user_id,
    });
  }
}

// Handler para disputas/chargebacks
async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const chargeId = dispute.charge as string;
  const amount = dispute.amount / 100;
  const currency = dispute.currency.toUpperCase();
  const reason = dispute.reason;

  logStep("⚠️ DISPUTA/CHARGEBACK CRIADO", {
    disputeId: dispute.id,
    chargeId,
    amount: `${amount} ${currency}`,
    reason,
    status: dispute.status,
  });

  // Buscar a charge para obter o customerId
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const customerId = charge.customer as string;

    let record = await findSubscriptionRecord("", customerId);

    if (!record) {
      record = await findSubscriptionByCustomerEmail(customerId);
    }

    if (!record) {
      logStep("❌ Nenhuma assinatura encontrada para disputa", { customerId });
      return;
    }

    // Em caso de disputa, suspender acesso imediatamente
    // IMPORTANTE: Limpar stripe_subscription_id para revogar acesso
    const { error } = await supabaseAdmin
      .from("assinaturas")
      .update({
        status: "canceled",
        plano_tipo: "demonstracao",
        stripe_subscription_id: null,
        stripe_price_id: null,
        trial_with_card: false,
        data_fim: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id);

    if (error) {
      logStep("❌ Erro ao atualizar assinatura após disputa", { error });
    } else {
      logStep("✅ Assinatura suspensa devido a disputa", {
        recordId: record.id,
        reason,
      });
    }
  } catch (err) {
    logStep("❌ Erro ao processar disputa", { error: String(err) });
  }
}

// Handler para reembolsos via API
async function handleRefundCreated(refund: Stripe.Refund) {
  const chargeId = refund.charge as string;
  const amount = refund.amount / 100;
  const currency = refund.currency.toUpperCase();
  const reason = refund.reason;

  logStep("💰 REEMBOLSO VIA API CRIADO", {
    refundId: refund.id,
    chargeId,
    amount: `${amount} ${currency}`,
    reason,
    status: refund.status,
  });

  // Buscar a charge para obter o customerId
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const customerId = charge.customer as string;

    let record = await findSubscriptionRecord("", customerId);

    if (!record) {
      record = await findSubscriptionByCustomerEmail(customerId);
    }

    if (!record) {
      logStep("❌ Nenhuma assinatura encontrada para reembolso", { customerId });
      return;
    }

    // IMPORTANTE: Limpar stripe_subscription_id para revogar acesso
    const { error } = await supabaseAdmin
      .from("assinaturas")
      .update({
        status: "canceled",
        plano_tipo: "demonstracao",
        stripe_subscription_id: null,
        stripe_price_id: null,
        trial_with_card: false,
        data_fim: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id);

    if (error) {
      logStep("❌ Erro ao atualizar assinatura após reembolso API", { error });
    } else {
      logStep("✅ Assinatura revertida após reembolso via API", {
        recordId: record.id,
      });
    }
  } catch (err) {
    logStep("❌ Erro ao processar reembolso API", { error: String(err) });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  logStep("🔥 Checkout completed", { sessionId: session.id });

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return;

  const email = customer.email!;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const priceId = subscription.items.data[0].price.id;
  const planoTipo = PRICE_TO_PLAN[priceId] || "trial";
  const isTrialing = subscription.status === "trialing";

  logStep("📝 Plano identificado", { planoTipo, priceId, isTrialing, status: subscription.status });

  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const user = users.users.find((u) => u.email === email);

  if (!user) {
    logStep("❌ Usuário não encontrado", { email });
    return;
  }

  // Converter datas de forma segura
  const dataProximaCobranca = safeTimestampToISO(subscription.current_period_end);
  const trialEndAt = isTrialing && subscription.trial_end 
    ? safeTimestampToISO(subscription.trial_end) 
    : null;

  // Preparar dados da assinatura
  const assinaturaData: Record<string, any> = {
    user_id: user.id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    plano_tipo: isTrialing ? "trial" : planoTipo,
    status: isTrialing ? "trialing" : "active",
    data_inicio: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (dataProximaCobranca) {
    assinaturaData.data_proxima_cobranca = dataProximaCobranca;
  }

  // Se for trial com cartão (7 dias)
  if (isTrialing) {
    assinaturaData.trial_with_card = true;
    assinaturaData.trial_started_at = new Date().toISOString();
    if (trialEndAt) {
      assinaturaData.trial_end_at = trialEndAt;
      assinaturaData.data_fim = trialEndAt;
    }
    logStep("🎁 Trial com cartão ativado", { trialEndAt });
  }

  // Verificar se o usuário estava bloqueado com tipo "ate_assinar" e desbloquear
  const { data: currentAssinatura } = await supabaseAdmin
    .from("assinaturas")
    .select("bloqueado_admin, bloqueado_tipo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentAssinatura?.bloqueado_admin && currentAssinatura?.bloqueado_tipo === "ate_assinar") {
    logStep("🔓 Usuário estava bloqueado (ate_assinar) - desbloqueando automaticamente");
    assinaturaData.bloqueado_admin = false;
    assinaturaData.bloqueado_admin_motivo = null;
    assinaturaData.bloqueado_admin_em = null;
    assinaturaData.bloqueado_tipo = null;

    // Registrar no histórico
    await supabaseAdmin
      .from("historico_bloqueios")
      .insert({
        user_id: user.id,
        admin_id: "sistema",
        acao: "desbloqueio_automatico",
        tipo_bloqueio: null,
        motivo: "Desbloqueado automaticamente após assinar plano",
        user_nome: null,
        user_email: email,
        admin_nome: "Sistema",
        admin_email: null,
      });
  }

  await supabaseAdmin.from("assinaturas").upsert(assinaturaData, { onConflict: "user_id" });

  // O trigger trigger_crm_automacao será acionado automaticamente
  logStep("✅ Assinatura registrada e atualizada (CRM automático acionado)", { userId: user.id, planoTipo, isTrialing });

  // 🔔 Push notification para admin sobre nova assinatura (fire-and-forget)
  if (!isTrialing) {
    const planoNomes: Record<string, string> = {
      basico_mensal: "Básico Mensal", intermediario_mensal: "Intermediário Mensal",
      profissional_mensal: "Profissional Mensal", basico_anual: "Básico Anual",
      intermediario_anual: "Intermediário Anual", profissional_anual: "Profissional Anual",
    };
    const valorBRL = ((session.amount_total || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    fetch(`${supabaseUrl}/functions/v1/dispatch-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        event_type: "SUBSCRIPTION_CREATED",
        payload: {
          user_id: user.id,
          valor: valorBRL,
          plano_nome: planoNomes[planoTipo] || planoTipo,
        },
      }),
    }).catch((err) => logStep("⚠️ Erro ao disparar push admin (silencioso)", { error: String(err) }));
  }

  // 🔔 Webhook de boas-vindas para n8n (fire-and-forget)
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nome, celular")
      .eq("user_id", user.id)
      .maybeSingle();

    const webhookPayload = {
      nome: profile?.nome || email,
      telefone: profile?.celular || "",
      email: email,
      user_id: user.id,
      plano_tipo: isTrialing ? `trial_${planoTipo}` : planoTipo,
    };

    logStep("📤 Enviando webhook boas-vindas", webhookPayload);

    fetch("https://n8n.appmec.in/webhook/bemvindo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    }).then(async (res) => {
      logStep("✅ Webhook boas-vindas enviado", { status: res.status });
    }).catch((err) => {
      logStep("⚠️ Erro no webhook boas-vindas (silencioso)", { error: String(err) });
    });
  } catch (err) {
    logStep("⚠️ Erro ao preparar webhook boas-vindas", { error: String(err) });
  }

  // Extract tracking metadata from session
  const metadata = session.metadata || {};
  
  logStep("📊 METADATA COMPLETO DA SESSÃO", {
    allKeys: Object.keys(metadata),
    fbp: metadata.fbp || "AUSENTE",
    fbc: metadata.fbc || "AUSENTE",
    fbclid: metadata.fbclid || "AUSENTE",
    utm_source: metadata.utm_source || "AUSENTE",
    utm_medium: metadata.utm_medium || "AUSENTE",
    utm_campaign: metadata.utm_campaign || "AUSENTE",
    utm_content: metadata.utm_content || "AUSENTE",
    utm_term: metadata.utm_term || "AUSENTE",
    client_ip: metadata.client_ip || "AUSENTE",
    client_user_agent: metadata.client_user_agent || "AUSENTE",
  });

  // Send Purchase event to Meta CAPI (only for paid, not trial start)
  if (!isTrialing) {
    await sendMetaCapiEvent(
      "Purchase",
      session.id,
      email,
      {
        fbp: metadata.fbp,
        fbc: metadata.fbc,
        fbclid: metadata.fbclid,
        utm_source: metadata.utm_source,
        utm_medium: metadata.utm_medium,
        utm_campaign: metadata.utm_campaign,
        utm_content: metadata.utm_content,
        utm_term: metadata.utm_term,
        client_ip: metadata.client_ip,
        client_user_agent: metadata.client_user_agent,
        event_source_url: session.success_url || "https://appmec.in/obrigado",
      },
      {
        value: (session.amount_total || 0) / 100,
        currency: (session.currency || "brl").toUpperCase(),
        content_name: planoTipo,
        content_ids: [priceId],
      }
    );
  } else {
    // Track StartTrial event for Meta
    await sendMetaCapiEvent(
      "StartTrial",
      session.id,
      email,
      {
        fbp: metadata.fbp,
        fbc: metadata.fbc,
        client_ip: metadata.client_ip,
        client_user_agent: metadata.client_user_agent,
        event_source_url: session.success_url || "https://appmec.in/obrigado",
      },
      {
        value: 0,
        currency: "BRL",
        content_name: `Trial - ${planoTipo}`,
        content_ids: [priceId],
      }
    );
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  logStep("🔄 Subscription updated", { subscriptionId: subscription.id, status: subscription.status });

  const customerId = subscription.customer as string;
  let record = await findSubscriptionRecord(subscription.id, customerId);

  if (!record) {
    record = await findSubscriptionByCustomerEmail(customerId);
  }

  if (!record) {
    logStep("⚠️ Assinatura não encontrada para atualização");
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const planoTipo = priceId ? (PRICE_TO_PLAN[priceId] || "trial") : "trial";
  const status = subscription.status;

  // Converter data de forma segura para evitar "Invalid time value"
  const dataProximaCobranca = safeTimestampToISO(subscription.current_period_end);

  const updateData: Record<string, any> = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    stripe_price_id: priceId || null,
    status: status,
    updated_at: new Date().toISOString(),
  };

  // Só incluir data_proxima_cobranca se for válida
  if (dataProximaCobranca) {
    updateData.data_proxima_cobranca = dataProximaCobranca;
  }

  // Quando status é active, SEMPRE atualizar plano_tipo (upgrade, downgrade, ou conversão de trial)
  if (status === "active") {
    // Buscar assinatura atual para verificar se era trial
    const { data: currentSub } = await supabaseAdmin
      .from("assinaturas")
      .select("trial_with_card, status, plano_tipo")
      .eq("id", record.id)
      .single();

    // SEMPRE atualizar plano_tipo quando status é active
    updateData.plano_tipo = planoTipo;

    if (currentSub?.trial_with_card && currentSub?.status === "trialing") {
      // Trial converteu para pago!
      updateData.trial_converted = true;
      updateData.trial_converted_at = new Date().toISOString();
      logStep("🎉 TRIAL CONVERTIDO PARA PAGO!", { userId: record.user_id, planoTipo });

      // Enviar evento de conversão para Meta
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && "email" in customer && customer.email) {
          await sendMetaCapiEvent(
            "Purchase",
            `trial_converted_${subscription.id}`,
            customer.email,
            {},
            {
              value: (subscription.items.data[0]?.price?.unit_amount || 0) / 100,
              currency: "BRL",
              content_name: `Conversão Trial - ${planoTipo}`,
              content_ids: [priceId],
            }
          );
        }
      } catch (err) {
        logStep("⚠️ Erro ao enviar evento de conversão Meta", { error: String(err) });
      }
    } else if (currentSub?.plano_tipo !== planoTipo) {
      logStep("🔄 UPGRADE/DOWNGRADE detectado via webhook", { 
        oldPlano: currentSub?.plano_tipo, 
        newPlano: planoTipo 
      });
    }
  } else if (status === "trialing") {
    updateData.plano_tipo = "trial";
  } else {
    updateData.plano_tipo = planoTipo;
  }

  await supabaseAdmin
    .from("assinaturas")
    .update(updateData)
    .eq("id", record.id);

  // O trigger trigger_crm_automacao será acionado automaticamente
  logStep("✅ Subscription atualizada (CRM automático acionado)", { planoTipo, status, dataProximaCobranca });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  logStep("❌ Subscription deleted", { subscriptionId: subscription.id });

  const customerId = subscription.customer as string;
  let record = await findSubscriptionRecord(subscription.id, customerId);

  if (!record) {
    record = await findSubscriptionByCustomerEmail(customerId);
  }

  if (!record) {
    logStep("⚠️ Assinatura não encontrada para cancelamento");
    return;
  }

  // Verificar se era trial com cartão
  const { data: currentSub } = await supabaseAdmin
    .from("assinaturas")
    .select("trial_with_card, status")
    .eq("id", record.id)
    .single();

  // Fazer downgrade para plano FREE (gratuito permanente) em vez de trial
  // IMPORTANTE: Limpar stripe_subscription_id e stripe_price_id para evitar
  // estado inconsistente (free com IDs de Stripe ainda vinculados)
  const updateData: Record<string, any> = {
    plano_tipo: "free",
    status: "active", // Free é permanente e ativo
    stripe_subscription_id: null,
    stripe_price_id: null,
    data_proxima_cobranca: null,
    updated_at: new Date().toISOString(),
  };

  // Se era trial com cartão, marcar como cancelado durante trial
  if (currentSub?.trial_with_card && currentSub?.status === "trialing") {
    updateData.trial_canceled = true;
    updateData.trial_canceled_at = new Date().toISOString();
    logStep("🚫 Trial cancelado antes da cobrança - downgrade para Free", { userId: record.user_id });
  }

  await supabaseAdmin
    .from("assinaturas")
    .update(updateData)
    .eq("id", record.id);

  // O trigger trigger_crm_automacao será acionado automaticamente
  logStep("✅ Assinatura cancelada e revertida para plano Free (CRM automático acionado)");
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  logStep("💳 Payment failed", { invoiceId: invoice.id });

  const subscriptionId = invoice.subscription as string;
  const customerId = invoice.customer as string;

  let record = await findSubscriptionRecord(subscriptionId, customerId);

  if (!record) {
    record = await findSubscriptionByCustomerEmail(customerId);
  }

  if (!record) {
    logStep("⚠️ Assinatura não encontrada para falha de pagamento");
    return;
  }

  // Fazer downgrade para plano FREE em vez de trial
  await supabaseAdmin
    .from("assinaturas")
    .update({
      status: "past_due",
      plano_tipo: "free",
      updated_at: new Date().toISOString(),
    })
    .eq("id", record.id);

  // O trigger trigger_crm_automacao será acionado automaticamente
  logStep("⚠️ Pagamento falhou - assinatura revertida para Free (CRM automático acionado)");
}

// Handler para pagamentos bem-sucedidos (renovações)
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const billingReason = invoice.billing_reason;
  const subscriptionId = invoice.subscription as string;
  const customerId = invoice.customer as string;
  const amountPaid = (invoice.amount_paid || 0) / 100;

  logStep("💰 Payment succeeded", { invoiceId: invoice.id, billingReason, amountPaid });

  // Apenas processar renovações (subscription_cycle) e conversões de trial (subscription_update)
  // checkout.session.completed já cuida de subscription_create
  if (billingReason !== "subscription_cycle" && billingReason !== "subscription_update") {
    logStep("ℹ️ Pagamento ignorado para push (não é renovação)", { billingReason });
    return;
  }

  // Determinar plano
  const priceId = invoice.lines?.data?.[0]?.price?.id;
  const planoTipo = priceId ? (PRICE_TO_PLAN[priceId] || "desconhecido") : "desconhecido";

  const planoNomes: Record<string, string> = {
    basico_mensal: "Básico Mensal", intermediario_mensal: "Intermediário Mensal",
    profissional_mensal: "Profissional Mensal", basico_anual: "Básico Anual",
    intermediario_anual: "Intermediário Anual", profissional_anual: "Profissional Anual",
  };

  const valorBRL = amountPaid.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Buscar user_id
  let record = await findSubscriptionRecord(subscriptionId, customerId);
  if (!record) record = await findSubscriptionByCustomerEmail(customerId);
  const userId = record?.user_id || "unknown";

  const eventType = billingReason === "subscription_cycle" ? "SUBSCRIPTION_RENEWED" : "SUBSCRIPTION_CREATED";

  fetch(`${supabaseUrl}/functions/v1/dispatch-event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      event_type: eventType,
      payload: {
        user_id: userId,
        valor: valorBRL,
        plano_nome: planoNomes[planoTipo] || planoTipo,
      },
    }),
  }).catch((err) => logStep("⚠️ Erro ao disparar push admin renovação (silencioso)", { error: String(err) }));

  logStep("✅ Push de renovação disparado", { eventType, planoTipo, valorBRL });
}

Deno.serve(handler);
