import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGARME_API = "https://api.pagar.me/core/v5";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
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
    logStep("User authenticated", { userId: user.id });

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
      pagarme_subscription_id: assinatura.pagarme_subscription_id,
    });

    const isTrialWithCard = assinatura.trial_with_card === true || assinatura.status === "trialing";
    const provider = assinatura.payment_provider;

    // Cancelar na Pagar.me se houver subscription recorrente
    if (assinatura.pagarme_subscription_id) {
      const pagarmeKey = Deno.env.get("PAGARME_SECRET_KEY");
      if (!pagarmeKey) throw new Error("PAGARME_SECRET_KEY não configurada");
      const pagarmeAuth = `Basic ${btoa(`${pagarmeKey}:`)}`;

      logStep("Cancelando subscription na Pagar.me", {
        subscriptionId: assinatura.pagarme_subscription_id,
      });

      try {
        const res = await fetch(
          `${PAGARME_API}/subscriptions/${assinatura.pagarme_subscription_id}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: pagarmeAuth,
            },
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          logStep("Aviso: erro ao cancelar na Pagar.me (cancelando localmente)", {
            status: res.status,
            data,
          });
        } else {
          logStep("Subscription cancelada na Pagar.me");
        }
      } catch (pagarmeErr) {
        logStep("Aviso: exceção ao cancelar na Pagar.me (cancelando localmente)", {
          error: String(pagarmeErr),
        });
      }
    } else {
      // PIX ou acesso manual: cancela apenas localmente
      logStep("Sem pagarme_subscription_id — cancelamento local apenas", {
        provider: provider || "sem provedor",
      });
    }

    // Baixar plano no banco
    const updateData: Record<string, unknown> = {
      plano_tipo: "free",
      status: "active",
      pagarme_subscription_id: null,
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
        : `Usuário ${user.email} cancelou a assinatura (${provider || "sem provedor"})`,
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

    return new Response(
      JSON.stringify({ success: true, message, was_trial: isTrialWithCard }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
