import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[VALIDAR-CUPOM] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Autenticação ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar que o usuário está autenticado (qualquer usuário logado pode validar cupom)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Ler body ──────────────────────────────────────────────────
    const body = await req.json();
    const { codigo } = body as { codigo?: string };

    if (!codigo || typeof codigo !== "string" || codigo.trim().length === 0) {
      return new Response(
        JSON.stringify({ valido: false, mensagem: "Informe o código do cupom." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const codigoNormalizado = codigo.trim().toUpperCase();
    log("Validando cupom", { codigo: codigoNormalizado });

    // ── 3. Buscar cupom com service role (ignora RLS para leitura do checkout) ──
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: cupom, error: cupomError } = await supabaseAdmin
      .from("cupons")
      .select("id, codigo, tipo, valor, ativo, usos_maximos, usos_atuais, expira_em")
      .eq("codigo", codigoNormalizado)
      .maybeSingle();

    if (cupomError) {
      log("Erro ao buscar cupom", { error: cupomError.message });
      return new Response(
        JSON.stringify({ valido: false, mensagem: "Erro ao verificar cupom." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cupom) {
      log("Cupom não encontrado", { codigo: codigoNormalizado });
      return new Response(
        JSON.stringify({ valido: false, mensagem: "Cupom não encontrado." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Validações ────────────────────────────────────────────────
    if (!cupom.ativo) {
      log("Cupom inativo", { codigo: codigoNormalizado });
      return new Response(
        JSON.stringify({ valido: false, mensagem: "Cupom inválido ou expirado." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (cupom.expira_em && new Date(cupom.expira_em) <= new Date()) {
      log("Cupom expirado", { codigo: codigoNormalizado, expira_em: cupom.expira_em });
      return new Response(
        JSON.stringify({ valido: false, mensagem: "Cupom inválido ou expirado." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      cupom.usos_maximos !== null &&
      cupom.usos_maximos !== undefined &&
      cupom.usos_atuais >= cupom.usos_maximos
    ) {
      log("Cupom esgotado", { codigo: codigoNormalizado, usos_atuais: cupom.usos_atuais, usos_maximos: cupom.usos_maximos });
      return new Response(
        JSON.stringify({ valido: false, mensagem: "Cupom inválido ou expirado." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 5. Incrementar usos_atuais ───────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("cupons")
      .update({ usos_atuais: cupom.usos_atuais + 1 })
      .eq("id", cupom.id);

    if (updateError) {
      log("Erro ao incrementar usos", { error: updateError.message });
      // Não bloquear o usuário por erro de contagem — retornar válido mesmo assim
    }

    // ── 6. Montar descrição ──────────────────────────────────────────
    const descricao =
      cupom.tipo === "percent"
        ? `${cupom.valor}% de desconto`
        : `R$ ${(cupom.valor / 100).toFixed(2).replace(".", ",")} de desconto`;

    log("Cupom válido", { codigo: codigoNormalizado, tipo: cupom.tipo, valor: cupom.valor });

    return new Response(
      JSON.stringify({
        valido: true,
        cupomId: cupom.id,
        codigo: cupom.codigo,
        tipo: cupom.tipo,
        valor: cupom.valor,
        descricao,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
