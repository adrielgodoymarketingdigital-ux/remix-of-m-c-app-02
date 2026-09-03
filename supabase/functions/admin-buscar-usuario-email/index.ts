import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

// Lookup de usuário por e-mail para o painel de Liberação Temporária.
// Só admin. Retorna dados suficientes para o formulário decidir o aviso
// de "pagante real ativo" e mostrar o estado atual da assinatura.

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ADMIN-BUSCAR-USUARIO-EMAIL] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase configuration");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Autenticação + verificação de admin
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Invalid token");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const body = await req.json();
    const email = (body?.email ?? "").toString().trim().toLowerCase();
    if (!email) throw new Error("email é obrigatório");

    log("Buscando usuário", { email });

    // Buscar auth user via Admin REST (mesmo padrão de buscar-assinatura-email)
    const searchRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&page=1&per_page=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    const searchData = await searchRes.json();
    const authUser = searchData?.users?.[0];

    if (!authUser) {
      return new Response(
        JSON.stringify({ error: "Nenhuma conta encontrada com este e-mail." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      );
    }

    const [{ data: assinatura }, { data: profile }] = await Promise.all([
      supabase
        .from("assinaturas")
        .select(
          "plano_tipo, status, data_fim, data_proxima_cobranca, payment_provider, pagarme_subscription_id, bloqueado_admin, bloqueado_tipo, trial_with_card, liberacao_temp_id",
        )
        .eq("user_id", authUser.id)
        .maybeSingle(),
      supabase.from("profiles").select("nome, email").eq("user_id", authUser.id).maybeSingle(),
    ]);

    let liberacaoAtiva: { id: string; plano_concedido: string; expira_em: string } | null = null;
    let baselineEraPaganteReal: boolean | null = null;
    if (assinatura?.liberacao_temp_id) {
      const { data: lib } = await supabase
        .from("liberacoes_temporarias")
        .select("id, plano_concedido, expira_em, estado, era_pagante_real")
        .eq("id", assinatura.liberacao_temp_id)
        .maybeSingle();
      if (lib && lib.estado === "ativa") {
        liberacaoAtiva = { id: lib.id, plano_concedido: lib.plano_concedido, expira_em: lib.expira_em };
        baselineEraPaganteReal = lib.era_pagante_real === true;
      }
    }

    // Se há liberação ativa, o "baseline" real é o que ficou registrado nela;
    // senão, deriva do estado atual da assinatura.
    const eraPaganteReal =
      baselineEraPaganteReal !== null
        ? baselineEraPaganteReal
        : !!assinatura &&
          assinatura.status === "active" &&
          !!assinatura.payment_provider &&
          !!assinatura.pagarme_subscription_id;

    return new Response(
      JSON.stringify({
        user_id: authUser.id,
        email: profile?.email || authUser.email || email,
        nome: profile?.nome || null,
        plano_tipo: assinatura?.plano_tipo || null,
        status: assinatura?.status || null,
        data_fim: assinatura?.data_fim || null,
        era_pagante_real: eraPaganteReal,
        liberacao_ativa: liberacaoAtiva,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
