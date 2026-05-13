import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkTinyAccessByUserId } from "../_shared/checkTinyAccess.ts";

const TINY_TOKEN_URL =
  "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // user_id

  if (!code || !state) {
    return Response.redirect("https://appmec.in/os?error=missing_params");
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate state is a valid user_id
    const { data: userCheck, error: userError } = await supabase.auth.admin.getUserById(state);
    if (userError || !userCheck.user) {
      return Response.redirect("https://appmec.in/os?error=invalid_state");
    }

    const temAcesso = await checkTinyAccessByUserId(state);
    if (!temAcesso) {
      return Response.redirect("https://appmec.in/os?error=acesso_negado");
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(TINY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: Deno.env.get("TINY_CLIENT_ID")!,
        client_secret: Deno.env.get("TINY_CLIENT_SECRET")!,
        redirect_uri:
          "https://qztuzcchknptrvkdmdph.supabase.co/functions/v1/tiny-oauth-callback",
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("Token exchange failed:", errText);
      return Response.redirect("https://appmec.in/os?error=token_exchange_failed");
    }

    const tokens = await tokenResponse.json();
    console.log("Token recebido do Tiny, expires_in:", tokens.expires_in);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert into tiny_integrations
    console.log("Tentando salvar para user_id:", state);
    const { error: dbError } = await supabase.from("tiny_integrations").upsert(
      {
        user_id: state,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (dbError) {
      console.error("Erro ao salvar no banco:", JSON.stringify(dbError));
      const detail = encodeURIComponent(dbError.message ?? "unknown");
      return Response.redirect(`https://appmec.in/os?error=db_error&detail=${detail}`);
    }

    return Response.redirect(
      "https://appmec.in/os?tab=terceirizada&connected=true"
    );
  } catch (err) {
    console.error("OAuth callback error:", err);
    return Response.redirect("https://appmec.in/os?error=unexpected");
  }
});
