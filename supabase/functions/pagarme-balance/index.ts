import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PAGARME-BALANCE] ${step}${d}`);
};

const PRECOS_MES: Record<string, number> = {
  basico_mensal: 19.90,
  intermediario_mensal: 39.90,
  profissional_mensal: 79.90,
  basico_anual: 15.90,
  intermediario_anual: 31.90,
  profissional_anual: 74.90,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Admin autenticado", { userId: userData.user.id });

    const { data: allPayments, error: paymentsError } = await supabaseAdmin
      .from("pagamentos_pix")
      .select("*")
      .order("created_at", { ascending: false });

    if (paymentsError) throw new Error(`Erro: ${paymentsError.message}`);
    const payments = allPayments || [];

    const userIds = [...new Set(payments.map((p: any) => p.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, nome, email")
      .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    const now = new Date();
    const paid = payments.filter((p: any) => p.status === "paid");
    const pending = payments.filter((p: any) => p.status === "pending" && (!p.pix_expiration || new Date(p.pix_expiration) > now));
    const expired = payments.filter((p: any) => p.status === "pending" && p.pix_expiration && new Date(p.pix_expiration) <= now);

    const totalPaid = paid.reduce((s: number, p: any) => s + (p.valor_centavos || 0), 0) / 100;
    const totalPending = pending.reduce((s: number, p: any) => s + (p.valor_centavos || 0), 0) / 100;

    const { data: activeAssinaturas } = await supabaseAdmin
      .from("assinaturas")
      .select("user_id, plano_tipo, status, data_fim, data_inicio")
      .eq("payment_provider", "pagarme")
      .eq("status", "active");

    let mrrPagarme = 0;
    const planBreakdown: Record<string, { count: number; mrr: number }> = {};
    for (const ass of activeAssinaturas || []) {
      const plano = (ass as any).plano_tipo;
      const monthlyPrice = PRECOS_MES[plano] || 0;
      mrrPagarme += monthlyPrice;
      if (!planBreakdown[plano]) planBreakdown[plano] = { count: 0, mrr: 0 };
      planBreakdown[plano].count += 1;
      planBreakdown[plano].mrr += monthlyPrice;
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const monthlyPaid = paid.filter((p: any) => p.paid_at && p.paid_at >= monthStart && p.paid_at <= monthEnd);
    const monthlyTotalPaid = monthlyPaid.reduce((s: number, p: any) => s + (p.valor_centavos || 0), 0) / 100;

    const upcomingRenewals = (activeAssinaturas || []).filter((a: any) =>
      a.data_fim && a.data_fim >= monthStart && a.data_fim <= monthEnd
    );
    const pendingRenewalTotal = upcomingRenewals.reduce((s: number, a: any) => s + (PRECOS_MES[(a as any).plano_tipo] || 0), 0);

    const mapPayment = (p: any) => {
      const profile = profileMap.get(p.user_id);
      return {
        email: (profile as any)?.email || null,
        name: (profile as any)?.nome || null,
        amount: (p.valor_centavos || 0) / 100,
        paid_date: p.paid_at,
        expiration: p.pix_expiration,
        plan: p.plano_tipo,
        created_at: p.created_at,
      };
    };

    const mapRenewal = (a: any) => {
      const profile = profileMap.get(a.user_id);
      return {
        email: (profile as any)?.email || null,
        name: (profile as any)?.nome || null,
        amount: PRECOS_MES[(a as any).plano_tipo] || 0,
        renewal_date: a.data_fim,
        plan: (a as any).plano_tipo,
      };
    };

    const result = {
      total_received: totalPaid,
      total_pending: totalPending,
      paid_count: paid.length,
      pending_count: pending.length,
      expired_count: expired.length,
      active_subscriptions_count: (activeAssinaturas || []).length,
      mrr: mrrPagarme,
      plan_breakdown: planBreakdown,
      monthly: {
        month: monthLabel,
        paid: monthlyPaid.map(mapPayment),
        total_paid: monthlyTotalPaid,
        paid_count: monthlyPaid.length,
        upcoming_renewals: upcomingRenewals.map(mapRenewal),
        total_pending_renewals: pendingRenewalTotal,
        upcoming_count: upcomingRenewals.length,
      },
      recent_payments: paid.slice(0, 30).map(mapPayment),
      pending_payments: pending.slice(0, 20).map(mapPayment),
      last_update: now.toISOString(),
    };

    log("✅ Dados retornados", { paid: paid.length, active: (activeAssinaturas || []).length });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});