import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento de planoKey para priceId
const PLANO_TO_PRICE: Record<string, string> = {
  basico_mensal: "price_1TCTqfFu8jWFILvSyfTI73ff",
  intermediario_mensal: "price_1TCTrRFu8jWFILvSl50ZKqpy",
  profissional_mensal: "price_1TCTrnFu8jWFILvS4hBfmUiz",
  basico_anual: "price_1TCTszFu8jWFILvSLajvpW8A",
  intermediario_anual: "price_1TCTtTFu8jWFILvSwTuoRvm8",
  profissional_anual: "price_1TCTtxFu8jWFILvSZgjoxpX6",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-GUEST-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY não configurada");

    const { planoKey } = await req.json();
    logStep("Received request", { planoKey });

    if (!planoKey) {
      throw new Error("planoKey é obrigatório");
    }

    const priceId = PLANO_TO_PRICE[planoKey];
    if (!priceId) {
      throw new Error(`Plano inválido: ${planoKey}`);
    }
    logStep("Price ID resolved", { priceId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const origin = req.headers.get("origin") || "https://cmcmliokvmnahcazavwv.lovable.dev";

    // Criar sessão de checkout sem necessidade de autenticação
    // O email será coletado diretamente no Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      allow_promotion_codes: true,
      success_url: `${origin}/obrigado?session_id={CHECKOUT_SESSION_ID}&plano=${planoKey}`,
      cancel_url: `${origin}/#planos`,
      metadata: {
        plano_tipo: planoKey,
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
