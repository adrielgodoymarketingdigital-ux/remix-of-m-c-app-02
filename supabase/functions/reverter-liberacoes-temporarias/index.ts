import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import { LiberacaoRow, reverterLiberacao } from "../_shared/reverter-liberacao.ts";

// Dois modos:
//   - CRON (body vazio / sem liberacao_id): reverte todas as liberações
//     'ativa' com expira_em <= now(). Notifica admin só em conflito/erro.
//   - MANUAL (body { liberacao_id }): revoga UMA liberação agora. Exige JWT
//     de admin. estado final = 'revogada_manual'.

const LIB_COLS =
  "id, user_id, email, estado, plano_concedido, status_concedido, plano_anterior, status_anterior, data_fim_anterior, data_proxima_cobranca_anterior, bloqueado_admin_anterior, bloqueado_tipo_anterior, trial_with_card_anterior";

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REVERTER-LIBERACOES] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const liberacaoId = typeof body.liberacao_id === "string" ? body.liberacao_id : null;

    // ---------- MODO MANUAL ----------
    if (liberacaoId) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("No authorization header");
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) throw new Error("Invalid token");

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }

      const { data: lib, error: errLib } = await supabase
        .from("liberacoes_temporarias")
        .select(LIB_COLS)
        .eq("id", liberacaoId)
        .maybeSingle();
      if (errLib) throw errLib;
      if (!lib) {
        return new Response(JSON.stringify({ error: "Liberação não encontrada" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }
      if (lib.estado && lib.estado !== "ativa") {
        return new Response(
          JSON.stringify({ error: `Liberação já está no estado "${lib.estado}"` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
        );
      }

      const res = await reverterLiberacao(supabase, lib as LiberacaoRow, {
        revertidoPor: userData.user.id,
        estadoFinal: "revogada_manual",
        adminId: userData.user.id,
      });

      if (!res.ok && res.conflito) {
        return new Response(
          JSON.stringify({
            error:
              "A assinatura foi alterada por outro processo desde a liberação. Nada foi revertido — verifique manualmente.",
            conflito: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 },
        );
      }
      if (!res.ok) throw new Error(res.erro || "Falha ao reverter");

      return new Response(JSON.stringify({ success: true, modo: res.modo }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ---------- MODO CRON ----------
    const agora = new Date().toISOString();
    const { data: pendentes, error } = await supabase
      .from("liberacoes_temporarias")
      .select(LIB_COLS)
      .eq("estado", "ativa")
      .lte("expira_em", agora);

    if (error) throw error;

    if (!pendentes || pendentes.length === 0) {
      log("Nenhuma liberação vencida");
      return new Response(JSON.stringify({ revertidas: 0, conflitos: 0, erros: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log(`${pendentes.length} liberação(ões) vencida(s)`);

    let revertidas = 0;
    const conflitos: string[] = [];
    const erros: string[] = [];

    for (const lib of pendentes as LiberacaoRow[]) {
      const res = await reverterLiberacao(supabase, lib, {
        revertidoPor: "cron",
        estadoFinal: "revertida",
        adminId: null,
      });
      if (res.ok) {
        revertidas++;
      } else if (res.conflito) {
        conflitos.push(lib.email || lib.user_id);
      } else {
        erros.push(`${lib.email || lib.user_id}: ${res.erro}`);
      }
    }

    log("Resultado", { revertidas, conflitos: conflitos.length, erros: erros.length });

    // Notificar admin SÓ em conflito/erro
    if (conflitos.length > 0 || erros.length > 0) {
      const linhas: string[] = [];
      if (conflitos.length > 0) linhas.push(`Conflito (não revertidas): ${conflitos.join(", ")}`);
      if (erros.length > 0) linhas.push(`Erros: ${erros.join(" | ")}`);

      try {
        await fetch(`${supabaseUrl}/functions/v1/notify-admin`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            title: "⚠️ Reversão de liberação temporária precisou de atenção",
            body: linhas.join(" — "),
            url: "/admin/usuarios",
            event_key: "LIBERACAO_TEMP_CONFLITO",
          }),
        });
      } catch (e) {
        log("Falha ao notificar admin", { message: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(
      JSON.stringify({ revertidas, conflitos: conflitos.length, erros: erros.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
