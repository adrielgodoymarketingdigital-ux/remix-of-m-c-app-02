import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { checkTinyAccessByUserId } from "../_shared/checkTinyAccess.ts";

const TINY_TOKEN_URL =
  "https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token";
const TINY_API_BASE = "https://api.tiny.com.br/api2";

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
      redirect_uri: "https://qztuzcchknptrvkdmdph.supabase.co/functions/v1/tiny-oauth-callback",
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Falha ao renovar token:", resp.status, errText);
    throw new Error(`Falha ao renovar token: ${resp.status} ${errText}`);
  }

  const tokens = await resp.json();
  console.log("Token renovado com sucesso, novo expires_in:", tokens.expires_in);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase.from("tiny_integrations").update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  return tokens.access_token;
}

async function fetchAllPages(
  endpoint: string,
  params: Record<string, string>,
  accessToken: string
): Promise<unknown[]> {
  const allItems: unknown[] = [];
  let page = 1;

  while (true) {
    const body = new URLSearchParams({
      ...params,
      formato: "json",
      pagina: String(page),
    });

    const resp = await fetch(`${TINY_API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${accessToken}`,
      },
      body,
    });

    if (!resp.ok) {
      console.error(`Tiny API HTTP error: ${resp.status} ${await resp.text()}`);
      break;
    }

    const data = await resp.json();
    console.log(`Tiny page ${page} response:`, JSON.stringify(data).slice(0, 500));
    const retorno = data?.retorno;
    if (!retorno || retorno.status_processamento === "3" || retorno.status === "Erro") break;

    // pedidos.pesquisa returns retorno.pedidos = [{pedido: {...}}, ...]
    // Try known list keys; unwrap nested object if needed
    const listKeys = ["pedidos", "contas_receber", "contas_pagar"];
    let items: unknown[] = [];
    for (const key of listKeys) {
      if (Array.isArray(retorno[key])) {
        // Each element may be { pedido: {...} } — unwrap one level
        items = retorno[key].map((el: Record<string, unknown>) => {
          const nested = Object.values(el);
          return nested.length === 1 && typeof nested[0] === "object" ? nested[0] : el;
        });
        break;
      }
    }

    allItems.push(...items);

    // Tiny returns up to 100 per page; stop if less than 100
    if (items.length < 100) break;
    page++;
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

    const { endpoint, params = {} } = await req.json();

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

    // Always refresh — tokens stored may be expired after reconnect issues
    let accessToken: string;
    try {
      console.log("Tentando renovar token para user:", user.id);
      accessToken = await refreshTokens(supabase, user.id, integration.refresh_token);
    } catch (refreshErr) {
      console.error("Refresh falhou, tentando access_token existente:", refreshErr);
      accessToken = integration.access_token;
    }

    // For single-item endpoints (pedido.obter), don't paginate
    const singleEndpoints = ["pedido.obter.php"];
    let result: unknown;

    if (singleEndpoints.some((e) => endpoint.includes(e))) {
      const body = new URLSearchParams({ ...params, formato: "json" });
      const resp = await fetch(`${TINY_API_BASE}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Bearer ${accessToken}`,
        },
        body,
      });
      result = await resp.json();
    } else {
      const items = await fetchAllPages(endpoint, params, accessToken);
      result = { items };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
