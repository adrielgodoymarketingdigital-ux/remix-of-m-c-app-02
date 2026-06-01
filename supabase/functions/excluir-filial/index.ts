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

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Token inválido: " + authError?.message }, 401);

    const body = await req.json();
    const { empresa_id } = body;

    if (!empresa_id) return json({ error: "empresa_id é obrigatório" }, 400);

    // Verificar que a empresa pertence ao usuário e é filial
    const { data: empresa, error: empresaError } = await supabase
      .from("empresas")
      .select("id, nome, tipo, proprietario_id")
      .eq("id", empresa_id)
      .eq("proprietario_id", user.id)
      .eq("tipo", "filial")
      .maybeSingle();

    if (empresaError) return json({ error: "Erro ao verificar empresa: " + empresaError.message }, 500);
    if (!empresa) return json({ error: "Filial não encontrada ou sem permissão" }, 404);

    // Buscar o gerente da filial para deletar da auth
    const { data: empresaUsuario } = await supabase
      .from("empresa_usuarios")
      .select("gerente_id")
      .eq("empresa_id", empresa_id)
      .maybeSingle();

    // Remover vínculos da empresa_usuarios
    await supabase.from("empresa_usuarios").delete().eq("empresa_id", empresa_id);

    // Remover metas da empresa
    await supabase.from("empresa_metas").delete().eq("empresa_id", empresa_id);

    // Remover preferências de notificação
    await supabase.from("user_notification_preferences").delete().eq("empresa_id", empresa_id);

    // Desativar a empresa (soft delete)
    const { error: deleteError } = await supabase
      .from("empresas")
      .update({ ativa: false })
      .eq("id", empresa_id);

    if (deleteError) return json({ error: "Erro ao excluir filial: " + deleteError.message }, 500);

    // Deletar usuário gerente do Auth se existir
    if (empresaUsuario?.gerente_id) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${empresaUsuario.gerente_id}`, {
        method: "DELETE",
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
      });
    }

    return json({
      sucesso: true,
      mensagem: `Filial "${empresa.nome}" excluída com sucesso!`,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return json({ error: "Erro inesperado: " + msg }, 500);
  }
});
