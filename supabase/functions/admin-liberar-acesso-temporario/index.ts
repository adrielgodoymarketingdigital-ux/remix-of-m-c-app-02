import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import { LiberacaoRow, reverterLiberacao } from "../_shared/reverter-liberacao.ts";

// Concede uma liberação temporária de acesso.
//   - Só admin.
//   - Snapshot do estado atual da assinatura -> liberacoes_temporarias.
//   - Se já houver uma liberação ativa p/ o usuário, ela é revogada antes
//     (restaurando o snapshot dela) para respeitar uq_liberacao_ativa_por_user.
//   - Se o alvo é assinante pago real ativo e confirmar_pagante_ativo != true,
//     responde 409 { requer_confirmacao: true } para a UI pedir confirmação.

const PLANOS_VALIDOS = [
  "trial",
  "basico_mensal",
  "basico_anual",
  "intermediario_mensal",
  "intermediario_anual",
  "profissional_mensal",
  "profissional_anual",
  "profissional_ultra_mensal",
  "profissional_ultra_anual",
];

const ASSINATURA_COLS =
  "plano_tipo, status, data_fim, data_proxima_cobranca, payment_provider, pagarme_subscription_id, bloqueado_admin, bloqueado_tipo, trial_with_card, liberacao_temp_id";

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ADMIN-LIBERAR-ACESSO-TEMP] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase configuration");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Invalid token");
    const adminId = userData.user.id;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const body = await req.json();
    const userId = (body?.user_id ?? "").toString();
    const planoTipo = (body?.plano_tipo ?? "").toString();
    const duracaoValor = Number(body?.duracao_valor);
    const duracaoUnidade = (body?.duracao_unidade ?? "horas").toString();
    const motivo = body?.motivo ? String(body.motivo) : null;
    const confirmarPaganteAtivo = body?.confirmar_pagante_ativo === true;

    if (!userId) throw new Error("user_id é obrigatório");
    if (!PLANOS_VALIDOS.includes(planoTipo)) throw new Error(`Plano inválido: ${planoTipo}`);
    if (!["horas", "dias"].includes(duracaoUnidade)) throw new Error("duracao_unidade inválida");
    if (!Number.isFinite(duracaoValor) || duracaoValor <= 0 || !Number.isInteger(duracaoValor)) {
      throw new Error("duracao_valor deve ser um inteiro positivo");
    }
    if (duracaoUnidade === "horas" && duracaoValor > 720) throw new Error("Máximo de 720 horas");
    if (duracaoUnidade === "dias" && duracaoValor > 365) throw new Error("Máximo de 365 dias");

    const LIB_COLS =
      "id, user_id, email, estado, plano_concedido, status_concedido, plano_anterior, status_anterior, data_fim_anterior, data_proxima_cobranca_anterior, bloqueado_admin_anterior, bloqueado_tipo_anterior, trial_with_card_anterior";

    // Estado atual da assinatura (para snapshot / checagens)
    let { data: assinatura } = await supabase
      .from("assinaturas")
      .select(ASSINATURA_COLS)
      .eq("user_id", userId)
      .maybeSingle();

    // Se já há uma liberação ativa, o "baseline" real do usuário é o snapshot
    // guardado nela — não o estado atual da assinatura (que está sob liberação).
    let libAtual:
      | {
          id: string;
          estado: string;
          plano_anterior: string | null;
          status_anterior: string | null;
        }
      | null = null;
    if (assinatura?.liberacao_temp_id) {
      const { data } = await supabase
        .from("liberacoes_temporarias")
        .select(`${LIB_COLS}, era_pagante_real`)
        .eq("id", assinatura.liberacao_temp_id)
        .maybeSingle();
      if (data && data.estado === "ativa") libAtual = data;
    }

    // Determinar se o baseline é assinante pago real ativo (gate de confirmação)
    const baseline = libAtual
      ? {
          status: libAtual.status_anterior,
          // era_pagante_real foi calculado quando a liberação anterior foi criada
          eraPaganteReal:
            (libAtual as unknown as { era_pagante_real?: boolean }).era_pagante_real === true,
          plano_tipo: libAtual.plano_anterior,
        }
      : {
          status: assinatura?.status ?? null,
          eraPaganteReal:
            !!assinatura &&
            assinatura.status === "active" &&
            !!assinatura.payment_provider &&
            !!assinatura.pagarme_subscription_id,
          plano_tipo: assinatura?.plano_tipo ?? null,
        };

    const eraPaganteReal = baseline.eraPaganteReal;

    if (eraPaganteReal && !confirmarPaganteAtivo) {
      // HTTP 200 de propósito: sinal de aplicação (não é erro de transporte),
      // assim o corpo chega em `data` no supabase-js sem precisar ler o contexto do erro.
      return new Response(
        JSON.stringify({
          requer_confirmacao: true,
          message:
            "Este usuário tem assinatura paga real ativa. Confirme para fazer o upgrade temporário — o plano real será restaurado ao fim da liberação.",
          resumo: { plano_tipo: baseline.plano_tipo, status: baseline.status },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Confirmado (ou não necessário): revogar liberação ativa anterior antes de criar a nova
    if (assinatura?.liberacao_temp_id && libAtual) {
      const { data: libRow } = await supabase
        .from("liberacoes_temporarias")
        .select(LIB_COLS)
        .eq("id", libAtual.id)
        .maybeSingle();

      if (libRow) {
        log("Revogando liberação ativa anterior", { id: libAtual.id });
        const rev = await reverterLiberacao(supabase, libRow as LiberacaoRow, {
          revertidoPor: adminId,
          estadoFinal: "revogada_manual",
          adminId,
        });
        if (!rev.ok && !rev.conflito) throw new Error(rev.erro || "Falha ao revogar liberação anterior");
      }

      // Reler estado da assinatura após a reversão (é a base real do novo snapshot)
      const relido = await supabase
        .from("assinaturas")
        .select(ASSINATURA_COLS)
        .eq("user_id", userId)
        .maybeSingle();
      assinatura = relido.data ?? assinatura;
    }

    const agoraDate = new Date();
    const expira = new Date(agoraDate);
    if (duracaoUnidade === "horas") expira.setHours(expira.getHours() + duracaoValor);
    else expira.setDate(expira.getDate() + duracaoValor);

    const agora = agoraDate.toISOString();
    const expiraIso = expira.toISOString();
    const statusConcedido = planoTipo === "trial" ? "trialing" : "active";
    const unidadeLabel =
      duracaoUnidade === "horas"
        ? `${duracaoValor} hora${duracaoValor !== 1 ? "s" : ""}`
        : `${duracaoValor} dia${duracaoValor !== 1 ? "s" : ""}`;

    // Dados para exibição / auditoria
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome, email")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("nome, email")
      .eq("user_id", adminId)
      .maybeSingle();

    // 1) Registrar a liberação (com snapshot do estado atual)
    const { data: novaLib, error: errLib } = await supabase
      .from("liberacoes_temporarias")
      .insert({
        user_id: userId,
        email: profile?.email ?? null,
        admin_id: adminId,
        plano_concedido: planoTipo,
        status_concedido: statusConcedido,
        concedido_em: agora,
        expira_em: expiraIso,
        duracao_texto: unidadeLabel,
        plano_anterior: assinatura?.plano_tipo ?? null,
        status_anterior: assinatura?.status ?? null,
        data_fim_anterior: assinatura?.data_fim ?? null,
        data_proxima_cobranca_anterior: assinatura?.data_proxima_cobranca ?? null,
        bloqueado_admin_anterior: assinatura?.bloqueado_admin ?? null,
        bloqueado_tipo_anterior: assinatura?.bloqueado_tipo ?? null,
        trial_with_card_anterior: assinatura?.trial_with_card ?? null,
        era_pagante_real: eraPaganteReal,
        estado: "ativa",
        motivo,
      })
      .select("id")
      .single();

    if (errLib) throw new Error(`Erro ao registrar liberação: ${errLib.message}`);

    // 2) Aplicar o acesso na assinatura
    const updateData: Record<string, unknown> = {
      plano_tipo: planoTipo,
      status: statusConcedido,
      data_inicio: agora,
      data_fim: expiraIso,
      data_proxima_cobranca: expiraIso,
      bloqueado_admin: false,
      bloqueado_admin_motivo: null,
      bloqueado_admin_em: null,
      bloqueado_tipo: null,
      trial_canceled: false,
      liberacao_temp_id: novaLib.id,
      updated_at: agora,
    };
    if (planoTipo === "trial") {
      updateData.trial_started_at = agora;
      updateData.trial_end_at = expiraIso;
      updateData.trial_with_card = false;
      updateData.trial_converted = false;
    }

    let applyError: string | null = null;
    if (assinatura) {
      const { error } = await supabase.from("assinaturas").update(updateData).eq("user_id", userId);
      if (error) applyError = error.message;
    } else {
      const { error } = await supabase
        .from("assinaturas")
        .insert({ user_id: userId, ...updateData });
      if (error) applyError = error.message;
    }

    if (applyError) {
      // rollback best-effort do registro de liberação
      await supabase.from("liberacoes_temporarias").delete().eq("id", novaLib.id);
      throw new Error(`Erro ao aplicar acesso: ${applyError}`);
    }

    // 3) Auditoria
    await supabase.from("historico_bloqueios").insert({
      user_id: userId,
      admin_id: adminId,
      acao: "liberacao",
      motivo: motivo || `Liberação temporária: ${planoTipo} por ${unidadeLabel}`,
      user_nome: profile?.nome ?? null,
      user_email: profile?.email ?? null,
      admin_nome: adminProfile?.nome ?? null,
      admin_email: adminProfile?.email ?? null,
      tipo_bloqueio: null,
    });

    log("Liberação concedida", { userId, planoTipo, expira: expiraIso });

    return new Response(
      JSON.stringify({
        success: true,
        liberacao_id: novaLib.id,
        expira_em: expiraIso,
        message: `Acesso ${planoTipo} liberado por ${unidadeLabel}. Reverte automaticamente ao expirar.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
