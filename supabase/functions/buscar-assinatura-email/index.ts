import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

// Piso de tempo de resposta: o caminho "email não encontrado / sem assinatura" é
// mais curto que o caminho feliz (busca assinatura + profile). Sem isso, dá para
// distinguir os dois casos pelo tempo de resposta mesmo com corpo de erro idêntico.
const RESPONSE_FLOOR_MS = 700;

async function respondAfterFloor(
  startedAt: number,
  body: Record<string, unknown>,
  status = 200
): Promise<Response> {
  const elapsed = Date.now() - startedAt;
  const remaining = RESPONSE_FLOOR_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Buscar usuário pelo email via API Admin REST (listUsers com filtro)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const searchRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email.trim().toLowerCase())}&page=1&per_page=1`,
      {
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
      }
    );

    const searchData = await searchRes.json();
    const authUser = searchData?.users?.[0];

    if (!authUser) {
      return respondAfterFloor(startedAt, { error: "Nenhuma conta encontrada com este email." }, 404);
    }

    // Buscar assinatura
    const { data: assinatura, error: errAss } = await supabase
      .from("assinaturas")
      .select("plano_tipo, status, data_fim, data_proxima_cobranca")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (errAss) throw errAss;

    if (!assinatura) {
      return respondAfterFloor(startedAt, { error: "Nenhuma assinatura encontrada para este email." }, 404);
    }

    // Retorno reduzido ao estritamente necessário para a tela de renovação:
    // sem nome (cosmético) e sem email (o frontend já sabe o que digitou).
    return respondAfterFloor(startedAt, {
      userId: authUser.id,
      planoTipo: assinatura.plano_tipo,
      status: assinatura.status,
      dataFim: assinatura.data_fim ?? null,
      dataProximaCobranca: assinatura.data_proxima_cobranca ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno.";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
