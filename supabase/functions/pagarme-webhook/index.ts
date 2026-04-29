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

async function findAssinaturaBySubscription(
  supabaseAdmin: AdminClient,
  subscriptionId: string
) {
  const { data } = await supabaseAdmin
    .from("assinaturas")
    .select("id, user_id, plano_tipo")
    .eq("pagarme_subscription_id", subscriptionId)
    .maybeSingle();
  return data as { id: string; user_id: string; plano_tipo: string } | null;
}

function calcularProximaCobranca(planoTipo: string): string {
  const isAnual = planoTipo.includes("anual");
  return new Date(
    Date.now() + (isAnual ? 365 : 30) * 24 * 60 * 60 * 1000
  ).toISOString();
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

    log("Evento recebido", { type: eventType, id: eventId });

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
    if (eventType !== "order.paid") {
      log("Evento ignorado", { type: eventType });
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const paidAt = charge?.paid_at || order.closed_at || new Date().toISOString();

    log("Order paga", { orderId, chargeId: charge?.id, paidAt });

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
      log("Pagamento não encontrado para order_id", { orderId });
      // Retorna 200 para Pagar.me não retentar
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

    // ── 4. Notificação admin ─────────────────────────────────────────
    await supabaseAdmin.from("admin_notifications").insert({
      tipo: "nova_assinatura_pix",
      titulo: "Nova assinatura via PIX!",
      mensagem: `Pagamento PIX confirmado para plano ${planoTipo}`,
      dados: {
        user_id: userId,
        plano_tipo: planoTipo,
        pagarme_order_id: orderId,
        valor_centavos: pagamento.valor_centavos,
      },
    });

    // 🔔 Push notification para admin sobre nova assinatura PIX (fire-and-forget)
    const planoNomes: Record<string, string> = {
      basico_mensal: "Básico Mensal", intermediario_mensal: "Intermediário Mensal",
      profissional_mensal: "Profissional Mensal", basico_anual: "Básico Anual",
      intermediario_anual: "Intermediário Anual", profissional_anual: "Profissional Anual",
    };
    const valorBRL = (pagamento.valor_centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // IMPORTANTE: usar await — fire-and-forget no Deno edge runtime pode ser
    // cancelado quando o handler retorna, perdendo a notificação push.
    try {
      const dispatchRes = await fetch(`${supabaseUrl}/functions/v1/notify-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          title: "💰 Nova assinatura!",
          body: `Plano ${planoNomes[planoTipo] || planoTipo} · R$ ${valorBRL} via PIX`,
          url: "/admin/financeiro",
          event_key: "nova_assinatura_pix",
          template_vars: {
            plano_nome: planoNomes[planoTipo] || planoTipo,
            valor: valorBRL,
            payment_method: "PIX",
          },
        }),
      });
      const dispatchBody = await dispatchRes.text();
      log("📣 notify-admin respondeu (PIX)", { status: dispatchRes.status, body: dispatchBody.substring(0, 200) });
    } catch (err) {
      log("⚠️ Erro ao disparar push admin", { error: String(err) });
    }

    log("✅ Webhook processado com sucesso", { userId, planoTipo, orderId });

    return new Response(
      JSON.stringify({ received: true, processed: true, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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

  if (!subscriptionId) {
    log("subscription.charged sem subscription_id — ignorando", { data });
    return ok({ ignored: true, reason: "no_subscription_id" });
  }

  const assinatura = await findAssinaturaBySubscription(
    supabaseAdmin,
    subscriptionId
  );
  if (!assinatura) {
    log("Assinatura local não encontrada", { subscriptionId });
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

  const { error } = await supabaseAdmin
    .from("assinaturas")
    .update({
      status: "active",
      data_fim: proximaCobranca,
      data_proxima_cobranca: proximaCobranca,
      updated_at: new Date().toISOString(),
    })
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

  // 🔔 Push admin: nova venda ou renovação por cartão
  try {
    const planoNomes: Record<string, string> = {
      basico_mensal: "Básico Mensal",
      intermediario_mensal: "Intermediário Mensal",
      profissional_mensal: "Profissional Mensal",
      basico_anual: "Básico Anual",
      intermediario_anual: "Intermediário Anual",
      profissional_anual: "Profissional Anual",
    };

    // Tentar extrair valor (em centavos) do payload
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

    const dispatchRes = await fetch(`${supabaseUrl}/functions/v1/notify-admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        title: "💰 Nova assinatura!",
        body: `Plano ${planoNomes[assinatura.plano_tipo] || assinatura.plano_tipo} · R$ ${valorBRL} via cartão`,
        url: "/admin/financeiro",
        event_key: "nova_assinatura_cartao",
        template_vars: {
          plano_nome: planoNomes[assinatura.plano_tipo] || assinatura.plano_tipo,
          valor: valorBRL,
          payment_method: "cartão",
        },
      }),
    });
    const dispatchBody = await dispatchRes.text();
    log("📣 notify-admin respondeu (cartão)", {
      status: dispatchRes.status,
      body: dispatchBody.substring(0, 200),
    });
  } catch (err) {
    log("⚠️ Erro ao disparar push admin (cartão)", { error: String(err) });
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

  if (!subscriptionId) {
    log("payment_failed sem subscription_id");
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
