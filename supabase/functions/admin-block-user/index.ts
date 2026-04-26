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
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem bloquear usuários." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Admin verificado:", user.id);

    // Obter dados do admin (para histórico)
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("nome, email")
      .eq("user_id", user.id)
      .maybeSingle();

    // Obter dados da requisição
    const body = await req.json();
    const { user_id, bloquear, motivo, tipo_bloqueio } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter dados do usuário que será bloqueado (para histórico e push)
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("nome, email")
      .eq("user_id", user_id)
      .maybeSingle();

    // Validar tipo de bloqueio
    const tipoBloqueioValido = tipo_bloqueio === "indeterminado" || tipo_bloqueio === "ate_assinar";
    const tipoBloqueioFinal = tipoBloqueioValido ? tipo_bloqueio : "ate_assinar";

    console.log(`📝 ${bloquear ? "Bloqueando" : "Desbloqueando"} usuário:`, user_id, "tipo:", tipoBloqueioFinal);

    // Atualizar assinatura do usuário
    if (bloquear) {
      const motivoFinal = motivo || (tipoBloqueioFinal === "ate_assinar" 
        ? "Bloqueado até assinar um plano pago" 
        : "Bloqueado por prazo indeterminado pelo administrador");

      const { error: updateError } = await supabaseAdmin
        .from("assinaturas")
        .update({
          bloqueado_admin: true,
          bloqueado_admin_motivo: motivoFinal,
          bloqueado_admin_em: new Date().toISOString(),
          bloqueado_tipo: tipoBloqueioFinal,
        })
        .eq("user_id", user_id);

      if (updateError) {
        console.error("❌ Erro ao bloquear usuário:", updateError);
        return new Response(
          JSON.stringify({ error: "Erro ao bloquear usuário: " + updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("✅ Usuário bloqueado com sucesso:", user_id, "tipo:", tipoBloqueioFinal);
      
      // Registrar no histórico de bloqueios
      await supabaseAdmin
        .from("historico_bloqueios")
        .insert({
          user_id: user_id,
          admin_id: user.id,
          acao: "bloqueio",
          tipo_bloqueio: tipoBloqueioFinal,
          motivo: motivoFinal,
          user_nome: userProfile?.nome || null,
          user_email: userProfile?.email || null,
          admin_nome: adminProfile?.nome || null,
          admin_email: adminProfile?.email || null,
        });

      console.log("✅ Histórico de bloqueio registrado");

      // Registrar evento de bloqueio para auditoria (notificações admin)
      await supabaseAdmin
        .from("admin_notifications")
        .insert({
          tipo: "bloqueio_usuario",
          titulo: tipoBloqueioFinal === "ate_assinar" ? "Usuário bloqueado até assinar" : "Usuário bloqueado permanentemente",
          mensagem: `Usuário ${userProfile?.nome || user_id} foi bloqueado. Tipo: ${tipoBloqueioFinal === "ate_assinar" ? "Até assinar plano" : "Indeterminado"}. Motivo: ${motivoFinal}`,
          dados: {
            user_id_bloqueado: user_id,
            admin_id: user.id,
            motivo: motivoFinal,
            tipo_bloqueio: tipoBloqueioFinal,
          },
        });

      // Enviar notificação push para o usuário bloqueado (em background)
      if (tipoBloqueioFinal === "ate_assinar") {
        console.log("📱 Enviando push notification para usuário bloqueado...");
        
        // Buscar subscriptions do usuário
        const { data: subscriptions } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", user_id)
          .eq("is_active", true);

        if (subscriptions && subscriptions.length > 0) {
          // Chamar a edge function de push (via HTTP interno)
          try {
            const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                user_ids: [user_id],
                notification: {
                  title: "⚠️ Acesso Bloqueado",
                  body: "Seu período de teste expirou. Assine um plano para continuar usando o MecApp e desbloquear todas as funcionalidades!",
                  icon: "/pwa-192x192.png",
                  url: "/cadastro-plano",
                  data: { action: "subscribe" }
                }
              }),
            });
            
            if (pushResponse.ok) {
              console.log("✅ Push notification enviada com sucesso");
            } else {
              console.log("⚠️ Falha ao enviar push:", await pushResponse.text());
            }
          } catch (pushError) {
            console.error("⚠️ Erro ao enviar push notification:", pushError);
            // Não falhar o bloqueio por causa do push
          }
        } else {
          console.log("📱 Usuário não tem push subscriptions ativas");
        }
      }

    } else {
      const { error: updateError } = await supabaseAdmin
        .from("assinaturas")
        .update({
          bloqueado_admin: false,
          bloqueado_admin_motivo: null,
          bloqueado_admin_em: null,
          bloqueado_tipo: null,
        })
        .eq("user_id", user_id);

      if (updateError) {
        console.error("❌ Erro ao desbloquear usuário:", updateError);
        return new Response(
          JSON.stringify({ error: "Erro ao desbloquear usuário: " + updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("✅ Usuário desbloqueado com sucesso:", user_id);

      // Registrar no histórico de bloqueios
      await supabaseAdmin
        .from("historico_bloqueios")
        .insert({
          user_id: user_id,
          admin_id: user.id,
          acao: "desbloqueio",
          tipo_bloqueio: null,
          motivo: "Desbloqueado pelo administrador",
          user_nome: userProfile?.nome || null,
          user_email: userProfile?.email || null,
          admin_nome: adminProfile?.nome || null,
          admin_email: adminProfile?.email || null,
        });

      console.log("✅ Histórico de desbloqueio registrado");

      // Registrar evento de desbloqueio
      await supabaseAdmin
        .from("admin_notifications")
        .insert({
          tipo: "desbloqueio_usuario",
          titulo: "Usuário desbloqueado",
          mensagem: `Usuário ${userProfile?.nome || user_id} foi desbloqueado pelo administrador`,
          dados: {
            user_id_desbloqueado: user_id,
            admin_id: user.id,
          },
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: bloquear ? "Usuário bloqueado com sucesso" : "Usuário desbloqueado com sucesso" 
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