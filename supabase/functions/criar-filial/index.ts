import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Token inválido");

    // Verificar se é plano Ultra
    const { data: assinatura } = await supabase
      .from('assinaturas')
      .select('plano_tipo')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const isAdmin = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    const planosUltra = ['profissional_ultra_mensal', 'profissional_ultra_anual'];
    if (!isAdmin.data && !planosUltra.includes(assinatura?.plano_tipo || '')) {
      return new Response(
        JSON.stringify({ error: "Funcionalidade exclusiva do Plano Ultra" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar limite de 3 filiais
    const { count } = await supabase
      .from('empresas')
      .select('*', { count: 'exact', head: true })
      .eq('proprietario_id', user.id)
      .eq('ativa', true);

    if ((count || 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Limite de 3 filiais atingido no Plano Ultra" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { nome, cnpj, telefone, endereco, cidade, estado, email_gerente, senha_gerente } = body;

    if (!nome || !email_gerente || !senha_gerente) {
      throw new Error("Nome, email e senha são obrigatórios");
    }

    if (senha_gerente.length < 6) {
      throw new Error("Senha deve ter pelo menos 6 caracteres");
    }

    // Criar usuário gerente
    const { data: gerenteData, error: gerenteError } = await supabase.auth.admin.createUser({
      email: email_gerente,
      password: senha_gerente,
      email_confirm: true,
      user_metadata: { nome, tipo_usuario: 'gerente_filial' },
    });

    if (gerenteError) {
      if (gerenteError.message.includes('already registered')) {
        throw new Error("Este email já está cadastrado no sistema");
      }
      throw new Error("Erro ao criar login: " + gerenteError.message);
    }

    // Criar perfil do gerente
    await supabase.from('profiles').upsert({
      user_id: gerenteData.user.id,
      nome,
      email: email_gerente,
    });

    // Criar assinatura free para o gerente (acesso controlado pelo proprietário)
    await supabase.from('assinaturas').insert({
      user_id: gerenteData.user.id,
      plano_tipo: 'gerente_filial',
      status: 'active',
      payment_provider: 'multi_empresa',
    });

    // Criar empresa
    const { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .insert({
        proprietario_id: user.id,
        nome,
        cnpj: cnpj || null,
        telefone: telefone || null,
        endereco: endereco || null,
        cidade: cidade || null,
        estado: estado || null,
      })
      .select()
      .single();

    if (empresaError) throw new Error("Erro ao criar empresa: " + empresaError.message);

    // Vincular gerente à empresa com permissões padrão
    await supabase.from('empresa_usuarios').insert({
      empresa_id: empresa.id,
      proprietario_id: user.id,
      gerente_id: gerenteData.user.id,
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

    return new Response(
      JSON.stringify({
        sucesso: true,
        empresa,
        gerente_id: gerenteData.user.id,
        mensagem: `Filial "${nome}" criada com sucesso! Login: ${email_gerente}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
