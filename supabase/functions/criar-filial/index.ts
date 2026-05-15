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

    // Verificar plano
    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("plano_tipo")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const planosPermitidos = ["profissional_ultra_mensal", "profissional_ultra_anual", "admin"];
    if (!adminRole && !planosPermitidos.includes(assinatura?.plano_tipo || "")) {
      return json({ error: `Plano atual (${assinatura?.plano_tipo || "nenhum"}) não tem acesso. Necessário Plano Ultra.` }, 403);
    }

    // Verificar limite de 3 filiais
    const { count, error: countError } = await supabase
      .from("empresas")
      .select("*", { count: "exact", head: true })
      .eq("proprietario_id", user.id)
      .eq("ativa", true)
      .eq("tipo", "filial");

    if (countError) return json({ error: "Erro ao verificar limite: " + countError.message }, 500);
    if ((count || 0) >= 3) return json({ error: "Limite de 3 filiais atingido" }, 400);

    // Validar body
    const body = await req.json();
    const { nome, cnpj, telefone, endereco, cidade, estado } = body;

    if (!nome?.trim()) return json({ error: "Nome da filial é obrigatório" }, 400);

    // Criar empresa filial (sem criar usuário gerente)
    const { data: empresa, error: empresaError } = await supabase
      .from("empresas")
      .insert({
        proprietario_id: user.id,
        nome: nome.trim(),
        tipo: "filial",
        cnpj: cnpj || null,
        telefone: telefone || null,
        endereco: endereco || null,
        cidade: cidade || null,
        estado: estado || null,
        ativa: true,
      })
      .select()
      .single();

    if (empresaError) return json({ error: "Erro ao criar empresa: " + empresaError.message }, 500);

    return json({
      sucesso: true,
      empresa,
      mensagem: `Filial "${nome}" criada com sucesso!`,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return json({ error: "Erro inesperado: " + msg }, 500);
  }
});
