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

    // Verificar plano do proprietário
    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("plano_tipo, status, payment_provider")
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
    const { nome, cnpj, telefone, endereco, cidade, estado, email_gerente, senha_gerente } = body;

    if (!nome?.trim()) return json({ error: "Nome da filial é obrigatório" }, 400);
    if (!email_gerente?.trim()) return json({ error: "Email do gerente é obrigatório" }, 400);
    if (!senha_gerente || senha_gerente.length < 6) return json({ error: "Senha deve ter pelo menos 6 caracteres" }, 400);

    // Criar usuário gerente via fetch direto (evita comportamentos do SDK com triggers)
    const createUserResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email_gerente,
        password: senha_gerente,
        email_confirm: true,
        user_metadata: { nome: nome.trim(), tipo_usuario: "gerente_filial" },
      }),
    });

    const gerenteData = await createUserResp.json();

    if (!createUserResp.ok) {
      const msg = gerenteData.msg || gerenteData.message || JSON.stringify(gerenteData);
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already been registered")) {
        return json({ error: "Este email já está cadastrado no sistema" }, 400);
      }
      return json({ error: "Erro ao criar login do gerente: " + msg }, 400);
    }

    const gerenteId = gerenteData.id;

    // Perfil do gerente
    await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=user_id`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ user_id: gerenteId, nome: nome.trim(), email: email_gerente }),
    });

    // Assinatura do gerente herda o plano do proprietário
    // Primeiro remove qualquer assinatura criada pelo trigger automático
    await fetch(`${supabaseUrl}/rest/v1/assinaturas?user_id=eq.${gerenteId}`, {
      method: "DELETE",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
    });
    await fetch(`${supabaseUrl}/rest/v1/assinaturas`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        user_id: gerenteId,
        plano_tipo: assinatura?.plano_tipo ?? "free",
        status: "active",
        payment_provider: "multi_empresa",
      }),
    });

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
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${gerenteId}`, {
        method: "DELETE",
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
      });
      return json({ error: "Erro ao criar empresa: " + empresaError.message }, 500);
    }

    // Vincular gerente à empresa
    await supabase.from("empresa_usuarios").insert({
      empresa_id: empresa.id,
      proprietario_id: user.id,
      gerente_id: gerenteId,
      permissoes: { pdv: true, os: true, clientes: true, produtos: true, financeiro: false, relatorios: false, funcionarios: false, configuracoes: false, metas: false },
    });

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
