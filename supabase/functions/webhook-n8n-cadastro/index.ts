import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[webhook-n8n-cadastro] Missing auth header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("[webhook-n8n-cadastro] Auth error:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authenticatedUserId = user.id;

    const { nome, telefone } = await req.json();

    if (!nome || !telefone) {
      return new Response(
        JSON.stringify({ error: "nome e telefone são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Garantir formato internacional: 55 + DDD + número (só dígitos)
    const telefoneFormatado = telefone.replace(/\D/g, "").startsWith("55")
      ? telefone.replace(/\D/g, "")
      : "55" + telefone.replace(/\D/g, "");

    const webhookUrl = "https://n8n.appmec.in/webhook/webhookn8n";

    // Use authenticated user ID instead of client-supplied value
    const payload = JSON.stringify({ nome, telefone: telefoneFormatado, user_id: authenticatedUserId });
    const headers = { "Content-Type": "application/json" };

    console.log("[webhook-n8n-cadastro] Sending to n8n:", { nome, telefone: telefoneFormatado, user_id: authenticatedUserId });

    const response = await fetch(webhookUrl, { method: "POST", headers, body: payload });

    const responseText = await response.text();
    console.log("[webhook-n8n-cadastro] followup:", response.status, responseText);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[webhook-n8n-cadastro] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
