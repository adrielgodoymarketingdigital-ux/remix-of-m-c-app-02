import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRICE_TO_PLANO_MAP: Record<string, string> = {
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
  console.log(`[${timestamp}] [CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  logStep("🔍 Iniciando verificação de assinatura");

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("❌ STRIPE_SECRET_KEY não configurada");
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("❌ Authorization header ausente");
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) {
      logStep("❌ Erro de autenticação", { error: userError.message });
      throw new Error(`Authentication error: ${userError.message}`);
    }
    
    const user = userData.user;
    if (!user?.email) {
      logStep("❌ Usuário não autenticado ou email indisponível");
      throw new Error("User not authenticated or email not available");
    }

    logStep("✅ Usuário autenticado", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Buscar cliente no Stripe pelo email
    logStep("🔍 Buscando cliente no Stripe");
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("⚠️ Nenhum cliente encontrado no Stripe para este email");

      const { data: currentSub } = await supabaseClient
        .from("assinaturas")
        .select("plano_tipo, status, stripe_subscription_id, data_fim, data_proxima_cobranca, payment_provider")
        .eq("user_id", user.id)
        .single();

      const planosProtegidos = ["admin", "free"];
      const isAcessoManual = currentSub && currentSub.status === "active" && !currentSub.stripe_subscription_id;

      // Verificar se data_fim ainda não expirou (pagamento via Ticto/boleto)
      // Carência de 1 dia: a Ticto não libera renovação no mesmo dia do vencimento
      const now = new Date();
      const GRACE_MS = 24 * 60 * 60 * 1000; // 1 dia de carência
      const dataFimValida = currentSub?.data_fim && (new Date(currentSub.data_fim).getTime() + GRACE_MS) > now.getTime();
      const dataProximaCobrancaValida = currentSub?.data_proxima_cobranca && (new Date(currentSub.data_proxima_cobranca).getTime() + GRACE_MS) > now.getTime();
      const acessoVigenteLocal = dataFimValida || dataProximaCobrancaValida;

      if (acessoVigenteLocal && currentSub.status === "active" && !planosProtegidos.includes(currentSub.plano_tipo) && currentSub.plano_tipo !== "demonstracao") {
        logStep("✅ Acesso vigente por data local (Ticto/boleto), mantendo status atual", {
          plano: currentSub.plano_tipo,
          data_fim: currentSub.data_fim,
          data_proxima_cobranca: currentSub.data_proxima_cobranca,
          payment_provider: currentSub.payment_provider,
        });

        const duration = Date.now() - startTime;
        logStep(`⏱️ Tempo total: ${duration}ms`);

        return new Response(JSON.stringify({
          subscribed: true,
          plano_tipo: currentSub.plano_tipo,
          message: "Acesso vigente por período local",
          synced: false,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      if (isAcessoManual) {
        logStep("✅ Acesso manual detectado sem vínculo no Stripe, mantendo status atual", {
          plano: currentSub.plano_tipo,
        });

        const duration = Date.now() - startTime;
        logStep(`⏱️ Tempo total: ${duration}ms`);

        return new Response(JSON.stringify({
          subscribed: true,
          plano_tipo: currentSub.plano_tipo,
          message: "Acesso concedido manualmente",
          synced: false,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      let synced = false;
      if (
        currentSub &&
        !planosProtegidos.includes(currentSub.plano_tipo) &&
        (currentSub.plano_tipo !== "demonstracao" || currentSub.status !== "canceled")
      ) {
        logStep("🔄 Nenhum cliente no Stripe: rebaixando assinatura local");

        const { error: downgradeError } = await supabaseClient
          .from("assinaturas")
          .update({
            plano_tipo: "demonstracao",
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        if (downgradeError) {
          logStep("❌ Erro ao rebaixar assinatura local", { error: downgradeError.message });
        } else {
          synced = true;
          logStep("✅ Assinatura local rebaixada com sucesso");
        }
      } else if (currentSub && planosProtegidos.includes(currentSub.plano_tipo)) {
        logStep("✅ Plano protegido detectado, mantendo status atual", { plano: currentSub.plano_tipo });
      }

      const duration = Date.now() - startTime;
      logStep(`⏱️ Tempo total: ${duration}ms`);

      return new Response(JSON.stringify({
        subscribed: false,
        plano_tipo: currentSub?.plano_tipo || "demonstracao",
        message: "Nenhum cliente encontrado no Stripe",
        synced,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("✅ Cliente encontrado no Stripe", { customerId });

    // Buscar assinaturas ativas (incluindo trialing e incomplete para boletos pendentes)
    logStep("🔍 Buscando assinaturas ativas e em trial");
    const [activeSubscriptions, trialingSubs, incompleteSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
      stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 }),
      stripe.subscriptions.list({ customer: customerId, status: "incomplete", limit: 5 }),
    ]);

    // Combinar active + trialing (prioridade para active)
    if (activeSubscriptions.data.length === 0 && trialingSubs.data.length > 0) {
      activeSubscriptions.data.push(...trialingSubs.data);
    }

    // Verificar se alguma subscription incomplete teve pagamento confirmado
    for (const incSub of incompleteSubs.data) {
      try {
        const latestInvoiceId = typeof incSub.latest_invoice === 'string' 
          ? incSub.latest_invoice 
          : incSub.latest_invoice?.id;
        
        if (latestInvoiceId) {
          const invoice = await stripe.invoices.retrieve(latestInvoiceId);
          if (invoice.status === 'paid') {
            logStep("🔄 Subscription incomplete com pagamento confirmado, ativando", {
              subId: incSub.id,
              invoiceId: latestInvoiceId,
            });
            // Pagamento confirmado mas subscription ficou incomplete - tentar ativar
            // O Stripe deve fazer isso automaticamente, mas se não fez, registrar
            activeSubscriptions.data.push(incSub);
          }
        }
      } catch (invoiceErr) {
        logStep("⚠️ Erro ao verificar invoice de subscription incomplete", { 
          subId: incSub.id, 
          error: String(invoiceErr) 
        });
      }
    }

    const subscriptions = activeSubscriptions;

    if (subscriptions.data.length === 0) {
      logStep("⚠️ Nenhuma assinatura ativa encontrada");
      
      // Verificar se precisa atualizar DB para demonstracao
      const { data: currentSub } = await supabaseClient
        .from("assinaturas")
        .select("plano_tipo, status, stripe_subscription_id, data_fim, data_proxima_cobranca, payment_provider")
        .eq("user_id", user.id)
        .single();

      // Não sobrescrever planos que não dependem do Stripe (admin, free)
      // Também proteger planos ativos concedidos manualmente (sem stripe_subscription_id)
      const planosProtegidos = ["admin", "free"];
      
      // Verificar se data_fim ainda não expirou (pagamento via Ticto/boleto) com 1 dia de carência
      const nowCheck = new Date();
      const GRACE_MS_CHECK = 24 * 60 * 60 * 1000;
      const dataFimValidaCheck = currentSub?.data_fim && (new Date(currentSub.data_fim).getTime() + GRACE_MS_CHECK) > nowCheck.getTime();
      const dataProximaCobrancaValidaCheck = currentSub?.data_proxima_cobranca && (new Date(currentSub.data_proxima_cobranca).getTime() + GRACE_MS_CHECK) > nowCheck.getTime();
      const acessoVigenteLocalCheck = dataFimValidaCheck || dataProximaCobrancaValidaCheck;

      if (acessoVigenteLocalCheck && currentSub.status === "active" && !planosProtegidos.includes(currentSub.plano_tipo) && currentSub.plano_tipo !== "demonstracao") {
        logStep("✅ Acesso vigente por data local (Ticto/boleto), mantendo status atual", {
          plano: currentSub.plano_tipo,
          data_fim: currentSub.data_fim,
          data_proxima_cobranca: currentSub.data_proxima_cobranca,
        });
        const duration = Date.now() - startTime;
        logStep(`⏱️ Tempo total: ${duration}ms`);
        return new Response(JSON.stringify({ 
          subscribed: true, 
          plano_tipo: currentSub.plano_tipo,
          message: "Acesso vigente por período local",
          synced: false
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const isAcessoManual = currentSub && currentSub.status === "active" && !currentSub.stripe_subscription_id;
      if (isAcessoManual) {
        logStep("✅ Acesso manual detectado (sem stripe_subscription_id), mantendo status atual", { plano: currentSub.plano_tipo });
        const duration = Date.now() - startTime;
        logStep(`⏱️ Tempo total: ${duration}ms`);
        return new Response(JSON.stringify({ 
          subscribed: true, 
          plano_tipo: currentSub.plano_tipo,
          message: "Acesso concedido manualmente",
          synced: false
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else if (currentSub && !planosProtegidos.includes(currentSub.plano_tipo) && 
          (currentSub.plano_tipo !== "demonstracao" || currentSub.status !== "canceled")) {
        logStep("🔄 Atualizando DB para demonstração");
        await supabaseClient
          .from("assinaturas")
          .update({ 
            plano_tipo: "demonstracao", 
            status: "canceled",
            updated_at: new Date().toISOString()
          })
          .eq("user_id", user.id);
      } else if (currentSub && planosProtegidos.includes(currentSub.plano_tipo)) {
        logStep("✅ Plano protegido detectado, mantendo status atual", { plano: currentSub.plano_tipo });
      }

      const duration = Date.now() - startTime;
      logStep(`⏱️ Tempo total: ${duration}ms`);

      return new Response(JSON.stringify({ 
        subscribed: false, 
        plano_tipo: currentSub?.plano_tipo || "demonstracao",
        message: "Nenhuma assinatura ativa",
        synced: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0].price.id;
    const planoTipo = PRICE_TO_PLANO_MAP[priceId] || "demonstracao";
    
    // ✅ FIX: Buscar timestamps do top-level OU dos items (API basil move para items)
    const currentPeriodEnd = subscription.current_period_end 
      ?? subscription.items?.data?.[0]?.current_period_end 
      ?? null;
    const currentPeriodStart = subscription.current_period_start 
      ?? subscription.items?.data?.[0]?.current_period_start 
      ?? null;
    
    const subscriptionEnd = currentPeriodEnd 
      ? new Date(currentPeriodEnd * 1000).toISOString() 
      : null;
    
    const dataInicio = currentPeriodStart 
      ? new Date(currentPeriodStart * 1000).toISOString() 
      : new Date().toISOString();

    logStep("✅ Assinatura ativa encontrada", { 
      subscriptionId: subscription.id, 
      priceId, 
      planoTipo,
      subscriptionEnd,
      currentPeriodEnd,
      currentPeriodStart
    });

    // Verificar se o DB está atualizado
    const { data: dbSub, error: dbError } = await supabaseClient
      .from("assinaturas")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (dbError && dbError.code !== "PGRST116") {
      logStep("❌ Erro ao buscar assinatura no DB", { error: dbError });
    }

    // Se o plano no DB não corresponde ao Stripe, atualizar TODOS os campos
    const needsSync = !dbSub || 
      dbSub.plano_tipo !== planoTipo || 
      dbSub.status !== "active" ||
      dbSub.stripe_subscription_id !== subscription.id ||
      dbSub.stripe_customer_id !== customerId;

    if (needsSync) {
      logStep("🔄 Sincronizando assinatura no DB", {
        dbPlano: dbSub?.plano_tipo,
        stripePlano: planoTipo,
        dbStatus: dbSub?.status,
        dbSubId: dbSub?.stripe_subscription_id,
        stripeSubId: subscription.id
      });

      const upsertData: Record<string, any> = {
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        plano_tipo: planoTipo,
        status: "active",
        data_inicio: dataInicio,
        updated_at: new Date().toISOString(),
      };

      // Só incluir data_proxima_cobranca se existir
      if (subscriptionEnd) {
        upsertData.data_proxima_cobranca = subscriptionEnd;
      }

      const { error: upsertError } = await supabaseClient.from("assinaturas").upsert(
        upsertData,
        { onConflict: "user_id" }
      );

      if (upsertError) {
        logStep("❌ Erro ao atualizar DB", { error: upsertError });
      } else {
        logStep("✅ DB sincronizado com sucesso!");
      }
    } else {
      logStep("✅ DB já está sincronizado com Stripe");
    }

    const duration = Date.now() - startTime;
    logStep(`⏱️ Tempo total: ${duration}ms`);

    return new Response(JSON.stringify({
      subscribed: true,
      plano_tipo: planoTipo,
      subscription_end: subscriptionEnd,
      stripe_subscription_id: subscription.id,
      synced: needsSync
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;
    logStep(`❌ ERRO (${duration}ms)`, { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
