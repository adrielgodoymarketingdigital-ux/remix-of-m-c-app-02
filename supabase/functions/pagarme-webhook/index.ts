import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PAGARME-WEBHOOK] ${step}${d}`);
};

// Mapeia subscription_id → user_id/plano via tabela `assinaturas`
// deno-lint-ignore no-explicit-any
type AdminClient = any;

type AssinaturaMin = { id: string; user_id: string; plano_tipo: string; pagarme_subscription_id: string | null };

async function findAssinaturaBySubscription(
  supabaseAdmin: AdminClient,
  subscriptionId: string
) {
  const { data } = await supabaseAdmin
    .from("assinaturas")
    .select("id, user_id, plano_tipo, pagarme_subscription_id")
    .eq("pagarme_subscription_id", subscriptionId)
    .maybeSingle();
  return data as AssinaturaMin | null;
}

// Fallback: busca por customer.code (user_id) quando pagarme_subscription_id é nulo
async function findAssinaturaByCustomerCode(
  supabaseAdmin: AdminClient,
  customerCode: string
) {
  const { data } = await supabaseAdmin
    .from("assinaturas")
    .select("id, user_id, plano_tipo, pagarme_subscription_id")
    .eq("user_id", customerCode)
    .maybeSingle();
  return data as AssinaturaMin | null;
}

function calcularProximaCobranca(planoTipo: string): string {
  const isAnual = planoTipo.includes("anual");
  return new Date(
    Date.now() + (isAnual ? 365 : 30) * 24 * 60 * 60 * 1000
  ).toISOString();
}

async function dispararMetaCapiPurchase(
  supabaseAdmin: AdminClient,
  userId: string,
  valorCentavos: number,
  planoTipo: string
): Promise<void> {
  try {
    // 1. Buscar dados de tracking do profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, fbc, fbp, purchase_event_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) {
      log("⚠️ [CAPI] Profile não encontrado para Purchase", { userId });
      return;
    }

    // 2. Deduplicação: se já existe purchase_event_id, não disparar novamente
    if (profile.purchase_event_id) {
      log("⚠️ [CAPI] Purchase já disparado anteriormente", { userId, purchase_event_id: profile.purchase_event_id });
      return;
    }

    // 3. Gerar event_id único e salvar no profile (deduplicação futura)
    const eventId = crypto.randomUUID();
    await supabaseAdmin
      .from("profiles")
      .update({ purchase_event_id: eventId })
      .eq("user_id", userId);

    // 4. Calcular valor em BRL
    const valorBRL = valorCentavos / 100;

    // 5. Chamar meta-capi-event
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const capiRes = await fetch(`${supabaseUrl}/functions/v1/meta-capi-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        event_name: "Purchase",
        event_id: eventId,
        email: profile.email || null,
        fbp: profile.fbp || null,
        fbc: profile.fbc || null,
        client_user_agent: null,
        custom_data: {
          currency: "BRL",
          value: valorBRL,
          content_name: planoTipo,
          content_type: "product",
        },
      }),
    });

    const capiBody = await capiRes.text();
    log("📣 [CAPI] Purchase enviado", {
      userId,
      eventId,
      valorBRL,
      status: capiRes.status,
      response: capiBody.substring(0, 200),
    });
  } catch (err) {
    // Fire-and-forget: erro no CAPI não deve quebrar o webhook
    log("⚠️ [CAPI] Erro ao disparar Purchase (não crítico)", { error: String(err) });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Apenas POST é aceito
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();
    const eventType = body?.type;
    const eventId = body?.id;

    // Verifica que o webhook vem da conta Pagar.me correta
    const pagarmeAccountId = Deno.env.get("PAGARME_ACCOUNT_ID");
    if (pagarmeAccountId && body?.account?.id && body.account.id !== pagarmeAccountId) {
      log("Account ID inválido", { received: body.account.id });
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Evento recebido", { type: eventType, id: eventId, accountId: body?.account?.id ?? null });

    // ════════════════════════════════════════════════════════════════
    // EVENTOS DE SUBSCRIPTION (cartão recorrente)
    // ════════════════════════════════════════════════════════════════
    if (
      eventType === "subscription.charged" ||
      eventType === "invoice.paid" ||
      eventType === "charge.paid" ||
      eventType === "subscription.activated"
    ) {
      return await handleSubscriptionCharged(body, supabaseAdmin);
    }

    if (
      eventType === "subscription.payment_failed" ||
      eventType === "invoice.payment_failed" ||
      eventType === "charge.payment_failed" ||
      eventType === "charge.refused"
    ) {
      return await handleSubscriptionFailed(body, supabaseAdmin);
    }

    if (
      eventType === "subscription.canceled" ||
      eventType === "subscription.deleted"
    ) {
      return await handleSubscriptionCanceled(body, supabaseAdmin);
    }

    // subscription.updated / subscription.created → tratamos como renovação
    // (a Pagar.me dispara updated quando status muda, ex: past_due → active)
    if (
      eventType === "subscription.updated" ||
      eventType === "subscription.created"
    ) {
      return await handleSubscriptionCharged(body, supabaseAdmin);
    }

    // ════════════════════════════════════════════════════════════════
    // EVENTO PIX (order.paid)
    // ════════════════════════════════════════════════════════════════
    if (eventType === "order.paid") {
      const order = body?.data;
      if (!order?.id) {
        log("Payload sem order id");
        return new Response(JSON.stringify({ error: "Payload inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderId = order.id as string;
      const charge = order.charges?.[0];
      const orderOrigem = order?.metadata?.origem ?? charge?.metadata?.origem ?? null;

      return await handlePixOrderPaid(orderId, charge, orderOrigem, supabaseAdmin, order?.customer?.code ?? null);
    }

    log("Evento ignorado", { type: eventType });
    return new Response(JSON.stringify({ received: true, ignored: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { message: msg });
    // Retorna 500 para Pagar.me retentar
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ════════════════════════════════════════════════════════════════════
// HANDLER PIX (order.paid OU fallback de charge.paid/charge.* por order_id)
// ════════════════════════════════════════════════════════════════════

// deno-lint-ignore no-explicit-any
async function handlePixOrderPaid(
  orderId: string,
  charge: any,
  orderOrigem: string | null,
  supabaseAdmin: AdminClient,
  customerCodeFromOrder: string | null,
): Promise<Response> {
    const paidAt = charge?.paid_at || new Date().toISOString();

    log("Order paga", { orderId, chargeId: charge?.id, paidAt, orderOrigem });

    // ── 1. Buscar pagamento PIX no banco ─────────────────────────────
    const { data: pagamento, error: fetchError } = await supabaseAdmin
      .from("pagamentos_pix")
      .select("*")
      .eq("pagarme_order_id", orderId)
      .maybeSingle();

    if (fetchError) {
      log("Erro ao buscar pagamento", { error: fetchError.message });
      throw new Error(`Erro ao buscar pagamento: ${fetchError.message}`);
    }

    if (!pagamento) {
      // Fallback: pagamento não veio pelo fluxo do app (ex: link externo Pagar.me/Ticto).
      // Tenta renovar pelo customer.code = user_id do pedido.
      const customerCode = customerCodeFromOrder;
      log("Pagamento não encontrado — tentando fallback por customer.code", { orderId, customerCode });

      if (customerCode) {
        const { data: assinaturaFallback } = await supabaseAdmin
          .from("assinaturas")
          .select("id, plano_tipo, user_id")
          .eq("user_id", customerCode)
          .maybeSingle();

        if (assinaturaFallback) {
          const isAnualFb = assinaturaFallback.plano_tipo.includes("anual");
          const dataFimFb = new Date(
            Date.now() + (isAnualFb ? 365 : 30) * 24 * 60 * 60 * 1000
          ).toISOString();

          await supabaseAdmin
            .from("assinaturas")
            .update({
              status: "active",
              data_inicio: new Date().toISOString(),
              data_fim: dataFimFb,
              data_proxima_cobranca: dataFimFb,
              payment_provider: "pagarme",
              payment_method: "pix",
              updated_at: new Date().toISOString(),
              bloqueado_admin: false,
              bloqueado_admin_em: null,
              bloqueado_admin_motivo: null,
              bloqueado_tipo: null,
            })
            .eq("id", assinaturaFallback.id);

          await supabaseAdmin.from("admin_notifications").insert({
            tipo: "nova_assinatura",
            titulo: "Renovação via PIX (link externo)",
            mensagem: `Pagamento PIX externo confirmado para plano ${assinaturaFallback.plano_tipo}`,
            dados: { user_id: customerCode, plano_tipo: assinaturaFallback.plano_tipo, pagarme_order_id: orderId },
          });

          log("✅ Assinatura renovada via fallback customer.code", { userId: customerCode, orderId });
          return new Response(
            JSON.stringify({ received: true, processed: true, fallback: true, user_id: customerCode }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      log("Pagamento não encontrado e sem fallback", { orderId });
      return new Response(
        JSON.stringify({ received: true, warning: "Pagamento não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pagamento.status === "paid") {
      // Verificar se a assinatura foi ativada — pode ter falhado numa retentativa anterior
      const { data: assinaturaCheck } = await supabaseAdmin
        .from("assinaturas")
        .select("plano_tipo, status, payment_method")
        .eq("user_id", pagamento.user_id)
        .maybeSingle();

      const jaAtivado =
        assinaturaCheck?.status === "active" &&
        assinaturaCheck?.payment_method === "pix" &&
        assinaturaCheck?.plano_tipo === pagamento.plano_tipo;

      if (jaAtivado) {
        log("Pagamento e assinatura já processados", { orderId });
        return new Response(
          JSON.stringify({ received: true, already_processed: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Pagamento paid mas assinatura não ativada — reprocessar ativação
      log("Pagamento já paid mas assinatura não ativada — reativando", { orderId, assinaturaCheck });
    }

    // ── 2. Atualizar pagamentos_pix → paid ───────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("pagamentos_pix")
      .update({
        status: "paid",
        paid_at: paidAt,
        pagarme_charge_id: charge?.id ?? pagamento.pagarme_charge_id,
        pagarme_transaction_id:
          charge?.last_transaction?.id ?? pagamento.pagarme_transaction_id,
      })
      .eq("id", pagamento.id);

    if (updateError) {
      log("Erro ao atualizar pagamento", { error: updateError.message });
      throw new Error(`Erro ao atualizar pagamento: ${updateError.message}`);
    }

    log("Pagamento PIX atualizado para paid", { id: pagamento.id });

    // ── 3. Ativar assinatura do usuário ──────────────────────────────
    const userId = pagamento.user_id;
    const planoTipo = pagamento.plano_tipo;
    const isAnual = planoTipo.includes("anual");
    const dataInicio = new Date().toISOString();
    const dataFim = new Date(
      Date.now() + (isAnual ? 365 : 30) * 24 * 60 * 60 * 1000
    ).toISOString();

    // Verificar se já existe assinatura para o usuário
    const { data: assinaturaExistente } = await supabaseAdmin
      .from("assinaturas")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (assinaturaExistente) {
      // Atualizar assinatura existente
      const { error: assError } = await supabaseAdmin
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
        })

        .eq("user_id", userId);

      // Remover bloqueio administrativo do tipo "ate_assinar" após pagamento confirmado
      const { error: unblockError } = await supabaseAdmin
        .from("assinaturas")
        .update({
          bloqueado_admin: false,
          bloqueado_admin_em: null,
          bloqueado_admin_motivo: null,
          bloqueado_tipo: null,
        })
        .eq("user_id", userId)
        .eq("bloqueado_tipo", "ate_assinar");

      if (unblockError) {
        log("Erro ao remover bloqueio ate_assinar", { error: unblockError.message });
      } else {
        log("Bloqueio ate_assinar removido (se existia)", { userId });
      }

      if (assError) {
        log("Erro ao atualizar assinatura", { error: assError.message });
        throw new Error(`Erro ao atualizar assinatura: ${assError.message}`);
      }
      log("Assinatura atualizada", { userId, planoTipo });
    } else {
      // Criar nova assinatura
      const { error: assError } = await supabaseAdmin
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

      if (assError) {
        log("Erro ao criar assinatura", { error: assError.message });
        throw new Error(`Erro ao criar assinatura: ${assError.message}`);
      }
      log("Assinatura criada", { userId, planoTipo });
    }

    // Limpar followup_control após renovação confirmada
    const { error: followupError } = await supabaseAdmin
      .from("followup_control")
      .delete()
      .eq("user_id", userId);
    if (followupError) {
      log("⚠️ Erro ao deletar followup_control (não crítico)", { userId, error: followupError.message });
    } else {
      log("🧹 followup_control limpo", { userId });
    }

    // 🎯 Meta CAPI Purchase (server-side)
    await dispararMetaCapiPurchase(supabaseAdmin, userId, pagamento.valor_centavos, planoTipo);

    // 📣 Notificar n8n — confirmação de pagamento PIX renovação (fire-and-forget)
    // Dispara se a metadata indicar renovação OU se já existia assinatura prévia
    // (fallback caso a Pagar.me não ecoe metadata.origem no webhook).
    const isRenovacao = orderOrigem === "renovacao" || !!assinaturaExistente;

    if (isRenovacao) {
      const { data: profileN8n } = await supabaseAdmin
        .from("profiles")
        .select("nome, email, celular")
        .eq("user_id", userId)
        .maybeSingle();

      fetch("https://n8n.appmec.in/webhook/renovacao-pix-confirmado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: "pagamento_confirmado",
          user_id: userId,
          pagarme_order_id: orderId,
          valor_pago: pagamento.valor_centavos / 100,
          plano_tipo: planoTipo,
          email: profileN8n?.email ?? "",
          nome: profileN8n?.nome ?? "",
          telefone: profileN8n?.celular ?? "",
        }),
      }).catch(() => {});
      log("📣 n8n renovacao-pix-confirmado disparado", { userId, orderId });
    }

    // 📣 Notificar n8n — novo assinante via PIX (fire-and-forget)
    // Só dispara quando NÃO é renovação
    if (!isRenovacao) {
      try {
        const { data: profileNovoAssinante } = await supabaseAdmin
          .from("profiles")
          .select("nome, celular")
          .eq("user_id", userId)
          .maybeSingle();

        const novoAssinanteRes = await fetch("https://n8n.appmec.in/webhook/novo-assinante", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evento: "novo_assinante",
            user_id: userId,
            nome: profileNovoAssinante?.nome ?? "",
            telefone: profileNovoAssinante?.celular ?? "",
            plano_tipo: planoTipo,
            valor_pago: pagamento.valor_centavos / 100,
          }),
        });
        log("📣 n8n novo-assinante disparado", { userId, orderId, status: novoAssinanteRes.status });
      } catch (err) {
        log("⚠️ Erro ao notificar n8n novo-assinante (não crítico)", { userId, error: String(err) });
      }
    }

    // ── 4. Notificação admin ─────────────────────────────────────────
    const isRenovacaoPix = !!assinaturaExistente;
    await supabaseAdmin.from("admin_notifications").insert({
      tipo: "nova_assinatura",
      titulo: isRenovacaoPix ? "Renovação via PIX!" : "Nova assinatura via PIX!",
      mensagem: `Pagamento PIX confirmado para plano ${planoTipo}`,
      dados: {
        user_id: userId,
        plano_tipo: planoTipo,
        pagarme_order_id: orderId,
        valor_centavos: pagamento.valor_centavos,
      },
    });

    // 🔔 Push notification via dispatch-event (usa notification_rules do painel admin)
    const planoNomes: Record<string, string> = {
      basico_mensal: "Básico Mensal", intermediario_mensal: "Intermediário Mensal",
      profissional_mensal: "Profissional Mensal", basico_anual: "Básico Anual",
      intermediario_anual: "Intermediário Anual", profissional_anual: "Profissional Anual",
      profissional_ultra_mensal: "Profissional Ultra Mensal", profissional_ultra_anual: "Profissional Ultra Anual",
    };
    const valorBRL = (pagamento.valor_centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    try {
      const dispatchRes = await fetch(`${supabaseUrl}/functions/v1/dispatch-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          event_type: isRenovacaoPix ? "SUBSCRIPTION_RENEWED" : "SUBSCRIPTION_CREATED",
          payload: {
            user_id: userId,
            valor: valorBRL,
            plano_nome: planoNomes[planoTipo] || planoTipo,
            payment_method: "PIX",
          },
        }),
      });
      const dispatchBody = await dispatchRes.text();
      log("📣 dispatch-event respondeu (PIX)", {
        status: dispatchRes.status,
        body: dispatchBody.substring(0, 200),
        event_type: isRenovacaoPix ? "SUBSCRIPTION_RENEWED" : "SUBSCRIPTION_CREATED",
      });
    } catch (err) {
      log("⚠️ Erro ao disparar dispatch-event (PIX)", { error: String(err) });
    }

    log("✅ Webhook processado com sucesso", { userId, planoTipo, orderId });

    return new Response(
      JSON.stringify({ received: true, processed: true, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
}

// ════════════════════════════════════════════════════════════════════
// HANDLERS DE SUBSCRIPTION
// ════════════════════════════════════════════════════════════════════

async function handleSubscriptionCharged(
  body: Record<string, unknown>,
  supabaseAdmin: AdminClient
) {
  const data = body?.data as Record<string, unknown> | undefined;
  const eventType = (body?.type as string) || "";

  // O subscription_id pode vir em vários lugares dependendo do evento:
  // - subscription.charged → data.subscription.id
  // - invoice.paid → data.subscription_id ou data.subscription.id
  // - charge.paid → data.subscription_id (se vinculado)
  const subscriptionId =
    (data?.subscription_id as string) ??
    ((data?.subscription as Record<string, unknown>)?.id as string) ??
    ((data?.invoice as Record<string, unknown>)?.subscription_id as string) ??
    null;

  // customer.code = user_id (usado como fallback quando pagarme_subscription_id é nulo)
  const customerCode =
    ((data?.customer as Record<string, unknown>)?.code as string) ??
    ((data?.subscription as Record<string, unknown>)?.customer as Record<string, unknown>)?.code as string ??
    null;

  // Fallback PIX: a Pagar.me pode notificar a confirmação de um PIX via charge.paid
  // (em vez de order.paid). Nesse caso o evento não tem subscription_id nem
  // customer.code útil para assinatura recorrente, mas o charge referencia o
  // order_id — que é o mesmo order_id salvo em pagamentos_pix.pagarme_order_id.
  // Sem este fallback, o evento cairia no "ignorando" abaixo e o pagamento PIX
  // ficaria pending para sempre, mesmo já pago na Pagar.me.
  if (!subscriptionId) {
    const orderIdFromCharge =
      (data?.order_id as string) ??
      ((data?.order as Record<string, unknown>)?.id as string) ??
      null;

    if (orderIdFromCharge) {
      const { data: pagamentoPix } = await supabaseAdmin
        .from("pagamentos_pix")
        .select("id")
        .eq("pagarme_order_id", orderIdFromCharge)
        .eq("status", "pending")
        .maybeSingle();

      if (pagamentoPix) {
        log("charge.paid identificado como PIX pendente — delegando para handlePixOrderPaid", {
          orderIdFromCharge,
          eventType,
        });
        const chargeOrigem = (data?.metadata as Record<string, unknown>)?.origem as string ?? null;
        return await handlePixOrderPaid(orderIdFromCharge, data, chargeOrigem, supabaseAdmin, customerCode);
      }
    }
  }

  if (!subscriptionId && !customerCode) {
    log("subscription.charged sem subscription_id e sem customer.code — ignorando", { data });
    return ok({ ignored: true, reason: "no_subscription_id" });
  }

  let assinatura = subscriptionId
    ? await findAssinaturaBySubscription(supabaseAdmin, subscriptionId)
    : null;

  // Fallback: buscar por customer.code (user_id) para pagamentos Pix sem subscription_id
  if (!assinatura && customerCode) {
    log("Buscando assinatura por customer.code (fallback Pix)", { customerCode });
    assinatura = await findAssinaturaByCustomerCode(supabaseAdmin, customerCode);
  }

  if (!assinatura) {
    log("Assinatura local não encontrada", { subscriptionId, customerCode });
    return ok({ warning: "assinatura_nao_encontrada" });
  }

  // Buscar status anterior para distinguir nova venda vs renovação
  const { data: assinaturaAtual } = await supabaseAdmin
    .from("assinaturas")
    .select("status")
    .eq("id", assinatura.id)
    .maybeSingle();
  const statusAnterior = (assinaturaAtual?.status as string) || null;
  const eraNovaVenda =
    statusAnterior !== "active" || eventType === "subscription.activated";

  const proximaCobranca = calcularProximaCobranca(assinatura.plano_tipo);

  const updatePayload: Record<string, unknown> = {
    status: "active",
    data_fim: proximaCobranca,
    data_proxima_cobranca: proximaCobranca,
    updated_at: new Date().toISOString(),
  };

  // Salvar pagarme_subscription_id se vier no evento e ainda não estiver no banco
  if (subscriptionId && !assinatura.pagarme_subscription_id) {
    updatePayload.pagarme_subscription_id = subscriptionId;
  }

  const { error } = await supabaseAdmin
    .from("assinaturas")
    .update(updatePayload)
    .eq("id", assinatura.id);

  if (error) {
    log("Erro ao renovar assinatura", { error: error.message });
    throw new Error(`Erro ao renovar: ${error.message}`);
  }

  // Remove bloqueio "ate_assinar" se existir
  await supabaseAdmin
    .from("assinaturas")
    .update({
      bloqueado_admin: false,
      bloqueado_admin_em: null,
      bloqueado_admin_motivo: null,
      bloqueado_tipo: null,
    })
    .eq("id", assinatura.id)
    .eq("bloqueado_tipo", "ate_assinar");

  log("✅ Renovação processada", {
    userId: assinatura.user_id,
    plano: assinatura.plano_tipo,
    proximaCobranca,
  });

  // 🎯 Meta CAPI Purchase (server-side)
  const chargeForCapi =
    ((data?.charge as Record<string, unknown>) ??
      ((data?.charges as unknown[])?.[0] as Record<string, unknown>) ??
      ((data?.invoice as Record<string, unknown>)?.charge as Record<string, unknown>)) ||
    undefined;
  const valorCentavosCard =
    (chargeForCapi?.amount as number) ??
    ((data?.invoice as Record<string, unknown>)?.amount as number) ??
    (data?.amount as number) ??
    0;
  await dispararMetaCapiPurchase(
    supabaseAdmin,
    assinatura.user_id,
    Number(valorCentavosCard),
    assinatura.plano_tipo
  );

  // 🔔 Push admin via dispatch-event (usa notification_rules do painel admin)
  try {
    const planoNomes: Record<string, string> = {
      basico_mensal: "Básico Mensal",
      intermediario_mensal: "Intermediário Mensal",
      profissional_mensal: "Profissional Mensal",
      basico_anual: "Básico Anual",
      intermediario_anual: "Intermediário Anual",
      profissional_anual: "Profissional Anual",
      profissional_ultra_mensal: "Profissional Ultra Mensal",
      profissional_ultra_anual: "Profissional Ultra Anual",
    };

    const charge =
      ((data?.charge as Record<string, unknown>) ??
        ((data?.charges as unknown[])?.[0] as Record<string, unknown>) ??
        ((data?.invoice as Record<string, unknown>)?.charge as Record<string, unknown>)) ||
      undefined;
    const valorCentavos =
      (charge?.amount as number) ??
      ((data?.invoice as Record<string, unknown>)?.amount as number) ??
      (data?.amount as number) ??
      0;
    const valorBRL = (Number(valorCentavos) / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const dispatchRes = await fetch(`${supabaseUrl}/functions/v1/dispatch-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        event_type: eraNovaVenda ? "SUBSCRIPTION_CREATED" : "SUBSCRIPTION_RENEWED",
        payload: {
          user_id: assinatura.user_id,
          valor: valorBRL,
          plano_nome: planoNomes[assinatura.plano_tipo] || assinatura.plano_tipo,
          payment_method: "cartão",
        },
      }),
    });
    const dispatchBody = await dispatchRes.text();
    log("📣 dispatch-event respondeu (cartão)", {
      status: dispatchRes.status,
      body: dispatchBody.substring(0, 200),
      event_type: eraNovaVenda ? "SUBSCRIPTION_CREATED" : "SUBSCRIPTION_RENEWED",
    });
  } catch (err) {
    log("⚠️ Erro ao disparar dispatch-event (cartão)", { error: String(err) });
  }

  // 📣 Notificar n8n — novo assinante via cartão (fire-and-forget)
  // Só dispara quando é nova venda (não renovação)
  if (eraNovaVenda) {
    try {
      const { data: profileNovoAssinante } = await supabaseAdmin
        .from("profiles")
        .select("nome, celular")
        .eq("user_id", assinatura.user_id)
        .maybeSingle();

      const novoAssinanteRes = await fetch("https://n8n.appmec.in/webhook/novo-assinante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: "novo_assinante",
          user_id: assinatura.user_id,
          nome: profileNovoAssinante?.nome ?? "",
          telefone: profileNovoAssinante?.celular ?? "",
          plano_tipo: assinatura.plano_tipo,
          valor_pago: Number(valorCentavosCard) / 100,
        }),
      });
      log("📣 n8n novo-assinante disparado (cartão)", { userId: assinatura.user_id, status: novoAssinanteRes.status });
    } catch (err) {
      log("⚠️ Erro ao notificar n8n novo-assinante (cartão, não crítico)", { userId: assinatura.user_id, error: String(err) });
    }
  }

  return ok({ processed: true, renewed: true, user_id: assinatura.user_id });
}

async function handleSubscriptionFailed(
  body: Record<string, unknown>,
  supabaseAdmin: AdminClient
) {
  const data = body?.data as Record<string, unknown> | undefined;
  const subscriptionId =
    (data?.subscription_id as string) ??
    ((data?.subscription as Record<string, unknown>)?.id as string) ??
    ((data?.invoice as Record<string, unknown>)?.subscription_id as string) ??
    null;

  const customerCodeFailed =
    ((data?.customer as Record<string, unknown>)?.code as string) ??
    ((data?.subscription as Record<string, unknown>)?.customer as Record<string, unknown>)?.code as string ??
    null;

  if (!subscriptionId && !customerCodeFailed) {
    log("payment_failed sem subscription_id e sem customer.code");
    return ok({ ignored: true });
  }

  let assinatura = subscriptionId
    ? await findAssinaturaBySubscription(supabaseAdmin, subscriptionId)
    : null;

  if (!assinatura && customerCodeFailed) {
    assinatura = await findAssinaturaByCustomerCode(supabaseAdmin, customerCodeFailed);
  }

  if (!assinatura) {
    return ok({ warning: "assinatura_nao_encontrada" });
  }

  const { error } = await supabaseAdmin
    .from("assinaturas")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("id", assinatura.id);

  if (error) throw new Error(`Erro past_due: ${error.message}`);

  // Notifica admin
  await supabaseAdmin.from("admin_notifications").insert({
    tipo: "pagamento_falhou",
    titulo: "Pagamento recorrente falhou",
    mensagem: `Pagar.me não conseguiu cobrar a assinatura ${assinatura.plano_tipo}`,
    dados: {
      user_id: assinatura.user_id,
      subscription_id: subscriptionId,
    },
  });

  log("⚠️ Pagamento recorrente falhou", {
    userId: assinatura.user_id,
    subscriptionId,
  });

  return ok({ processed: true, status: "past_due" });
}

async function handleSubscriptionCanceled(
  body: Record<string, unknown>,
  supabaseAdmin: AdminClient
) {
  const data = body?.data as Record<string, unknown> | undefined;
  const subscriptionId =
    ((data?.subscription as Record<string, unknown>)?.id as string) ??
    (data?.id as string) ??
    (data?.subscription_id as string) ??
    null;

  if (!subscriptionId) {
    return ok({ ignored: true });
  }

  const assinatura = await findAssinaturaBySubscription(
    supabaseAdmin,
    subscriptionId
  );
  if (!assinatura) {
    return ok({ warning: "assinatura_nao_encontrada" });
  }

  const { error } = await supabaseAdmin
    .from("assinaturas")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", assinatura.id);

  if (error) throw new Error(`Erro cancel: ${error.message}`);

  // Reseta purchase_event_id para que uma futura reassinatura conte como nova venda no Meta
  const { error: resetError } = await supabaseAdmin
    .from("profiles")
    .update({ purchase_event_id: null })
    .eq("user_id", assinatura.user_id);
  if (resetError) {
    log("⚠️ Erro ao resetar purchase_event_id (não crítico)", { userId: assinatura.user_id, error: resetError.message });
  }

  await supabaseAdmin.from("admin_notifications").insert({
    tipo: "cancelamento",
    titulo: "Assinatura cancelada",
    mensagem: `Usuário cancelou plano ${assinatura.plano_tipo}`,
    dados: {
      user_id: assinatura.user_id,
      subscription_id: subscriptionId,
    },
  });

  log("Assinatura cancelada", {
    userId: assinatura.user_id,
    subscriptionId,
  });

  return ok({ processed: true, status: "canceled" });
}

function ok(payload: Record<string, unknown>) {
  return new Response(JSON.stringify({ received: true, ...payload }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
