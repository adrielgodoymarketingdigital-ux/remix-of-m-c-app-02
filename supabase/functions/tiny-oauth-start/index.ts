import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { checkTinyAccessByUserId } from "../_shared/checkTinyAccess.ts";

const TINY_AUTH_URL =
  "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const temAcesso = await checkTinyAccessByUserId(user.id);
    if (!temAcesso) {
      return new Response(
        JSON.stringify({ error: "Acesso restrito ao plano Ultra." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const params = new URLSearchParams({
      client_id: Deno.env.get("TINY_CLIENT_ID")!,
      redirect_uri:
        "https://qztuzcchknptrvkdmdph.supabase.co/functions/v1/tiny-oauth-callback",
      response_type: "code",
      scope: "openid",
      state: user.id,
    });

    const authUrl = `${TINY_AUTH_URL}?${params.toString()}`;
    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
