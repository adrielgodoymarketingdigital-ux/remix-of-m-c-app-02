import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verifica proprietário/loja via token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) return json({ error: "Token inválido" }, 401);

    const { funcionario_id, email } = await req.json();
    if (!funcionario_id) return json({ error: "funcionario_id obrigatório" }, 400);
    if (!email?.trim()) return json({ error: "email obrigatório" }, 400);

    const novoEmail = email.trim().toLowerCase();

    // Verifica que o funcionário pertence ao loja_user_id do caller
    const { data: funcionario, error: funcError } = await supabase
      .from("loja_funcionarios")
      .select("funcionario_user_id, loja_user_id")
      .eq("id", funcionario_id)
      .maybeSingle();

    if (funcError || !funcionario) return json({ error: "Funcionário não encontrado" }, 404);
    if (funcionario.loja_user_id !== caller.id) return json({ error: "Sem permissão para editar este funcionário" }, 403);

    const funcionarioUserId = funcionario.funcionario_user_id;
    if (!funcionarioUserId) return json({ error: "Funcionário não possui conta de acesso" }, 400);

    // Atualiza email no Auth
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(funcionarioUserId, {
      email: novoEmail,
    });
    if (updateAuthError) return json({ error: "Erro ao atualizar email no Auth: " + updateAuthError.message }, 500);

    // Atualiza email na tabela loja_funcionarios
    await supabase
      .from("loja_funcionarios")
      .update({ email: novoEmail, updated_at: new Date().toISOString() })
      .eq("id", funcionario_id);

    // Atualiza email no profile (se existir)
    await supabase
      .from("profiles")
      .update({ email: novoEmail })
      .eq("user_id", funcionarioUserId);

    return json({ sucesso: true });
  } catch (err) {
    return json({ error: "Erro inesperado: " + String(err) }, 500);
  }
});
