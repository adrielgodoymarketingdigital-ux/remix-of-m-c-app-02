import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const log = (msg: string, data?: unknown) =>
    console.log(`[CANCELAR-VENCIDAS] ${msg}`, data ? JSON.stringify(data) : "");

  try {
    // Data de carência: 3 dias atrás
    const dataCarencia = new Date();
    dataCarencia.setDate(dataCarencia.getDate() - 3);

    log("Verificando assinaturas vencidas há mais de 3 dias", {
      dataCarencia: dataCarencia.toISOString(),
    });

    // Buscar assinaturas Ticto vencidas há mais de 3 dias
    const { data: assinaturas, error } = await supabase
      .from("assinaturas")
      .select("id, user_id, plano_tipo, data_fim, payment_provider")
      .eq("status", "active")
      .eq("payment_provider", "ticto")
      .lt("data_fim", dataCarencia.toISOString())
      .in("plano_tipo", [
        "basico_mensal", "basico_anual",
        "intermediario_mensal", "intermediario_anual",
        "profissional_mensal", "profissional_anual",
      ]);

    if (error) throw error;

    if (!assinaturas || assinaturas.length === 0) {
      log("Nenhuma assinatura vencida encontrada");
      return new Response(JSON.stringify({ canceladas: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log(`${assinaturas.length} assinatura(s) vencida(s) encontrada(s)`);

    let canceladas = 0;
    const usuariosCancelados: string[] = [];

    for (const ass of assinaturas) {
      // Buscar email do usuário
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, nome")
        .eq("user_id", ass.user_id)
        .maybeSingle();

      // Cancelar assinatura
      const { error: updateError } = await supabase
        .from("assinaturas")
        .update({
          status: "canceled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ass.id);

      if (updateError) {
        log(`Erro ao cancelar assinatura ${ass.id}`, updateError);
        continue;
      }

      canceladas++;
      const nomeUsuario = profile?.nome || profile?.email || ass.user_id;
      usuariosCancelados.push(nomeUsuario);
      log(`Assinatura cancelada para ${nomeUsuario}`);
    }

    // Notificar admin se houve cancelamentos
    if (canceladas > 0) {
      const { data: regra } = await supabase
        .from("notification_rules")
        .select("active, title_template, body_template, url_template")
        .eq("event_type", "SUBSCRIPTION_CANCELED")
        .maybeSingle();

      if (!regra || regra.active !== false) {
        const hydrateTemplate = (template: string, vars: Record<string, string>) =>
          template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");

        const templateVars = {
          total: String(canceladas),
          usuarios: usuariosCancelados.join(", "),
        };

        const titulo = regra?.title_template
          ? hydrateTemplate(regra.title_template, templateVars)
          : "⚠️ Assinatura(s) cancelada(s) automaticamente";

        const corpo = regra?.body_template
          ? hydrateTemplate(regra.body_template, templateVars)
          : `${canceladas} assinatura(s) Ticto vencida(s): ${usuariosCancelados.join(", ")}`;

        const urlDestino = regra?.url_template || "/admin/usuarios";

        await fetch(`${supabaseUrl}/functions/v1/notify-admin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            title: titulo,
            body: corpo,
            url: urlDestino,
            event_key: "SUBSCRIPTION_CANCELED",
          }),
        });

        log(`${canceladas} assinatura(s) cancelada(s) e admin notificado`);
      }
    }

    return new Response(
      JSON.stringify({ canceladas, usuarios: usuariosCancelados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { message: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
