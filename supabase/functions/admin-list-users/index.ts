import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-LIST-USERS] ${step}${detailsStr}`);
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

    logStep("User authenticated", { userId: userData.user.id });

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

    logStep("User is admin, fetching data");

    // Buscar todas as assinaturas
    const { data: assinaturas, error: assError } = await supabaseClient
      .from("assinaturas")
      .select("*")
      .order("created_at", { ascending: false });

    if (assError) {
      logStep("Error fetching subscriptions", { error: assError.message });
      throw new Error(`Error fetching subscriptions: ${assError.message}`);
    }

    logStep("Subscriptions fetched", { count: assinaturas?.length || 0 });

    // Buscar todos os perfis
    const { data: profiles, error: profError } = await supabaseClient
      .from("profiles")
      .select("*");

    if (profError) {
      logStep("Error fetching profiles", { error: profError.message });
      throw new Error(`Error fetching profiles: ${profError.message}`);
    }

    logStep("Profiles fetched", { count: profiles?.length || 0 });

    // Buscar usuários da auth para fallback de nome/email quando não há perfil
    const userIdsComPerfilFaltando = assinaturas
      ?.filter(ass => !profiles?.find(p => p.user_id === ass.user_id))
      .map(ass => ass.user_id) || [];

    const authUserMap: Record<string, { email: string | null; nome: string | null }> = {};

    if (userIdsComPerfilFaltando.length > 0) {
      logStep("Fetching auth users for missing profiles", { count: userIdsComPerfilFaltando.length });
      const { data: { users: authUsers }, error: authError } = await supabaseClient.auth.admin.listUsers({ perPage: 1000 });
      if (!authError && authUsers) {
        for (const u of authUsers) {
          if (userIdsComPerfilFaltando.includes(u.id)) {
            authUserMap[u.id] = {
              email: u.email || null,
              nome: u.user_metadata?.nome || u.user_metadata?.full_name || u.user_metadata?.name || null,
            };
          }
        }
      }
    }

    // Combinar dados - incluindo campos de trial com cartão
    const usuarios = assinaturas?.map(ass => {
      const profile = profiles?.find(p => p.user_id === ass.user_id);
      const authFallback = authUserMap[ass.user_id];
      return {
        ...ass, // já inclui data_fim, trial_with_card, trial_end_at, trial_canceled
        nome: profile?.nome || authFallback?.nome || null,
        email: profile?.email || authFallback?.email || null,
        celular: profile?.celular || null,
        last_login_at: profile?.last_login_at || null,
        login_count: profile?.login_count || 0,
      };
    }) || [];

    logStep("Combined data", { 
      usuariosCount: usuarios.length,
      sampleFields: usuarios[0] ? Object.keys(usuarios[0]) : []
    });

    logStep("Combined data", { usuariosCount: usuarios.length });

    return new Response(JSON.stringify({ usuarios }), {
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
