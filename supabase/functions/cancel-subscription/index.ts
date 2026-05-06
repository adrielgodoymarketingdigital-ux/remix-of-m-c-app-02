import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Buscar assinatura do usuário
    const { data: assinatura, error: assinaturaError } = await supabaseClient
      .from("assinaturas")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (assinaturaError || !assinatura) {
      throw new Error("Assinatura não encontrada");
    }
    logStep("Subscription found", {
      plano_tipo: assinatura.plano_tipo,
      status: assinatura.status,
      payment_provider: assinatura.payment_provider,
      trial_with_card: assinatura.trial_with_card,
      stripe_subscription_id: assinatura.stripe_subscription_id,
    });

    const isTrialWithCard = assinatura.trial_with_card === true || assinatura.status === "trialing";
    const provider = assinatura.payment_provider;

    // Cancelar no Stripe apenas se a assinatura for do Stripe com subscription real
    const hasRealStripeSubscription = assinatura.stripe_subscription_id &&
      assinatura.stripe_subscription_id.startsWith('sub_') &&
      !assinatura.stripe_subscription_id.startsWith('sub_trial_') &&
      !assinatura.stripe_subscription_id.startsWith('sub_demo_') &&
      !assinatura.stripe_subscription_id.startsWith('sub_pending_');

    if (hasRealStripeSubscription) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

      try {
        logStep("Cancelling Stripe subscription", { subscriptionId: assinatura.stripe_subscription_id });
        await stripe.subscriptions.cancel(assinatura.stripe_subscription_id);
        logStep("Stripe subscription cancelled");
      } catch (stripeError: any) {
        logStep("Error cancelling Stripe subscription (may already be cancelled)", { error: stripeError.message });
      }
    } else if (provider === "ticto") {
      // Ticto: cancelamento é feito manualmente no painel da Ticto.
      // Aqui apenas baixamos o plano no banco.
      logStep("Ticto subscription — cancelling locally only (no Ticto API)");
    } else if (provider === "pagarme") {
      // Pagar.me: cancelamento é gerenciado pelo componente GerenciarAssinaturaPagarme.
      // Este endpoint não deve ser chamado para assinaturas Pagar.me.
      logStep("Pagarme subscription — should use pagarme cancel endpoint");
      throw new Error("Use o painel de gerenciamento do Pagar.me para cancelar esta assinatura.");
    } else {
      logStep("No external subscription to cancel, updating DB only");
    }

    // Baixar plano no banco
    const updateData: any = {
      plano_tipo: "free",
      status: "active",
      stripe_subscription_id: null,
      stripe_price_id: null,
      stripe_customer_id: null,
      data_fim: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      trial_with_card: false,
    };

    if (isTrialWithCard) {
      updateData.trial_canceled = true;
      updateData.trial_canceled_at = new Date().toISOString();
      logStep("Marking trial as canceled");
    }

    const { error: updateError } = await supabaseClient
      .from("assinaturas")
      .update(updateData)
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(`Erro ao atualizar assinatura: ${updateError.message}`);
    }
    logStep("Subscription updated to free/active");

    await supabaseClient.from("admin_notifications").insert({
      tipo: isTrialWithCard ? "trial_cancelado" : "cancelamento",
      titulo: isTrialWithCard ? "Trial cancelado pelo usuário" : "Assinatura cancelada",
      mensagem: isTrialWithCard
        ? `Usuário ${user.email} cancelou o trial antes de converter`
        : `Usuário ${user.email} cancelou a assinatura (${provider || 'sem provedor'})`,
      dados: {
        user_id: user.id,
        email: user.email,
        plano_anterior: assinatura.plano_tipo,
        payment_provider: provider,
        was_trial: isTrialWithCard,
      },
    });

    const message = isTrialWithCard
      ? "Trial cancelado com sucesso. Você pode assinar um plano quando quiser."
      : "Plano cancelado com sucesso. Você foi movido para o plano gratuito.";

    return new Response(JSON.stringify({
      success: true,
      message,
      was_trial: isTrialWithCard,
    }), {
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
