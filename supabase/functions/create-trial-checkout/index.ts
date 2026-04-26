import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

const stripe = new Stripe(STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
);

// Mapeamento de planos para Price IDs
const PLANO_TO_PRICE: Record<string, string> = {
  basico_mensal: "price_1TCTqfFu8jWFILvSyfTI73ff",
  intermediario_mensal: "price_1TCTrRFu8jWFILvSl50ZKqpy",
  profissional_mensal: "price_1TCTrnFu8jWFILvS4hBfmUiz",
  basico_anual: "price_1TCTszFu8jWFILvSLajvpW8A",
  intermediario_anual: "price_1TCTtTFu8jWFILvSwTuoRvm8",
  profissional_anual: "price_1TCTtxFu8jWFILvSZgjoxpX6",
};

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[${timestamp}] [CREATE-TRIAL-CHECKOUT] ${step}${detailsStr}\n`);
};

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user?.email) {
      throw new Error("User not authenticated or email not available");
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const body = await req.json();
    const {
      planoTipo,
      fbp,
      fbc,
      fbclid,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      client_user_agent,
    } = body;

    logStep("Request body parsed", { planoTipo });

    // Validate planoTipo
    const priceId = PLANO_TO_PRICE[planoTipo];
    if (!priceId) {
      throw new Error(`Invalid plano tipo: ${planoTipo}`);
    }

    logStep("Price ID resolved", { planoTipo, priceId });

    // Check if customer already exists in Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      // Create new customer
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = newCustomer.id;
      logStep("New customer created", { customerId });
    }

    // Build metadata for tracking
    const metadata: Record<string, string> = {
      plano_tipo: planoTipo,
      supabase_user_id: user.id,
      trial_signup: "true",
    };

    // Add tracking params if present
    if (fbp) metadata.fbp = fbp;
    if (fbc) metadata.fbc = fbc;
    if (fbclid) metadata.fbclid = fbclid;
    if (utm_source) metadata.utm_source = utm_source;
    if (utm_medium) metadata.utm_medium = utm_medium;
    if (utm_campaign) metadata.utm_campaign = utm_campaign;
    if (utm_content) metadata.utm_content = utm_content;
    if (utm_term) metadata.utm_term = utm_term;
    if (client_user_agent) metadata.client_user_agent = client_user_agent;

    // Get client IP from request headers
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     req.headers.get("cf-connecting-ip") ||
                     req.headers.get("x-real-ip");
    if (clientIp) metadata.client_ip = clientIp;

    logStep("Creating checkout session with 7-day trial", { priceId, customerId, metadata });

    const origin = req.headers.get("origin") || "https://mecapp.lovable.app";

    // Create checkout session with 7-day trial
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          supabase_user_id: user.id,
          trial_signup: "true",
        },
      },
      payment_method_collection: "always", // Always require card
      metadata: metadata,
      success_url: `${origin}/onboarding-inicial?trial=true&plan=${planoTipo}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/ativar-trial?canceled=true&plan=${planoTipo}`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      locale: "pt-BR",
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

Deno.serve(handler);
