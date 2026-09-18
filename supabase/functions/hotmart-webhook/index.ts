import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getPlanoFromOfferCode, PLANO_NOMES } from "../_shared/hotmart-config.ts";

// Clone de ticto-webhook/index.ts adaptado para a Hotmart. Duas diferenças
// reais de protocolo (não são escolha de estilo, são como a Hotmart manda
// os dados):
//   1. Autenticação: header X-HOTMART-HOTTOK, não um campo no body.
//   2. Discriminador de evento: body.event (ex: "PURCHASE_APPROVED"), não
//      body.status.
// Os nomes exatos de alguns campos abaixo (transaction id, forma de
// pagamento, próxima cobrança) foram montados a partir da documentação
// pública da Hotmart e podem precisar de ajuste fino no primeiro teste
// real via webhook de teste do painel — por isso tudo é lido com optional
// chaining e cai em valores neutros quando ausente.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hotmart-hottok",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[HOTMART-WEBHOOK] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();

    // ── 1. Validar token (header, não body — diferente da Ticto) ─────
    const expectedToken = Deno.env.get("HOTMART_WEBHOOK_TOKEN");
    const receivedToken = req.headers.get("x-hotmart-hottok");

    if (!expectedToken || receivedToken !== expectedToken) {
      log("❌ Token inválido", { received: receivedToken?.substring(0, 10) + "..." });
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = body?.event;
    const customerEmail = body?.data?.buyer?.email;
    const customerName = body?.data?.buyer?.name;
    const offerCode = body?.data?.offer?.code;
    const transactionId = body?.data?.purchase?.transaction ?? null;
    const paymentType = body?.data?.purchase?.payment?.type;

    log("Evento recebido", {
      event,
      email: customerEmail,
      offer_code: offerCode,
      transaction: transactionId,
    });

    // ── 2. Identificar o plano pelo offer_code ───────────────────────
    const planoTipo = offerCode ? getPlanoFromOfferCode(offerCode) : null;

    if (!planoTipo) {
      log("⚠️ offer_code não mapeado", { offerCode });
      return new Response(
        JSON.stringify({ received: true, warning: "Produto não mapeado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Processar eventos ─────────────────────────────────────────

    // Compra aprovada/completa
    if (event === "PURCHASE_APPROVED" || event === "PURCHASE_COMPLETE") {
      await processarCompraAprovada(supabaseAdmin, body, planoTipo, customerEmail, customerName, paymentType, transactionId);
    }
    // Cancelamento de assinatura
    else if (event === "SUBSCRIPTION_CANCELLATION") {
      await processarCancelamento(supabaseAdmin, customerEmail, planoTipo, transactionId);
    }
    // Compra atrasada (cobrança recorrente não confirmada ainda)
    else if (event === "PURCHASE_DELAYED") {
      await processarAtraso(supabaseAdmin, customerEmail, planoTipo);
    }
    // Reembolso / chargeback / cancelamento de compra
    else if (event === "PURCHASE_REFUNDED" || event === "PURCHASE_CHARGEBACK" || event === "PURCHASE_CANCELED") {
      await processarReembolso(supabaseAdmin, customerEmail, planoTipo, transactionId);
    }
    // Outros eventos — apenas logar
    else {
      log("Evento não processado (apenas logado)", { event });
    }

    return new Response(
      JSON.stringify({ received: true, processed: true, event }),
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

// ═══════════════════════════════════════════════════════════════════════
// Funções auxiliares (mesma lógica de ticto-webhook/index.ts)
// ═══════════════════════════════════════════════════════════════════════

async function buscarUsuarioPorEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string
) {
  if (!email) return null;

  // Buscar pelo profile (mais confiável que auth.users)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_id, nome")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (profile) return profile;

  // Fallback: buscar em auth.users
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
  const user = users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase().trim()
  );
  if (user) {
    return { user_id: user.id, nome: user.user_metadata?.nome || email };
  }

  return null;
}

async function processarCompraAprovada(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: any,
  planoTipo: string,
  customerEmail: string,
  customerName: string,
  paymentType: string | undefined,
  transactionId: string | null
) {
  log("Processando compra aprovada", { email: customerEmail, plano: planoTipo });

  const usuario = await buscarUsuarioPorEmail(supabaseAdmin, customerEmail);

  if (!usuario) {
    log("⚠️ Usuário não encontrado, salvando notificação admin", { email: customerEmail });
    await supabaseAdmin.from("admin_notifications").insert({
      tipo: "hotmart_usuario_nao_encontrado",
      titulo: "Pagamento Hotmart: usuário não encontrado",
      mensagem: `Pagamento aprovado para ${customerEmail} (${planoTipo}) mas não existe conta no sistema.`,
      dados: {
        email: customerEmail,
        nome: customerName,
        plano_tipo: planoTipo,
        transaction_id: transactionId,
        payment_type: paymentType,
      },
    });
    return;
  }

  const userId = usuario.user_id;
  const isAnual = planoTipo.includes("anual");
  const dataInicio = new Date().toISOString();
  const dataFim = new Date(
    Date.now() + (isAnual ? 365 : 30) * 24 * 60 * 60 * 1000
  ).toISOString();

  // Mapear forma de pagamento da Hotmart
  const metodo = paymentType === "CREDIT_CARD" ? "cartao" :
                 paymentType === "PIX" ? "pix" :
                 paymentType === "BILLET" ? "boleto" :
                 paymentType || "hotmart";

  // Próxima cobrança (da assinatura Hotmart se disponível)
  const nextCharge = body?.data?.subscription?.date_next_charge;
  const dataProximaCobranca = nextCharge
    ? new Date(nextCharge).toISOString()
    : dataFim;

  // Verificar se já existe assinatura (com plano atual para detectar mudança)
  const { data: assinaturaExistente } = await supabaseAdmin
    .from("assinaturas")
    .select("id, plano_tipo, status")
    .eq("user_id", userId)
    .maybeSingle();

  const planoAnterior = assinaturaExistente?.plano_tipo;
  const eraMudancaPlano = assinaturaExistente &&
    planoAnterior !== planoTipo &&
    planoAnterior !== "free" &&
    planoAnterior !== "demonstracao" &&
    planoAnterior !== "trial" &&
    assinaturaExistente.status === "active";

  const dadosAssinatura = {
    plano_tipo: planoTipo,
    status: "active" as const,
    data_inicio: dataInicio,
    data_fim: dataFim,
    data_proxima_cobranca: dataProximaCobranca,
    payment_provider: "hotmart",
    payment_method: metodo,
    updated_at: dataInicio,
    hotmart_transaction_id: transactionId,
    // Limpar campos de outros provedores
    stripe_subscription_id: null,
    stripe_price_id: null,
    stripe_customer_id: null,
  };

  if (assinaturaExistente) {
    const { error } = await supabaseAdmin
      .from("assinaturas")
      .update(dadosAssinatura)
      .eq("user_id", userId);

    if (error) throw new Error(`Erro ao atualizar assinatura: ${error.message}`);
    log("Assinatura atualizada", { userId, planoTipo });
  } else {
    const { error } = await supabaseAdmin
      .from("assinaturas")
      .insert({ user_id: userId, ...dadosAssinatura });

    if (error) throw new Error(`Erro ao criar assinatura: ${error.message}`);
    log("Assinatura criada", { userId, planoTipo });
  }

  // Remover bloqueio "ate_assinar" se existir
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

  // Notificação admin
  const planoNome = PLANO_NOMES[planoTipo as keyof typeof PLANO_NOMES] || planoTipo;
  const planoAnteriorNome = planoAnterior ? (PLANO_NOMES[planoAnterior as keyof typeof PLANO_NOMES] || planoAnterior) : null;

  if (eraMudancaPlano) {
    await supabaseAdmin.from("admin_notifications").insert({
      tipo: "mudanca_plano",
      titulo: "Mudança de plano!",
      mensagem: `${customerName || customerEmail} mudou de ${planoAnteriorNome} para ${planoNome}. Cancele o plano anterior na Hotmart.`,
      dados: {
        user_id: userId,
        plano_anterior: planoAnterior,
        plano_novo: planoTipo,
        transaction_id: transactionId,
        payment_method: metodo,
        acao_necessaria: "Cancelar plano anterior na Hotmart",
      },
    });
  } else {
    await supabaseAdmin.from("admin_notifications").insert({
      tipo: "nova_assinatura_hotmart",
      titulo: "Nova assinatura via Hotmart!",
      mensagem: `${customerName || customerEmail} assinou ${planoNome} via ${metodo}`,
      dados: {
        user_id: userId,
        plano_tipo: planoTipo,
        transaction_id: transactionId,
        payment_method: metodo,
      },
    });
  }

  // Push notification admin (fire-and-forget)
  const priceValue = body?.data?.purchase?.price?.value;
  const priceCurrency = body?.data?.purchase?.price?.currency_value;
  const valorFormatado = priceValue != null
    ? `${priceValue}${priceCurrency ? ` ${priceCurrency}` : ""}`
    : "N/A";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // IMPORTANTE: usar await garante que a chamada para dispatch-event complete
  // antes do isolate ser encerrado (fire-and-forget no Deno edge runtime
  // pode ser cancelado quando o handler retorna).
  try {
    const dispatchRes = await fetch(`${supabaseUrl}/functions/v1/dispatch-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        event_type: eraMudancaPlano ? "SUBSCRIPTION_RENEWED" : "SUBSCRIPTION_CREATED",
        payload: {
          user_id: userId,
          valor: valorFormatado,
          plano_nome: planoNome,
          payment_method: metodo,
        },
      }),
    });
    const dispatchBody = await dispatchRes.text();
    log("📣 dispatch-event respondeu", { status: dispatchRes.status, body: dispatchBody.substring(0, 200) });
  } catch (err) {
    log("⚠️ Erro ao chamar dispatch-event", { error: String(err) });
  }

  log("✅ Compra aprovada processada", { userId, planoTipo });
}

async function processarCancelamento(
  supabaseAdmin: ReturnType<typeof createClient>,
  customerEmail: string,
  planoTipo: string,
  transactionId: string | null
) {
  log("Processando cancelamento", { email: customerEmail, transactionId });

  const usuario = await buscarUsuarioPorEmail(supabaseAdmin, customerEmail);
  if (!usuario) {
    log("⚠️ Usuário não encontrado para cancelamento", { email: customerEmail });
    return;
  }

  // Buscar assinatura atual para verificar se o transactionId bate
  // Evita sobrescrever uma renovação quando a Hotmart envia cancelamento de uma transação anterior
  const { data: assinaturaAtual } = await supabaseAdmin
    .from("assinaturas")
    .select("id, hotmart_transaction_id, plano_tipo, status, data_proxima_cobranca")
    .eq("user_id", usuario.user_id)
    .maybeSingle();

  if (assinaturaAtual && transactionId && assinaturaAtual.hotmart_transaction_id !== transactionId) {
    log("⚠️ Cancelamento ignorado: transactionId não corresponde à assinatura atual (possível renovação já processada)", {
      transactionIdCancelamento: transactionId,
      hotmartTransactionIdAtual: assinaturaAtual.hotmart_transaction_id,
      planoAtual: assinaturaAtual.plano_tipo,
    });
    await supabaseAdmin.from("admin_notifications").insert({
      tipo: "cancelamento_hotmart_ignorado",
      titulo: "Cancelamento Hotmart ignorado (renovação detectada)",
      mensagem: `Cancelamento de ${customerEmail} (${planoTipo}) ignorado — usuário já renovou (transação ${assinaturaAtual.hotmart_transaction_id})`,
      dados: { user_id: usuario.user_id, plano_tipo: planoTipo, transaction_id_cancelamento: transactionId, transaction_id_atual: assinaturaAtual.hotmart_transaction_id },
    });
    return;
  }

  const { error } = await supabaseAdmin
    .from("assinaturas")
    .update({
      plano_tipo: "free",
      status: "active",
      payment_provider: "hotmart",
      data_fim: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", usuario.user_id);

  if (error) {
    log("Erro ao processar cancelamento", { error: error.message });
  } else {
    log("✅ Cancelamento processado → free", { userId: usuario.user_id });
  }

  await supabaseAdmin.from("admin_notifications").insert({
    tipo: "cancelamento_hotmart",
    titulo: "Assinatura cancelada (Hotmart)",
    mensagem: `${customerEmail} cancelou o plano ${planoTipo}`,
    dados: { user_id: usuario.user_id, plano_tipo: planoTipo, transaction_id: transactionId },
  });
}

async function processarAtraso(
  supabaseAdmin: ReturnType<typeof createClient>,
  customerEmail: string,
  planoTipo: string
) {
  log("Processando atraso", { email: customerEmail });

  const usuario = await buscarUsuarioPorEmail(supabaseAdmin, customerEmail);
  if (!usuario) return;

  const { error } = await supabaseAdmin
    .from("assinaturas")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", usuario.user_id);

  if (error) {
    log("Erro ao processar atraso", { error: error.message });
  } else {
    log("✅ Status atualizado para past_due", { userId: usuario.user_id });
  }
}

async function processarReembolso(
  supabaseAdmin: ReturnType<typeof createClient>,
  customerEmail: string,
  planoTipo: string,
  transactionId: string | null
) {
  log("Processando reembolso/chargeback/cancelamento de compra", { email: customerEmail });

  const usuario = await buscarUsuarioPorEmail(supabaseAdmin, customerEmail);
  if (!usuario) return;

  const { error } = await supabaseAdmin
    .from("assinaturas")
    .update({
      plano_tipo: "demonstracao",
      status: "canceled",
      data_fim: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", usuario.user_id);

  if (error) {
    log("Erro ao processar reembolso", { error: error.message });
  } else {
    log("✅ Reembolso processado → demonstracao/canceled", { userId: usuario.user_id });
  }

  await supabaseAdmin.from("admin_notifications").insert({
    tipo: "reembolso_hotmart",
    titulo: "Reembolso/Chargeback (Hotmart)",
    mensagem: `${customerEmail} teve reembolso do plano ${planoTipo}`,
    dados: { user_id: usuario.user_id, plano_tipo: planoTipo, transaction_id: transactionId },
  });
}
