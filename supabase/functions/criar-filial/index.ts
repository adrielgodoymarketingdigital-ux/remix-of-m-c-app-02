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

    // Plano
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

    const planosUltra = ["profissional_ultra_mensal", "profissional_ultra_anual", "admin"];
    const planoOk = adminRole || planosUltra.includes(assinatura?.plano_tipo || "");
    if (!planoOk) {
      return json({ error: `Plano atual (${assinatura?.plano_tipo || "nenhum"}) não tem acesso ao Multi Empresas. Necessário Plano Ultra.` }, 403);
    }

    // Limite de filiais
    const { count, error: countError } = await supabase
      .from("empresas")
      .select("*", { count: "exact", head: true })
      .eq("proprietario_id", user.id)
      .eq("ativa", true)
      .eq("tipo", "filial");

    if (countError) return json({ error: "Erro ao verificar limite: " + countError.message }, 500);
    if ((count || 0) >= 3) return json({ error: "Limite de 3 filiais atingido" }, 400);

    // Body
    const body = await req.json();
    const { nome, cnpj, telefone, endereco, cidade, estado, email_gerente, senha_gerente } = body;

    if (!nome?.trim()) return json({ error: "Nome da filial é obrigatório" }, 400);
    if (!email_gerente?.trim()) return json({ error: "Email do gerente é obrigatório" }, 400);
    if (!senha_gerente || senha_gerente.length < 6) return json({ error: "Senha deve ter pelo menos 6 caracteres" }, 400);

    // Criar usuário gerente
    const { data: gerenteData, error: gerenteError } = await supabase.auth.admin.createUser({
      email: email_gerente,
      password: senha_gerente,
      email_confirm: true,
      user_metadata: { nome: nome, tipo_usuario: "gerente_filial" },
    });

    if (gerenteError) {
      const msg = gerenteError.message.toLowerCase().includes("already registered") || gerenteError.message.toLowerCase().includes("already been registered")
        ? "Este email já está cadastrado no sistema"
        : "Erro ao criar login do gerente: " + gerenteError.message;
      return json({ error: msg }, 400);
    }

    const gerenteId = gerenteData.user.id;

    // Perfil do gerente
    const { error: perfilError } = await supabase.from("profiles").upsert({
      user_id: gerenteId,
      nome: nome,
      email: email_gerente,
    }, { onConflict: "user_id" });

    if (perfilError) {
      await supabase.auth.admin.deleteUser(gerenteId);
      return json({ error: "Erro ao criar perfil do gerente: " + perfilError.message }, 500);
    }

    // Assinatura do gerente
    const { error: assinaturaError } = await supabase.from("assinaturas").insert({
      user_id: gerenteId,
      plano_tipo: "free",
      status: "active",
      payment_provider: "multi_empresa",
    });

    if (assinaturaError) {
      await supabase.auth.admin.deleteUser(gerenteId);
      return json({ error: "Erro ao criar assinatura do gerente: " + assinaturaError.message }, 500);
    }

    // Criar empresa filial
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

    if (empresaError) {
      await supabase.auth.admin.deleteUser(gerenteId);
      return json({ error: "Erro ao criar empresa: " + empresaError.message }, 500);
    }

    // Vincular gerente à empresa
    const { error: vinculoError } = await supabase.from("empresa_usuarios").insert({
      empresa_id: empresa.id,
      proprietario_id: user.id,
      gerente_id: gerenteId,
      permissoes: {
        pdv: true,
        os: true,
        clientes: true,
        produtos: true,
        financeiro: false,
        relatorios: false,
        funcionarios: false,
        configuracoes: false,
        metas: false,
      },
    });

    if (vinculoError) {
      return json({ error: "Empresa criada mas erro ao vincular gerente: " + vinculoError.message }, 500);
    }

    return json({
      sucesso: true,
      empresa,
      gerente_id: gerenteId,
      mensagem: `Filial "${nome}" criada com sucesso! Login do gerente: ${email_gerente}`,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return json({ error: "Erro inesperado: " + msg }, 500);
  }
});
