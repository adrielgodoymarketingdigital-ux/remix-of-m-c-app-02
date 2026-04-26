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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

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
      trial_with_card: assinatura.trial_with_card,
      stripe_subscription_id: assinatura.stripe_subscription_id
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Verificar se é um trial com cartão (status trialing)
    const isTrialWithCard = assinatura.trial_with_card === true || assinatura.status === "trialing";

    // Se tem subscription no Stripe, cancelar
    if (assinatura.stripe_subscription_id && 
        assinatura.stripe_subscription_id.startsWith('sub_') &&
        !assinatura.stripe_subscription_id.startsWith('sub_trial_') &&
        !assinatura.stripe_subscription_id.startsWith('sub_demo_') &&
        !assinatura.stripe_subscription_id.startsWith('sub_pending_')) {
      try {
        logStep("Cancelling Stripe subscription", { subscriptionId: assinatura.stripe_subscription_id });
        
        // Cancelar imediatamente (não no final do período)
        await stripe.subscriptions.cancel(assinatura.stripe_subscription_id);
        logStep("Stripe subscription cancelled");
      } catch (stripeError: any) {
        logStep("Error cancelling Stripe subscription (may already be cancelled)", { error: stripeError.message });
        // Continuar mesmo se der erro no Stripe (pode já estar cancelada)
      }
    }

    // Atualizar assinatura no banco para demonstração/cancelada
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

    // Se era trial com cartão, marcar como cancelado
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

    // Criar notificação para admin
    await supabaseClient
      .from("admin_notifications")
      .insert({
        tipo: isTrialWithCard ? "trial_cancelado" : "cancelamento",
        titulo: isTrialWithCard ? "Trial cancelado pelo usuário" : "Assinatura cancelada",
        mensagem: isTrialWithCard 
          ? `Usuário ${user.email} cancelou o trial antes de converter`
          : `Usuário ${user.email} cancelou a assinatura`,
        dados: {
          user_id: user.id,
          email: user.email,
          plano_anterior: assinatura.plano_tipo,
          was_trial: isTrialWithCard,
        }
      });

    const message = isTrialWithCard
      ? "Trial cancelado com sucesso. Você pode assinar um plano quando quiser."
      : "Plano cancelado com sucesso. Você foi movido para o plano de demonstração.";

    return new Response(JSON.stringify({ 
      success: true, 
      message,
      was_trial: isTrialWithCard
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
