import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[NOTIFICAR-NOVO-CADASTRO] ${step}${d}`);
};

function hydrateTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

async function enviarPushOneSignal(titulo: string, mensagem: string): Promise<void> {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

  if (!appId || !restApiKey) {
    log("⚠️ Credenciais não configuradas");
    return;
  }

  const res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${restApiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      included_segments: ["All"],
      headings: { en: titulo, pt: titulo },
      contents: { en: mensagem, pt: mensagem },
    }),
  });

  const body = await res.text();
  log("OneSignal respondeu", { status: res.status, body: body.substring(0, 500) });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();
    log("Payload recebido", { type: body?.type, table: body?.table });

    // Supabase database webhook: type=INSERT, table=users, schema=auth
    if (body?.type !== "INSERT" || body?.table !== "users") {
      log("Evento ignorado", { type: body?.type, table: body?.table });
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email: string = body?.record?.email ?? "";

    // Busca regra na tabela notification_rules
    const { data: regra } = await supabaseAdmin
      .from("notification_rules")
      .select("active, title_template, body_template")
      .eq("event_type", "USER_REGISTERED")
      .maybeSingle();

    if (!regra) {
      log("⚠️ Regra USER_REGISTERED não encontrada na tabela notification_rules");
      return new Response(JSON.stringify({ received: true, skipped: true, reason: "no_rule" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!regra.active) {
      log("⏭️ Regra USER_REGISTERED está inativa");
      return new Response(JSON.stringify({ received: true, skipped: true, reason: "rule_inactive" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const variaveis = { email };
    const titulo = hydrateTemplate(regra.title_template, variaveis);
    const mensagem = hydrateTemplate(regra.body_template, variaveis);

    await enviarPushOneSignal(titulo, mensagem);
    log("✅ Push enviado para novo cadastro", { email });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
