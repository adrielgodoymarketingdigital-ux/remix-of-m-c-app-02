import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { checkTinyAccessByUserId } from "../_shared/checkTinyAccess.ts";

const TINY_TOKEN_URL =
  "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token";
const TINY_API_BASE = "https://api.tiny.com.br/public-api/v3";

async function refreshTokens(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  refreshToken: string
): Promise<string> {
  const resp = await fetch(TINY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: Deno.env.get("TINY_CLIENT_ID")!,
      client_secret: Deno.env.get("TINY_CLIENT_SECRET")!,
      refresh_token: refreshToken,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Falha ao renovar token:", resp.status, errText);
    throw new Error(`Falha ao renovar token: ${resp.status} ${errText}`);
  }

  const tokens = await resp.json();
  console.log("Token renovado, expires_in:", tokens.expires_in);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase.from("tiny_integrations").update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  return tokens.access_token;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// API V3 — GET com query params, paginação offset/limit, retry em 429
async function fetchAllPagesV3(
  path: string,
  params: Record<string, string>,
  accessToken: string
): Promise<unknown[]> {
  const allItems: unknown[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const qs = new URLSearchParams({ ...params, limit: String(limit), offset: String(offset) });
    const url = `${TINY_API_BASE}/${path}?${qs.toString()}`;
    console.log(`Tiny V3 GET ${url}`);

    let resp: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      resp = await fetch(url, {
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      if (resp.status === 429) {
        console.warn(`429 rate limit, aguardando 5s (tentativa ${attempt + 1})`);
        await sleep(5000);
        continue;
      }
      break;
    }

    if (!resp || !resp.ok) {
      const errText = await resp?.text();
      console.error(`Tiny V3 HTTP error: ${resp?.status}`, errText);
      break;
    }

    const data = await resp.json();
    console.log("Tiny V3 response:", JSON.stringify(data).slice(0, 500));

    const items: unknown[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.itens)
      ? data.itens
      : [];

    allItems.push(...items);

    if (items.length < limit) break;
    offset += limit;
  }

  return allItems;
}

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
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

    const { endpoint, params = {}, single = false } = await req.json();

    const { data: integration, error: intError } = await supabase
      .from("tiny_integrations")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", user.id)
      .single();

    if (intError || !integration) {
      return new Response(JSON.stringify({ error: "Integração não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refresh se expirado (com 300s de margem conforme recomendação Tiny)
    let accessToken = integration.access_token;
    const expiresAt = new Date(integration.expires_at).getTime();
    if (Date.now() > expiresAt - 300_000) {
      try {
        accessToken = await refreshTokens(supabase, user.id, integration.refresh_token);
      } catch (refreshErr) {
        console.error("Refresh falhou, usando token existente:", refreshErr);
      }
    }

    if (single) {
      const qs = Object.keys(params).length ? `?${new URLSearchParams(params)}` : "";
      const resp = await fetch(`${TINY_API_BASE}/${endpoint}${qs}`, {
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items = await fetchAllPagesV3(endpoint, params, accessToken);
    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
