import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-GRANT-ACCESS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Verificar token do usuário
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Invalid token");
    }

    logStep("Admin authenticated", { adminId: userData.user.id });

    // Verificar se o usuário é admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      logStep("User is not admin");
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    logStep("User is admin, processing request");

    const body = await req.json();
    const { user_id, plano_tipo, tempo_acesso, unidade_tempo, motivo } = body;

    if (!user_id) {
      throw new Error("user_id é obrigatório");
    }

    if (!plano_tipo) {
      throw new Error("plano_tipo é obrigatório");
    }

    // Validar plano
    const planosValidos = [
      "trial",
      "basico_mensal",
      "basico_anual",
      "intermediario_mensal",
      "intermediario_anual",
      "profissional_mensal",
      "profissional_anual",
    ];

    if (!planosValidos.includes(plano_tipo)) {
      throw new Error(`Plano inválido: ${plano_tipo}`);
    }

    // Calcular data_fim baseado no tempo e unidade de acesso
    const unidade = unidade_tempo || "dias";
    const tempoFinal = tempo_acesso || (plano_tipo === "trial" ? 7 : 30);
    const dataFim = new Date();
    
    if (unidade === "horas") {
      dataFim.setHours(dataFim.getHours() + tempoFinal);
    } else {
      dataFim.setDate(dataFim.getDate() + tempoFinal);
    }

    const tempoLabel = unidade === "horas" 
      ? `${tempoFinal} hora${tempoFinal !== 1 ? 's' : ''}`
      : `${tempoFinal} dia${tempoFinal !== 1 ? 's' : ''}`;

    logStep("Granting access", { 
      user_id, 
      plano_tipo, 
      tempo_acesso: tempoFinal,
      unidade_tempo: unidade,
      data_fim: dataFim.toISOString() 
    });

    // Buscar dados do usuário para log
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("nome, email")
      .eq("user_id", user_id)
      .maybeSingle();

    // Buscar dados do admin para log
    const { data: adminProfileData } = await supabaseClient
      .from("profiles")
      .select("nome, email")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    // Atualizar assinatura para conceder acesso
    const updateData: Record<string, unknown> = {
      plano_tipo,
      status: plano_tipo === "trial" ? "trialing" : "active",
      data_inicio: new Date().toISOString(),
      data_fim: dataFim.toISOString(),
      data_proxima_cobranca: dataFim.toISOString(),
      bloqueado_admin: false,
      bloqueado_admin_motivo: null,
      bloqueado_admin_em: null,
      bloqueado_tipo: null,
      trial_canceled: false,
      updated_at: new Date().toISOString(),
    };

    // Se for trial, configurar campos de trial
    if (plano_tipo === "trial") {
      updateData.trial_started_at = new Date().toISOString();
      updateData.trial_end_at = dataFim.toISOString();
      updateData.trial_with_card = false; // Acesso concedido manualmente, sem cartão
      updateData.trial_converted = false;
    }

    const { error: updateError } = await supabaseClient
      .from("assinaturas")
      .update(updateData)
      .eq("user_id", user_id);

    if (updateError) {
      logStep("Error updating subscription", { error: updateError.message });
      throw new Error(`Erro ao atualizar assinatura: ${updateError.message}`);
    }

    // Registrar no histórico de bloqueios (usando ação "acesso_concedido")
    await supabaseClient.from("historico_bloqueios").insert({
      user_id,
      admin_id: userData.user.id,
      acao: "acesso_concedido",
      motivo: motivo || `Acesso concedido: ${plano_tipo} por ${tempoLabel}`,
      user_nome: profileData?.nome || null,
      user_email: profileData?.email || null,
      admin_nome: adminProfileData?.nome || null,
      admin_email: adminProfileData?.email || null,
      tipo_bloqueio: plano_tipo,
    });

    logStep("Access granted successfully", { user_id, plano_tipo });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Acesso concedido com sucesso! Plano: ${plano_tipo}, Tempo: ${tempoLabel}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
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
