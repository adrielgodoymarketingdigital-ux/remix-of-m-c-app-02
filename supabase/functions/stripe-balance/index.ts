import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🏦 Iniciando busca de saldo Stripe...");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autorização não fornecido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Acesso negado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "STRIPE_SECRET_KEY não configurada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

    // Fetch balance, transactions, payouts and ALL subscription statuses in parallel
    const [balance, balanceTransactions, payouts, activeSubscriptions, trialingSubscriptions, pastDueSubscriptions, incompleteSubscriptions] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.balanceTransactions.list({ limit: 200 }),
      stripe.payouts.list({ limit: 5, status: "pending" }),
      stripe.subscriptions.list({ status: "active", limit: 100, expand: ["data.items.data.price", "data.customer"] }),
      stripe.subscriptions.list({ status: "trialing", limit: 100, expand: ["data.items.data.price", "data.customer"] }),
      stripe.subscriptions.list({ status: "past_due", limit: 100, expand: ["data.items.data.price", "data.customer"] }),
      stripe.subscriptions.list({ status: "incomplete", limit: 100, expand: ["data.items.data.price", "data.customer"] }),
    ]);

    // Process balance
    const availableBRL = balance.available.find((b) => b.currency === "brl");
    const pendingBRL = balance.pending.find((b) => b.currency === "brl");
    const available = availableBRL ? availableBRL.amount / 100 : 0;
    const pending = pendingBRL ? pendingBRL.amount / 100 : 0;
    const total = available + pending;

    // Pending by date — only future/today dates (already released dates should not appear)
    const todayStr = new Date().toISOString().split("T")[0];
    const availabilityByDate: Record<string, number> = {};
    for (const txn of balanceTransactions.data) {
      if (txn.available_on && txn.currency === "brl") {
        const dateKey = new Date(txn.available_on * 1000).toISOString().split("T")[0];
        // Only include dates from today onwards (past dates were already released to available)
        if (dateKey >= todayStr) {
          availabilityByDate[dateKey] = (availabilityByDate[dateKey] || 0) + txn.net / 100;
        }
      }
    }

    // Filter out dates with zero or negative net (refunds that zeroed out)
    const pendingByDate = Object.entries(availabilityByDate)
      .filter(([, amount]) => amount > 0)
      .map(([date, amount]) => ({
        date,
        amount,
        formatted_date: new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const nextPayout = payouts.data[0];
    let nextPayoutInfo = null;
    if (nextPayout) {
      nextPayoutInfo = {
        amount: nextPayout.amount / 100,
        arrival_date: new Date(nextPayout.arrival_date * 1000).toISOString(),
        status: nextPayout.status,
      };
    }

    // Price to plan mapping
    const priceToPlano: Record<string, string> = {
      // Novos IDs (nova conta Stripe)
      "price_1TCTqfFu8jWFILvSyfTI73ff": "basico_mensal",
      "price_1TCTrRFu8jWFILvSl50ZKqpy": "intermediario_mensal",
      "price_1TCTrnFu8jWFILvS4hBfmUiz": "profissional_mensal",
      "price_1TCTszFu8jWFILvSLajvpW8A": "basico_anual",
      "price_1TCTtTFu8jWFILvSwTuoRvm8": "intermediario_anual",
      "price_1TCTtxFu8jWFILvSZgjoxpX6": "profissional_anual",
      // IDs legados
      "price_1SkxEACjA5c0MuV8VVfibyhD": "basico_mensal",
      "price_1SkxLbCjA5c0MuV8M6rYpYd6": "intermediario_mensal",
      "price_1SkxObCjA5c0MuV8G3OccySn": "profissional_mensal",
      "price_1SkxQnCjA5c0MuV8J0F7vf5m": "basico_anual",
      "price_1SkxRPCjA5c0MuV8cgcNtFsf": "intermediario_anual",
      "price_1SkxSNCjA5c0MuV8yJ5ZLr7o": "profissional_anual",
    };

    // MRR calculation - deduplicated by customer
    const allActiveSubs = [...activeSubscriptions.data, ...trialingSubscriptions.data];
    const customerBestSub: Record<string, { sub: any; monthlyAmount: number; priceId: string }> = {};

    for (const sub of allActiveSubs) {
      const custId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
      let subMonthly = 0;
      let mainPriceId = "";
      for (const item of sub.items.data) {
        const price = item.price;
        if (price && price.unit_amount && price.currency === "brl") {
          const amount = price.unit_amount / 100;
          if (!mainPriceId) mainPriceId = price.id;
          if (price.recurring?.interval === "month") {
            subMonthly += amount * (item.quantity || 1);
          } else if (price.recurring?.interval === "year") {
            subMonthly += (amount / 12) * (item.quantity || 1);
          }
        }
      }
      if (!customerBestSub[custId] || subMonthly > customerBestSub[custId].monthlyAmount) {
        customerBestSub[custId] = { sub, monthlyAmount: subMonthly, priceId: mainPriceId };
      }
    }

    let mrrStripe = 0;
    let mrrActiveOnly = 0;
    let activeOnlyCustomerCount = 0;
    const planBreakdown: Record<string, { count: number; mrr: number }> = {};

    for (const { sub, monthlyAmount, priceId } of Object.values(customerBestSub)) {
      mrrStripe += monthlyAmount;
      if (sub.status === "active") {
        mrrActiveOnly += monthlyAmount;
        activeOnlyCustomerCount++;
      }
      const planoKey = priceToPlano[priceId] || "desconhecido";
      if (!planBreakdown[planoKey]) planBreakdown[planoKey] = { count: 0, mrr: 0 };
      planBreakdown[planoKey].count++;
      planBreakdown[planoKey].mrr += monthlyAmount;
    }

    // Collect active customer IDs to exclude from past_due/incomplete lists
    const activeCustomerIds = new Set<string>();
    for (const sub of [...activeSubscriptions.data, ...trialingSubscriptions.data]) {
      const custId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
      if (custId) activeCustomerIds.add(custId);
    }

    // Past due subscriptions - exclude customers who already have an active sub
    const pastDueUsers = pastDueSubscriptions.data
      .filter((sub) => {
        const custId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
        return !activeCustomerIds.has(custId);
      })
      .map((sub) => {
        const customer = sub.customer as any;
        let periodEnd: string | null = null;
        try {
          if (sub.current_period_end) {
            periodEnd = new Date(sub.current_period_end * 1000).toISOString();
          }
        } catch { periodEnd = null; }
        return {
          customer_id: typeof sub.customer === "string" ? sub.customer : customer?.id,
          email: customer?.email || null,
          name: customer?.name || null,
          subscription_id: sub.id,
          current_period_end: periodEnd,
          status: "past_due",
        };
      });

    // Incomplete subscriptions - exclude customers who already have an active sub
    const incompleteUsers = incompleteSubscriptions.data
      .filter((sub) => {
        const custId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
        return !activeCustomerIds.has(custId);
      })
      .map((sub) => {
        const customer = sub.customer as any;
        let periodEnd: string | null = null;
        try {
          if (sub.current_period_end) {
            periodEnd = new Date(sub.current_period_end * 1000).toISOString();
          }
        } catch { periodEnd = null; }
        return {
          customer_id: typeof sub.customer === "string" ? sub.customer : customer?.id,
          email: customer?.email || null,
          name: customer?.name || null,
          subscription_id: sub.id,
          current_period_end: periodEnd,
          status: "incomplete",
        };
      });

    let estimatedAvailableDate = null;
    if (pending > 0 && pendingByDate.length > 0) {
      estimatedAvailableDate = pendingByDate[pendingByDate.length - 1].date;
    }

    // Monthly renewal tracking - who already paid this month vs who still needs to pay
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const renewalsPaid: Array<{ email: string | null; name: string | null; amount: number; paid_date: string; plan: string }> = [];
    const renewalsPending: Array<{ email: string | null; name: string | null; amount: number; renewal_date: string; plan: string }> = [];

    for (const sub of allActiveSubs) {
      const customer = sub.customer as any;
      const custEmail = customer?.email || null;
      const custName = customer?.name || null;
      
      let subAmount = 0;
      let mainPriceId = "";
      for (const item of sub.items.data) {
        const price = item.price;
        if (price && price.unit_amount && price.currency === "brl") {
          subAmount = price.unit_amount / 100;
          if (!mainPriceId) mainPriceId = price.id;
        }
      }
      const planoKey = priceToPlano[mainPriceId] || "desconhecido";

      // Resilient extraction: check root first, then items.data[0] (basil API compat)
      const rawPeriodStart = (sub as any).current_period_start 
        ?? (sub.items?.data?.[0] as any)?.current_period_start 
        ?? null;
      const rawPeriodEnd = (sub as any).current_period_end 
        ?? (sub.items?.data?.[0] as any)?.current_period_end 
        ?? null;

      const periodStart = rawPeriodStart ? new Date(rawPeriodStart * 1000) : null;
      const periodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000) : null;

      console.log(`[RENEWAL] Sub ${sub.id} | customer=${custEmail} | periodStart=${periodStart?.toISOString()} | periodEnd=${periodEnd?.toISOString()} | amount=${subAmount} | plan=${planoKey}`);

      if (periodStart && periodStart >= currentMonthStart && periodStart <= currentMonthEnd) {
        // Already billed this month
        renewalsPaid.push({
          email: custEmail,
          name: custName,
          amount: subAmount,
          paid_date: periodStart.toISOString(),
          plan: planoKey,
        });
      } else if (periodEnd && periodEnd >= currentMonthStart && periodEnd <= currentMonthEnd) {
        // Period ends this month = will be billed when it renews
        renewalsPending.push({
          email: custEmail,
          name: custName,
          amount: subAmount,
          renewal_date: periodEnd.toISOString(),
          plan: planoKey,
        });
      }
      // If neither condition, the sub was billed in a prior month and renews in a future month (e.g. annual)
    }

    const totalPaidThisMonth = renewalsPaid.reduce((acc, r) => acc + r.amount, 0);
    const totalPendingThisMonth = renewalsPending.reduce((acc, r) => acc + r.amount, 0);

    const response = {
      available,
      pending,
      total,
      currency: "BRL",
      last_update: new Date().toISOString(),
      pending_by_date: pendingByDate,
      next_payout: nextPayoutInfo,
      estimated_available_date: estimatedAvailableDate,
      mrr_stripe: mrrStripe,
      mrr_active_only: mrrActiveOnly,
      active_subscriptions_count: activeOnlyCustomerCount,
      all_subscriptions_count: Object.keys(customerBestSub).length,
      plan_breakdown: planBreakdown,
      past_due_subscriptions: pastDueUsers,
      incomplete_subscriptions: incompleteUsers,
      unpaid_count: pastDueUsers.length + incompleteUsers.length,
      monthly_renewals: {
        month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        paid: renewalsPaid,
        pending: renewalsPending,
        total_paid: totalPaidThisMonth,
        total_pending: totalPendingThisMonth,
        total_expected: totalPaidThisMonth + totalPendingThisMonth,
        paid_count: renewalsPaid.length,
        pending_count: renewalsPending.length,
      },
      raw_balance: {
        available: balance.available,
        pending: balance.pending,
      },
    };

    console.log("✅ Resposta preparada - MRR:", mrrActiveOnly, "Past due:", pastDueUsers.length, "Incomplete:", incompleteUsers.length, "Renewals paid:", renewalsPaid.length, "Renewals pending:", renewalsPending.length);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("❌ Erro:", error);

    if (error instanceof Stripe.errors.StripeError) {
      return new Response(
        JSON.stringify({ error: "Erro ao conectar com a Stripe", details: error.message, type: error.type }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    return new Response(
      JSON.stringify({ error: "Erro interno", details: error instanceof Error ? error.message : "Erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
