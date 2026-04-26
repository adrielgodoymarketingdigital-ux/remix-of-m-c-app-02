import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CriarFuncionarioRequest {
  nome: string;
  email: string;
  senha: string;
  permissoes: Record<string, unknown>;
  cargo?: string | null;
  comissao_tipo?: string | null;
  comissao_valor?: number;
  comissao_escopo?: string | null;
  comissoes_por_cargo?: Record<string, { tipo: string; valor: number; escopo: string }> | null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: donoLoja }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !donoLoja) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: assinatura, error: assinaturaError } = await supabaseUser
      .from("assinaturas").select("*").eq("user_id", donoLoja.id).maybeSingle();

    if (assinaturaError) {
      return new Response(JSON.stringify({ error: "Erro ao verificar assinatura" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!assinatura || !["active", "trialing"].includes(assinatura.status)) {
      return new Response(JSON.stringify({ error: "Assinatura inativa. Ative seu plano para cadastrar funcionários." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { nome, email, senha, permissoes, cargo, comissao_tipo, comissao_valor, comissao_escopo, comissoes_por_cargo }: CriarFuncionarioRequest = await req.json();

    if (!nome || !email || !senha) {
      return new Response(JSON.stringify({ error: "Nome, email e senha são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (senha.length < 6) {
      return new Response(JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: funcionarioExistente } = await supabaseAdmin
      .from("loja_funcionarios").select("id").eq("loja_user_id", donoLoja.id).eq("email", email.toLowerCase()).maybeSingle();

    if (funcionarioExistente) {
      return new Response(JSON.stringify({ error: "Este email já está cadastrado como funcionário" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { count: totalFuncionarios } = await supabaseAdmin
      .from("loja_funcionarios").select("id", { count: "exact", head: true }).eq("loja_user_id", donoLoja.id);

    const plano = assinatura.plano_tipo;
    let limite = 0;
    if (plano.includes("intermediario")) limite = 3;
    else if (plano.includes("profissional") || plano === "admin") limite = 999;
    else if (plano === "trial" || plano === "demonstracao") limite = 1;

    if ((totalFuncionarios ?? 0) >= limite) {
      return new Response(JSON.stringify({ error: `Limite de ${limite} funcionário(s) atingido para seu plano` }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let funcionarioUserId: string;

    const { data: novoUsuario, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: senha,
      email_confirm: true,
      user_metadata: { nome, tipo: "funcionario", loja_user_id: donoLoja.id },
    });

    if (createError) {
      if (createError.code === "email_exists" || createError.message?.includes("already been registered")) {
        let usuarioExistente = null;
        let page = 1;
        const perPage = 100;
        while (!usuarioExistente) {
          const { data: usersPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
          if (listError || !usersPage?.users?.length) break;
          usuarioExistente = usersPage.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
          if (usuarioExistente || usersPage.users.length < perPage) break;
          page++;
          if (page > 50) break;
        }

        if (!usuarioExistente) {
          return new Response(JSON.stringify({ error: "Não foi possível localizar o usuário. Entre em contato com o suporte." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Security: Only allow linking users who are already employees (tipo=funcionario)
        const userMeta = usuarioExistente.user_metadata;
        const isExistingFuncionario = userMeta?.tipo === "funcionario";

        const { data: vinculoExistente } = await supabaseAdmin
          .from("loja_funcionarios").select("id, loja_user_id").eq("funcionario_user_id", usuarioExistente.id).eq("ativo", true).maybeSingle();

        if (vinculoExistente && vinculoExistente.loja_user_id !== donoLoja.id) {
          return new Response(JSON.stringify({ error: "Este email já está vinculado a outra loja" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // If the user is NOT an existing employee, do not allow password reset or hijacking
        if (!isExistingFuncionario && !vinculoExistente) {
          return new Response(JSON.stringify({ error: "Este email já está registrado no sistema. O usuário precisa ser convidado por outro meio." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        funcionarioUserId = usuarioExistente.id;
        // Only reset password if this is an employee already linked to THIS store
        if (isExistingFuncionario && vinculoExistente && vinculoExistente.loja_user_id === donoLoja.id) {
          await supabaseAdmin.auth.admin.updateUserById(funcionarioUserId, { password: senha });
        }
      } else {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      funcionarioUserId = novoUsuario.user.id;
    }

    const { data: funcionario, error: insertError } = await supabaseAdmin
      .from("loja_funcionarios")
      .insert({
        loja_user_id: donoLoja.id,
        funcionario_user_id: funcionarioUserId,
        nome,
        email: email.toLowerCase(),
        permissoes,
        ativo: true,
        convite_aceito_em: new Date().toISOString(),
        cargo: cargo || null,
        comissao_tipo: comissao_tipo || null,
        comissao_valor: comissao_valor || 0,
        comissao_escopo: comissao_escopo || null,
        comissoes_por_cargo: comissoes_por_cargo || null,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: "Erro ao cadastrar funcionário" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ success: true, funcionario: { id: funcionario.id, nome: funcionario.nome, email: funcionario.email } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro inesperado:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
