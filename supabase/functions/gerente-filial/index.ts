import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

    // Verifica proprietário via token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: proprietario }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !proprietario) return json({ error: "Token inválido" }, 401);

    const body = await req.json();
    const { empresa_id, acao } = body;

    if (!empresa_id) return json({ error: "empresa_id obrigatório" }, 400);

    // Verifica que a empresa pertence ao proprietário
    const { data: empresaUsuario, error: euError } = await supabase
      .from("empresa_usuarios" as never)
      .select("gerente_id")
      .eq("empresa_id" as never, empresa_id)
      .eq("proprietario_id" as never, proprietario.id)
      .maybeSingle() as any;

    if (euError || !empresaUsuario) return json({ error: "Empresa não encontrada ou sem permissão" }, 403);

    const gerenteId = empresaUsuario.gerente_id;
    if (!gerenteId) return json({ error: "Esta filial não tem gerente cadastrado" }, 404);

    // GET — retorna dados do gerente
    if (acao === "buscar") {
      const { data: gerenteAuth } = await supabase.auth.admin.getUserById(gerenteId);
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, email")
        .eq("user_id", gerenteId)
        .maybeSingle();

      return json({
        gerente_id: gerenteId,
        email: gerenteAuth?.user?.email ?? profile?.email ?? "",
        nome: profile?.nome ?? gerenteAuth?.user?.user_metadata?.nome ?? "",
      });
    }

    // PUT — atualiza email e/ou senha
    if (acao === "atualizar") {
      const { email, senha } = body;
      const updates: Record<string, string> = {};
      if (email?.trim()) updates.email = email.trim().toLowerCase();
      if (senha) {
        if (senha.length < 6) return json({ error: "Senha deve ter pelo menos 6 caracteres" }, 400);
        updates.password = senha;
      }

      if (Object.keys(updates).length === 0) return json({ error: "Nenhum dado para atualizar" }, 400);

      const { error: updateError } = await supabase.auth.admin.updateUserById(gerenteId, updates);
      if (updateError) return json({ error: "Erro ao atualizar: " + updateError.message }, 500);

      // Atualiza profile também se email mudou
      if (updates.email) {
        await supabase.from("profiles").update({ email: updates.email }).eq("user_id", gerenteId);
      }

      return json({ sucesso: true });
    }

    return json({ error: "Ação inválida. Use 'buscar' ou 'atualizar'" }, 400);

  } catch (err) {
    return json({ error: "Erro inesperado: " + String(err) }, 500);
  }
});
