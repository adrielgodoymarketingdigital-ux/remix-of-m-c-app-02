// Lógica compartilhada de reversão de liberação temporária.
// Usada por:
//   - reverter-liberacoes-temporarias (cron: expiradas; manual: uma liberacao_id)
//   - admin-liberar-acesso-temporario (revoga a liberação ativa anterior antes de criar a nova)
//
// Reversão = snapshot & restore (Opção 1). Piso "free limpo" quando o estado
// anterior não era ativo (plano_anterior ausente/free OU status_anterior não
// em active/trialing).

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface LiberacaoRow {
  id: string;
  user_id: string;
  email: string | null;
  estado?: string;
  plano_concedido: string;
  status_concedido: string;
  plano_anterior: string | null;
  status_anterior: string | null;
  data_fim_anterior: string | null;
  data_proxima_cobranca_anterior: string | null;
  bloqueado_admin_anterior: boolean | null;
  bloqueado_tipo_anterior: string | null;
  trial_with_card_anterior: boolean | null;
}

export interface ReverterOpts {
  revertidoPor: string; // 'cron' | '<admin_id>'
  estadoFinal: "revertida" | "revogada_manual";
  adminId?: string | null; // p/ historico_bloqueios quando revogação manual
}

export interface ReverterResultado {
  ok: boolean;
  conflito?: boolean;
  erro?: string;
  modo?: "restaurado_exato" | "free_limpo";
}

export async function reverterLiberacao(
  supabase: SupabaseClient,
  lib: LiberacaoRow,
  opts: ReverterOpts,
): Promise<ReverterResultado> {
  const agora = new Date().toISOString();

  // 1) Estado atual da assinatura
  const { data: assinatura, error: errAss } = await supabase
    .from("assinaturas")
    .select("plano_tipo, status, liberacao_temp_id")
    .eq("user_id", lib.user_id)
    .maybeSingle();

  if (errAss) return { ok: false, erro: `Erro ao ler assinatura: ${errAss.message}` };

  // 2) Conflict check — algo mudou a assinatura fora da liberação?
  const bate =
    !!assinatura &&
    assinatura.liberacao_temp_id === lib.id &&
    assinatura.plano_tipo === lib.plano_concedido &&
    assinatura.status === lib.status_concedido;

  if (!bate) {
    await supabase
      .from("liberacoes_temporarias")
      .update({ estado: "conflito_sem_reverter", revertido_em: agora, revertido_por: opts.revertidoPor })
      .eq("id", lib.id);
    return { ok: false, conflito: true };
  }

  // 3) Decidir modo de restauração (regra híbrida)
  const anteriorAtivo =
    !!lib.plano_anterior &&
    lib.plano_anterior !== "free" &&
    (lib.status_anterior === "active" || lib.status_anterior === "trialing");

  let update: Record<string, unknown>;
  let modo: "restaurado_exato" | "free_limpo";

  if (anteriorAtivo) {
    modo = "restaurado_exato";
    update = {
      plano_tipo: lib.plano_anterior,
      status: lib.status_anterior,
      data_fim: lib.data_fim_anterior,
      data_proxima_cobranca: lib.data_proxima_cobranca_anterior,
      trial_with_card: lib.trial_with_card_anterior,
      liberacao_temp_id: null,
      updated_at: agora,
    };
    if (lib.bloqueado_admin_anterior === true) {
      update.bloqueado_admin = true;
      update.bloqueado_tipo = lib.bloqueado_tipo_anterior;
      update.bloqueado_admin_motivo = "Bloqueio restaurado após fim de liberação temporária";
      update.bloqueado_admin_em = agora;
    } else {
      update.bloqueado_admin = false;
      update.bloqueado_tipo = null;
      update.bloqueado_admin_motivo = null;
      update.bloqueado_admin_em = null;
    }
  } else {
    modo = "free_limpo";
    update = {
      plano_tipo: "free",
      status: "active",
      data_fim: null,
      data_proxima_cobranca: null,
      trial_with_card: false,
      bloqueado_admin: false,
      bloqueado_tipo: null,
      bloqueado_admin_motivo: null,
      bloqueado_admin_em: null,
      liberacao_temp_id: null,
      updated_at: agora,
    };
  }

  const { error: errUpd } = await supabase.from("assinaturas").update(update).eq("user_id", lib.user_id);
  if (errUpd) return { ok: false, erro: `Erro ao restaurar assinatura: ${errUpd.message}` };

  // 4) Fechar a liberação
  await supabase
    .from("liberacoes_temporarias")
    .update({ estado: opts.estadoFinal, revertido_em: agora, revertido_por: opts.revertidoPor })
    .eq("id", lib.id);

  // 5) Auditoria
  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, email")
    .eq("user_id", lib.user_id)
    .maybeSingle();

  let adminNome: string | null = null;
  let adminEmail: string | null = null;
  if (opts.adminId) {
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("nome, email")
      .eq("user_id", opts.adminId)
      .maybeSingle();
    adminNome = adminProfile?.nome ?? null;
    adminEmail = adminProfile?.email ?? null;
  }

  await supabase.from("historico_bloqueios").insert({
    user_id: lib.user_id,
    admin_id: opts.adminId ?? lib.user_id, // NOT NULL; cron não tem admin — usa o próprio user_id
    acao: "liberacao_revertida",
    motivo:
      opts.estadoFinal === "revogada_manual"
        ? `Liberação temporária revogada manualmente (${modo === "free_limpo" ? "voltou para Free" : "restaurado estado anterior"})`
        : `Liberação temporária expirada e revertida pelo sistema (${modo === "free_limpo" ? "voltou para Free" : "restaurado estado anterior"})`,
    user_nome: profile?.nome ?? lib.email ?? null,
    user_email: profile?.email ?? lib.email ?? null,
    admin_nome: adminNome,
    admin_email: adminEmail,
    tipo_bloqueio: null,
  });

  return { ok: true, modo };
}
