import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Buscar usuário pelo email em auth.users via listUsers
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    const authUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
    );

    if (!authUser) {
      return new Response(
        JSON.stringify({ error: "Nenhuma conta encontrada com este email." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar assinatura
    const { data: assinatura, error: errAss } = await supabase
      .from("assinaturas")
      .select("plano_tipo, status, data_fim, data_proxima_cobranca")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (errAss) throw errAss;

    if (!assinatura) {
      return new Response(
        JSON.stringify({ error: "Nenhuma assinatura encontrada para este email." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar nome no profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("user_id", authUser.id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        userId: authUser.id,
        email: authUser.email,
        nome: profile?.nome ?? null,
        planoTipo: assinatura.plano_tipo,
        status: assinatura.status,
        dataFim: assinatura.data_fim ?? null,
        dataProximaCobranca: assinatura.data_proxima_cobranca ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno.";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
