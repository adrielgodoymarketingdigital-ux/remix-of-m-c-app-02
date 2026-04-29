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

serve(async (req: Request) => {
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

    // Buscar TODOS os usuários da auth
    const { data: { users: authUsers }, error: authError } = await supabaseClient.auth.admin.listUsers({ perPage: 1000 });

    if (authError) {
      throw new Error("Erro ao buscar usuários auth: " + authError.message);
    }

    logStep("Auth users fetched", { count: authUsers?.length || 0 });

    // Combinar dados — todos os auth users, assinatura mais recente, sem duplicatas
    const usuarios = authUsers.map((authUser: Record<string, unknown> & { id: string; email?: string; last_sign_in_at?: string; created_at?: string; user_metadata?: Record<string, unknown> }) => {
      const profile = profiles?.find((p: Record<string, unknown>) => p.user_id === authUser.id);

      const assinaturasDoUsuario = assinaturas?.filter((a: Record<string, unknown>) => a.user_id === authUser.id) || [];
      const assinatura = assinaturasDoUsuario.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
      )[0] || null;

      return {
        id: assinatura?.id || authUser.id,
        user_id: authUser.id,
        email: profile?.email || authUser.email || null,
        nome: profile?.nome ||
              authUser.user_metadata?.nome ||
              authUser.user_metadata?.full_name ||
              authUser.user_metadata?.name || null,
        celular: profile?.celular || null,
        last_login_at: profile?.last_login_at || authUser.last_sign_in_at || null,
        login_count: profile?.login_count || 0,
        created_at: authUser.created_at || null,

        plano_tipo: assinatura?.plano_tipo || "free",
        status: assinatura?.status || "active",
        data_inicio: assinatura?.data_inicio || null,
        data_fim: assinatura?.data_fim || null,
        stripe_customer_id: assinatura?.stripe_customer_id || null,
        stripe_subscription_id: assinatura?.stripe_subscription_id || null,
        trial_with_card: assinatura?.trial_with_card || false,
        trial_end_at: assinatura?.trial_end_at || null,
        trial_canceled: assinatura?.trial_canceled || false,
        bloqueado_admin: assinatura?.bloqueado_admin || false,
        bloqueado_admin_motivo: assinatura?.bloqueado_admin_motivo || null,
        bloqueado_admin_em: assinatura?.bloqueado_admin_em || null,
        bloqueado_tipo: assinatura?.bloqueado_tipo || null,
      };
    });

    usuarios.sort((a: { created_at?: string | null }, b: { created_at?: string | null }) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

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
