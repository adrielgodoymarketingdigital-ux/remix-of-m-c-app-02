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

async function enviarPushOneSignal(titulo: string, mensagem: string): Promise<void> {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

  if (!appId || !restApiKey) {
    log("⚠️ ONESIGNAL_APP_ID ou ONESIGNAL_REST_API_KEY não configurados");
    return;
  }

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${restApiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      included_segments: ["Subscribed Users"],
      headings: { en: titulo, pt: titulo },
      contents: { en: mensagem, pt: mensagem },
    }),
  });

  const body = await res.text();
  log("OneSignal respondeu", { status: res.status, body: body.substring(0, 200) });
}

async function verificarPreferencia(
  supabaseAdmin: ReturnType<typeof createClient>,
  chave: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("configuracoes_admin")
    .select("preferencias_notificacao")
    .limit(1)
    .maybeSingle();

  if (!data?.preferencias_notificacao) return true;

  const prefs = data.preferencias_notificacao as Record<string, boolean>;
  return prefs[chave] !== false;
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

    const ativa = await verificarPreferencia(supabaseAdmin, "notif_novo_cadastro");
    if (ativa) {
      await enviarPushOneSignal(
        "Novo cadastro!",
        "Um novo usuário acabou de se cadastrar no Méc."
      );
      log("✅ Push enviado para novo cadastro");
    } else {
      log("⏭️ Notificação de novo cadastro desativada nas preferências");
    }

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
