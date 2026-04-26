import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verificar autenticação do usuário que está fazendo a requisição
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("❌ Sem header de autorização");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar cliente com o token do usuário para verificar identidade
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("❌ Erro ao obter usuário:", userError);
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se o usuário é admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("❌ Usuário não é admin:", user.id);
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem deletar usuários." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Admin verificado:", user.id);

    // Obter dados da requisição
    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Não permitir que o admin delete a si mesmo
    if (user_id === user.id) {
      return new Response(
        JSON.stringify({ error: "Você não pode deletar sua própria conta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter dados do usuário que será deletado (para histórico)
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("nome, email")
      .eq("user_id", user_id)
      .maybeSingle();

    // Obter dados do admin (para histórico)
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("nome, email")
      .eq("user_id", user.id)
      .maybeSingle();

    console.log(`🗑️ Deletando usuário:`, user_id, userProfile?.nome || "Sem nome");

    // Deletar dados relacionados primeiro (em ordem de dependência)
    // 1. Deletar mensagens de suporte
    await supabaseAdmin
      .from("mensagens_suporte")
      .delete()
      .eq("remetente_id", user_id);

    // 2. Deletar conversas de suporte
    await supabaseAdmin
      .from("conversas_suporte")
      .delete()
      .eq("user_id", user_id);

    // 3. Deletar feedbacks
    await supabaseAdmin
      .from("feedbacks")
      .delete()
      .eq("user_id", user_id);

    // 4. Deletar eventos de usuário
    await supabaseAdmin
      .from("user_events")
      .delete()
      .eq("user_id", user_id);

    // 5. Deletar onboarding
    await supabaseAdmin
      .from("user_onboarding")
      .delete()
      .eq("user_id", user_id);

    // 6. Deletar push subscriptions
    await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user_id);

    // 7. Deletar vendas_cupons (precisa do ID das vendas primeiro)
    const { data: vendas } = await supabaseAdmin
      .from("vendas")
      .select("id")
      .eq("user_id", user_id);
    
    if (vendas && vendas.length > 0) {
      const vendaIds = vendas.map(v => v.id);
      await supabaseAdmin
        .from("vendas_cupons")
        .delete()
        .in("venda_id", vendaIds);
    }

    // 8. Deletar vendas
    await supabaseAdmin
      .from("vendas")
      .delete()
      .eq("user_id", user_id);

    // 9. Deletar ordens de serviço
    await supabaseAdmin
      .from("ordens_servico")
      .delete()
      .eq("user_id", user_id);

    // 10. Deletar clientes
    await supabaseAdmin
      .from("clientes")
      .delete()
      .eq("user_id", user_id);

    // 11. Deletar compras_dispositivos
    await supabaseAdmin
      .from("compras_dispositivos")
      .delete()
      .eq("user_id", user_id);

    // 12. Deletar dispositivos
    await supabaseAdmin
      .from("dispositivos")
      .delete()
      .eq("user_id", user_id);

    // 13. Deletar produtos
    await supabaseAdmin
      .from("produtos")
      .delete()
      .eq("user_id", user_id);

    // 14. Deletar peças
    await supabaseAdmin
      .from("pecas")
      .delete()
      .eq("user_id", user_id);

    // 15. Deletar serviços
    await supabaseAdmin
      .from("servicos")
      .delete()
      .eq("user_id", user_id);

    // 16. Deletar fornecedores
    await supabaseAdmin
      .from("fornecedores")
      .delete()
      .eq("user_id", user_id);

    // 17. Deletar origem_pessoas
    await supabaseAdmin
      .from("origem_pessoas")
      .delete()
      .eq("user_id", user_id);

    // 18. Deletar cupons
    await supabaseAdmin
      .from("cupons")
      .delete()
      .eq("user_id", user_id);

    // 19. Deletar contas
    await supabaseAdmin
      .from("contas")
      .delete()
      .eq("user_id", user_id);

    // 20. Deletar orçamentos
    await supabaseAdmin
      .from("orcamentos")
      .delete()
      .eq("user_id", user_id);

    // 21. Deletar configurações da loja
    await supabaseAdmin
      .from("configuracoes_loja")
      .delete()
      .eq("user_id", user_id);

    // 22. Deletar contador de OS
    await supabaseAdmin
      .from("user_os_counters")
      .delete()
      .eq("user_id", user_id);

    // 23. Deletar assinatura
    await supabaseAdmin
      .from("assinaturas")
      .delete()
      .eq("user_id", user_id);

    // 24. Deletar profile
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", user_id);

    // 25. Finalmente, deletar o usuário do auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteAuthError) {
      console.error("❌ Erro ao deletar usuário do auth:", deleteAuthError);
      return new Response(
        JSON.stringify({ error: "Erro ao deletar usuário: " + deleteAuthError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Usuário deletado com sucesso:", user_id);

    // Registrar evento de deleção (notificação admin)
    await supabaseAdmin
      .from("admin_notifications")
      .insert({
        tipo: "usuario_deletado",
        titulo: "Usuário deletado",
        mensagem: `Usuário ${userProfile?.nome || user_id} (${userProfile?.email || "sem email"}) foi deletado por ${adminProfile?.nome || "Admin"}`,
        dados: {
          user_id_deletado: user_id,
          user_nome: userProfile?.nome,
          user_email: userProfile?.email,
          admin_id: user.id,
          admin_nome: adminProfile?.nome,
          admin_email: adminProfile?.email,
        },
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Usuário ${userProfile?.nome || user_id} deletado com sucesso` 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("❌ Erro geral:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno: " + error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
