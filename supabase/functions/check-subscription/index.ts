import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[${timestamp}] [CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Planos que nunca expiram (acesso permanente ou manual)
const PLANOS_PROTEGIDOS = ["admin", "free"];

// 1 dia de carência após vencimento (PIX e cartão recorrente podem atrasar)
const GRACE_MS = 24 * 60 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  logStep("Iniciando verificação de assinatura");

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("Usuário autenticado", { userId: user.id });

    const { data: assinatura, error: dbError } = await supabaseClient
      .from("assinaturas")
      .select("plano_tipo, status, data_fim, data_proxima_cobranca, payment_provider, pagarme_subscription_id, trial_with_card, trial_canceled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (dbError) throw new Error(`Erro ao buscar assinatura: ${dbError.message}`);

    if (!assinatura) {
      logStep("Nenhuma assinatura encontrada no banco");
      return new Response(
        JSON.stringify({ subscribed: false, plano_tipo: "demonstracao", synced: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    logStep("Assinatura encontrada", {
      plano_tipo: assinatura.plano_tipo,
      status: assinatura.status,
      payment_provider: assinatura.payment_provider,
    });

    // Planos protegidos: sempre ativos
    if (PLANOS_PROTEGIDOS.includes(assinatura.plano_tipo) && assinatura.status === "active") {
      logStep("Plano protegido — liberado");
      return new Response(
        JSON.stringify({ subscribed: true, plano_tipo: assinatura.plano_tipo, synced: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Status ativo sem expiração: liberado
    if (assinatura.status === "active" || assinatura.status === "trialing") {
      // Verificar se ainda está dentro da vigência (com carência de 1 dia)
      const now = Date.now();
      const dataFimValida = assinatura.data_fim &&
        new Date(assinatura.data_fim).getTime() + GRACE_MS > now;
      const dataProximaValida = assinatura.data_proxima_cobranca &&
        new Date(assinatura.data_proxima_cobranca).getTime() + GRACE_MS > now;
      // Se não tem nenhuma data de fim definida, confiar no status active (acesso manual/concedido)
      const semDataFim = !assinatura.data_fim && !assinatura.data_proxima_cobranca;

      if (dataFimValida || dataProximaValida || semDataFim) {
        logStep("Acesso vigente", {
          plano_tipo: assinatura.plano_tipo,
          data_fim: assinatura.data_fim,
          data_proxima_cobranca: assinatura.data_proxima_cobranca,
        });
        const duration = Date.now() - startTime;
        logStep(`Tempo total: ${duration}ms`);
        return new Response(
          JSON.stringify({ subscribed: true, plano_tipo: assinatura.plano_tipo, synced: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      // Status active mas data expirou — regredir para free
      logStep("Status active mas datas expiradas — regredindo para free", {
        data_fim: assinatura.data_fim,
        data_proxima_cobranca: assinatura.data_proxima_cobranca,
      });
      await supabaseClient
        .from("assinaturas")
        .update({ plano_tipo: "free", status: "active", updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({ subscribed: false, plano_tipo: "free", synced: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Cancelado ou status problemático
    logStep("Assinatura não ativa", { status: assinatura.status });
    const duration = Date.now() - startTime;
    logStep(`Tempo total: ${duration}ms`);
    return new Response(
      JSON.stringify({ subscribed: false, plano_tipo: assinatura.plano_tipo, synced: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;
    logStep(`ERRO (${duration}ms)`, { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
