import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento de planoTipo para priceId (nova conta Stripe)
const PLANO_TO_PRICE: Record<string, string> = {
  "basico_mensal": "price_1TCTqfFu8jWFILvSyfTI73ff",
  "intermediario_mensal": "price_1TCTrRFu8jWFILvSl50ZKqpy",
  "profissional_mensal": "price_1TCTrnFu8jWFILvS4hBfmUiz",
  "basico_anual": "price_1TCTszFu8jWFILvSLajvpW8A",
  "intermediario_anual": "price_1TCTtTFu8jWFILvSwTuoRvm8",
  "profissional_anual": "price_1TCTtxFu8jWFILvSZgjoxpX6",
};

// Mapeamento reverso de priceId para planoTipo (inclui novos + legados)
const PRICE_TO_PLANO: Record<string, string> = {
  // Novos IDs
  "price_1TCTqfFu8jWFILvSyfTI73ff": "basico_mensal",
  "price_1TCTrRFu8jWFILvSl50ZKqpy": "intermediario_mensal",
  "price_1TCTrnFu8jWFILvS4hBfmUiz": "profissional_mensal",
  "price_1TCTszFu8jWFILvSLajvpW8A": "basico_anual",
  "price_1TCTtTFu8jWFILvSwTuoRvm8": "intermediario_anual",
  "price_1TCTtxFu8jWFILvSZgjoxpX6": "profissional_anual",
  // Legados
  "price_1SkxEACjA5c0MuV8VVfibyhD": "basico_mensal",
  "price_1SkxLbCjA5c0MuV8M6rYpYd6": "intermediario_mensal",
  "price_1SkxObCjA5c0MuV8G3OccySn": "profissional_mensal",
  "price_1SkxQnCjA5c0MuV8J0F7vf5m": "basico_anual",
  "price_1SkxRPCjA5c0MuV8cgcNtFsf": "intermediario_anual",
  "price_1SkxSNCjA5c0MuV8yJ5ZLr7o": "profissional_anual",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Função iniciada", { 
      origin: req.headers.get("origin"),
      hasAuth: !!req.headers.get("Authorization")
    });
    
    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERRO: Authorization header ausente");
      throw new Error("Sessão expirada. Por favor, faça login novamente.");
    }
    logStep("Authorization header presente");
    
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError) {
      logStep("ERRO: Falha na autenticação", { error: authError.message });
      throw new Error(`Sessão inválida. Por favor, faça login novamente.`);
    }
    
    const user = data.user;
    if (!user?.email) {
      logStep("ERRO: Usuário sem email");
      throw new Error("Usuário não autenticado ou email não disponível");
    }
    logStep("Usuário autenticado", { userId: user.id, emailPrefix: user.email?.substring(0, 5) + "***" });

    // Ler body da requisição
    let body;
    try {
      body = await req.json();
      logStep("Body recebido", body);
    } catch (parseError) {
      logStep("Erro ao parsear body", { error: String(parseError) });
      throw new Error("Erro ao parsear body da requisição");
    }

    const { 
      priceId: priceIdRecebido, 
      planoTipo: planoTipoRecebido, 
      cupomCodigo,
      fbp, fbc, fbclid,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      client_user_agent
    } = body || {};
    
    // Derivar priceId do planoTipo se não fornecido
    let priceId = priceIdRecebido;
    let planoTipo = planoTipoRecebido;
    
    if (!priceId && planoTipoRecebido) {
      priceId = PLANO_TO_PRICE[planoTipoRecebido];
      logStep("priceId derivado do planoTipo", { planoTipo: planoTipoRecebido, priceId });
    }
    
    if (!priceId) {
      logStep("priceId não encontrado", { body });
      throw new Error("priceId ou planoTipo não foi fornecido");
    }

    if (!planoTipo) {
      planoTipo = PRICE_TO_PLANO[priceId];
    }
    
    if (!planoTipo) {
      logStep("planoTipo não pôde ser determinado", { priceId, planoTipoRecebido });
      throw new Error(`Não foi possível determinar o tipo de plano para priceId: ${priceId}`);
    }

    logStep("Parâmetros validados", { priceId, planoTipo, cupomCodigo });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY não configurada");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Verificar se cliente já existe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Cliente Stripe existente", { customerId });
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      logStep("Cliente Stripe criado", { customerId });
    }

    // ✅ BUSCAR TODAS as subscriptions ativas e trialing do customer (limit: 100)
    const [activeSubs, trialingSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "active", limit: 100 }),
      stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 100 }),
    ]);

    const allActiveSubs = [...activeSubs.data, ...trialingSubs.data];
    logStep("🔍 Subscriptions encontradas", {
      active: activeSubs.data.length,
      trialing: trialingSubs.data.length,
      total: allActiveSubs.length,
    });

    if (allActiveSubs.length > 0) {
      // Verificar se alguma já tem o mesmo priceId
      const samePriceSub = allActiveSubs.find(
        sub => sub.items.data[0].price.id === priceId
      );
      if (samePriceSub) {
        logStep("ℹ️ Usuário já está neste plano");
        return new Response(JSON.stringify({
          alreadySubscribed: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Escolher a subscription principal (a mais recente ou a de maior valor)
      const primarySub = allActiveSubs[0];
      const extraSubs = allActiveSubs.slice(1);

      logStep("🔄 Fazendo upgrade/downgrade na subscription principal", {
        primarySubId: primarySub.id,
        currentPriceId: primarySub.items.data[0].price.id,
        newPriceId: priceId,
        extraSubsToCancel: extraSubs.length,
      });

      // Atualizar a subscription principal
      const updatedSubscription = await stripe.subscriptions.update(primarySub.id, {
        items: [
          {
            id: primarySub.items.data[0].id,
            price: priceId,
          },
        ],
        proration_behavior: "create_prorations",
        metadata: {
          user_id: user.id,
          plano_tipo: planoTipo,
        },
      });

      // Cancelar TODAS as subscriptions extras (duplicatas)
      for (const extra of extraSubs) {
        try {
          logStep("🗑️ Cancelando subscription duplicada", { subId: extra.id, priceId: extra.items.data[0].price.id });
          await stripe.subscriptions.cancel(extra.id);
        } catch (cancelErr: any) {
          logStep("⚠️ Erro ao cancelar subscription duplicada", { subId: extra.id, error: cancelErr.message });
        }
      }

      logStep("✅ Upgrade concluído", {
        subscriptionId: updatedSubscription.id,
        newPriceId: priceId,
        newPlanoTipo: planoTipo,
        canceledDuplicates: extraSubs.length,
      });

      return new Response(JSON.stringify({ 
        success: true,
        upgraded: true,
        subscriptionId: updatedSubscription.id,
        planoTipo: planoTipo,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ✅ NENHUMA ASSINATURA ATIVA - CRIAR NOVA VIA CHECKOUT
    logStep("📦 Nenhuma assinatura ativa, criando checkout session");

    const origin = req.headers.get("origin") || "https://appmec.in";
    
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") ||
                     req.headers.get("x-real-ip") || "";

    const trackingMetadata: Record<string, string> = {
      user_id: user.id,
      plano_tipo: planoTipo,
    };

    if (cupomCodigo) trackingMetadata.cupom_codigo = cupomCodigo;
    if (fbp) trackingMetadata.fbp = fbp;
    if (fbc) trackingMetadata.fbc = fbc;
    if (fbclid) trackingMetadata.fbclid = fbclid;
    if (utm_source) trackingMetadata.utm_source = utm_source;
    if (utm_medium) trackingMetadata.utm_medium = utm_medium;
    if (utm_campaign) trackingMetadata.utm_campaign = utm_campaign;
    if (utm_content) trackingMetadata.utm_content = utm_content;
    if (utm_term) trackingMetadata.utm_term = utm_term;
    if (client_user_agent) trackingMetadata.client_user_agent = client_user_agent;
    if (clientIp) trackingMetadata.client_ip = clientIp;

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      success_url: `${origin}/obrigado?plan=${planoTipo}`,
      cancel_url: `${origin}/plano?canceled=true`,
      metadata: trackingMetadata,
      payment_method_types: ["card", "boleto"],
      payment_method_options: {
        boleto: {
          expires_after_days: 5,
        },
      },
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    logStep("Sessão criada com sucesso", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERRO", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
