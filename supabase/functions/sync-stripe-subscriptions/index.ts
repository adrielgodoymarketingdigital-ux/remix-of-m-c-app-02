import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Mapeamento de price IDs para plano_tipo (novos + legados)
const PRICE_TO_PLAN: Record<string, string> = {
  // Novos (conta atual)
  "price_1TCTqfFu8jWFILvSyfTI73ff": "basico_mensal",
  "price_1TCTrRFu8jWFILvSl50ZKqpy": "intermediario_mensal",
  "price_1TCTrnFu8jWFILvS4hBfmUiz": "profissional_mensal",
  "price_1TCTszFu8jWFILvSLajvpW8A": "basico_anual",
  "price_1TCTtTFu8jWFILvSwTuoRvm8": "intermediario_anual",
  "price_1TCTtxFu8jWFILvSZgjoxpX6": "profissional_anual",
  // Legados (conta anterior)
  "price_1SkxEACjA5c0MuV8VVfibyhD": "basico_mensal",
  "price_1SkxLbCjA5c0MuV8M6rYpYd6": "intermediario_mensal",
  "price_1SkxObCjA5c0MuV8G3OccySn": "profissional_mensal",
  "price_1SkxQnCjA5c0MuV8J0F7vf5m": "basico_anual",
  "price_1SkxRPCjA5c0MuV8cgcNtFsf": "intermediario_anual",
  "price_1SkxSACjA5c0MuV8u7U1zbhh": "profissional_anual",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[SYNC] Starting Stripe subscription sync...");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Admin access required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const results: any[] = [];

    // ========== PARTE 1: Cancelar subs órfãs (DB cancelado/free/demo/bloqueado) ==========
    const { data: orphaned, error: orphanedError } = await supabase
      .from("assinaturas")
      .select("user_id, plano_tipo, status, stripe_subscription_id, stripe_customer_id, bloqueado_admin")
      .not("stripe_subscription_id", "is", null)
      .not("stripe_subscription_id", "like", "sub_demo_%")
      .not("stripe_subscription_id", "like", "sub_trial_%")
      .not("stripe_subscription_id", "like", "sub_pending_%");

    if (orphanedError) throw new Error(`DB error: ${orphanedError.message}`);

    for (const sub of orphaned || []) {
      const shouldCheck =
        sub.status === "canceled" ||
        sub.plano_tipo === "demonstracao" ||
        sub.plano_tipo === "free" ||
        sub.bloqueado_admin === true;

      if (!shouldCheck) continue;

      console.log(`[SYNC] Checking ${sub.stripe_subscription_id} (${sub.plano_tipo}/${sub.status})`);

      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

        if (stripeSub.status === "active" || stripeSub.status === "trialing") {
          // Assinatura ATIVA no Stripe - verificar se o DB está errado (usuário rebaixado indevidamente)
          const priceId = stripeSub.items?.data?.[0]?.price?.id;
          const correctPlan = priceId ? PRICE_TO_PLAN[priceId] : null;

          if (correctPlan && (sub.plano_tipo === "free" || sub.plano_tipo === "demonstracao") && !sub.bloqueado_admin) {
            // Usuário tem sub ativa no Stripe mas foi rebaixado indevidamente - RESTAURAR
            const currentPeriodEnd = new Date((stripeSub as any).current_period_end * 1000).toISOString();
            console.log(`[SYNC] RESTORING ${sub.user_id} to ${correctPlan} (Stripe active, was wrongly set to ${sub.plano_tipo})`);
            
            await supabase
              .from("assinaturas")
              .update({
                plano_tipo: correctPlan,
                status: "active",
                stripe_price_id: priceId,
                data_proxima_cobranca: currentPeriodEnd,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", sub.user_id);

            results.push({
              user_id: sub.user_id,
              subscription_id: sub.stripe_subscription_id,
              action: "restored",
              restored_plan: correctPlan,
              stripe_status: stripeSub.status,
              next_billing: currentPeriodEnd,
            });
          } else if (sub.bloqueado_admin) {
            // Bloqueado por admin - cancelar no Stripe
            console.log(`[SYNC] Cancelling ${sub.stripe_subscription_id} (blocked by admin)`);
            await stripe.subscriptions.cancel(sub.stripe_subscription_id);
            await supabase
              .from("assinaturas")
              .update({ stripe_subscription_id: null, stripe_price_id: null, updated_at: new Date().toISOString() })
              .eq("user_id", sub.user_id);
            results.push({ user_id: sub.user_id, subscription_id: sub.stripe_subscription_id, action: "canceled_blocked", stripe_status_was: stripeSub.status });
          } else if (sub.status === "canceled") {
            // Status canceled no DB mas ativo no Stripe - cancelar no Stripe
            console.log(`[SYNC] Cancelling ${sub.stripe_subscription_id} (DB status canceled)`);
            await stripe.subscriptions.cancel(sub.stripe_subscription_id);
            await supabase
              .from("assinaturas")
              .update({ stripe_subscription_id: null, stripe_price_id: null, updated_at: new Date().toISOString() })
              .eq("user_id", sub.user_id);
            results.push({ user_id: sub.user_id, subscription_id: sub.stripe_subscription_id, action: "canceled", stripe_status_was: stripeSub.status, db_status: sub.status });
          }
        } else {
          // Stripe sub não está ativa - limpar referência do DB
          await supabase
            .from("assinaturas")
            .update({ stripe_subscription_id: null, stripe_price_id: null, updated_at: new Date().toISOString() })
            .eq("user_id", sub.user_id);
          results.push({ user_id: sub.user_id, subscription_id: sub.stripe_subscription_id, action: "db_cleaned", stripe_status_was: stripeSub.status });
        }
      } catch (stripeErr: any) {
        console.log(`[SYNC] Error with ${sub.stripe_subscription_id}: ${stripeErr.message}`);
        results.push({ user_id: sub.user_id, subscription_id: sub.stripe_subscription_id, action: "error", error: stripeErr.message });
      }
    }

    // ========== PARTE 2: Detectar e cancelar subscriptions DUPLICADAS por customer no Stripe ==========
    console.log("[SYNC] Checking for duplicate subscriptions per customer...");

    const [activeSubs, trialingSubs] = await Promise.all([
      stripe.subscriptions.list({ status: "active", limit: 100, expand: ["data.items.data.price"] }),
      stripe.subscriptions.list({ status: "trialing", limit: 100, expand: ["data.items.data.price"] }),
    ]);

    const allSubs = [...activeSubs.data, ...trialingSubs.data];

    // Agrupar por customer
    const customerSubs: Record<string, typeof allSubs> = {};
    for (const sub of allSubs) {
      const custId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
      if (!customerSubs[custId]) customerSubs[custId] = [];
      customerSubs[custId].push(sub);
    }

    // Para cada customer com mais de 1 sub, manter a de maior valor e cancelar as demais
    for (const [custId, subs] of Object.entries(customerSubs)) {
      if (subs.length <= 1) continue;

      console.log(`[SYNC] Customer ${custId} has ${subs.length} active subs - deduplicating`);

      // Calcular valor mensal de cada sub
      const subsWithValue = subs.map(sub => {
        let monthly = 0;
        for (const item of sub.items.data) {
          const price = item.price;
          if (price?.unit_amount) {
            if (price.recurring?.interval === "month") {
              monthly += (price.unit_amount / 100) * (item.quantity || 1);
            } else if (price.recurring?.interval === "year") {
              monthly += ((price.unit_amount / 100) / 12) * (item.quantity || 1);
            }
          }
        }
        return { sub, monthly };
      });

      // Ordenar: maior valor primeiro
      subsWithValue.sort((a, b) => b.monthly - a.monthly);

      const keeper = subsWithValue[0];
      const toCancel = subsWithValue.slice(1);

      for (const { sub: dupSub, monthly } of toCancel) {
        try {
          console.log(`[SYNC] Cancelling duplicate ${dupSub.id} (value: ${monthly.toFixed(2)}/mo), keeping ${keeper.sub.id} (value: ${keeper.monthly.toFixed(2)}/mo)`);
          await stripe.subscriptions.cancel(dupSub.id);
          results.push({
            customer_id: custId,
            subscription_id: dupSub.id,
            action: "duplicate_canceled",
            monthly_value: monthly,
            kept_subscription: keeper.sub.id,
            kept_value: keeper.monthly,
          });
        } catch (err: any) {
          console.log(`[SYNC] Error cancelling duplicate ${dupSub.id}: ${err.message}`);
          results.push({
            customer_id: custId,
            subscription_id: dupSub.id,
            action: "duplicate_cancel_error",
            error: err.message,
          });
        }
      }
    }

    console.log(`[SYNC] Done. Processed ${results.length} items.`);

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[SYNC] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
