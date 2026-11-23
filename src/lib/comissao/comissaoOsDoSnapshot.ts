/**
 * Fonte ÚNICA de verdade da comissão de OS de um funcionário: o snapshot
 * gravado pelo Sistema B no momento em que a OS foi salva
 * (ordens_servico.comissao_calculada_snapshot e
 * os_tecnicos.comissao_calculada_snapshot).
 *
 * Usado tanto pelo Perfil de Desempenho (PerfilDesempenhoFuncionario) quanto
 * pelo card "Comissões a Pagar" (useComissoes / useComissoesSerieMensal) — os
 * dois passam a mostrar EXATAMENTE o mesmo número por construção.
 *
 * NÃO há mais fallback de "os.total × config atual": se não existe snapshot,
 * a comissão da OS é `null` (o Perfil mostra "—" e o ⚠️ existente explica o
 * motivo; a soma trata `null` como R$ 0). O valor só passa a existir quando a
 * OS é (re)salva pelo wizard.
 */

const STATUS_COMISSIONAVEIS = ["entregue"];

export function isOSComissionavel(status: string | null | undefined): boolean {
  return !!status && STATUS_COMISSIONAVEIS.includes(status.trim().toLowerCase());
}

export interface OsComissaoSnapshotInput {
  status: string | null | undefined;
  /** ordens_servico.comissao_calculada_snapshot (snapshot do Técnico Principal) */
  comissao_calculada_snapshot: number | null | undefined;
  /**
   * Linhas de os_tecnicos DESTE funcionário nesta OS (já filtradas por
   * funcionario_id). Quando existir ao menos uma, elas são a fonte — o
   * snapshot do nível-OS é ignorado (evita a dupla contagem descrita no
   * P3-d de docs/COMISSAO.md).
   */
  tecnicosDoFuncionario: { comissao_calculada_snapshot: number | null | undefined }[];
}

/**
 * Comissão da OS para o funcionário:
 *  - OS não comissionável (status ≠ "entregue")        → 0
 *  - funcionário tem linha(s) em os_tecnicos nesta OS  → Σ dos snapshots dessas linhas (pode ser 0)
 *  - senão, snapshot do nível-OS presente             → esse valor
 *  - senão                                            → null (sem dado; quem soma trata como 0)
 */
export function comissaoOsDoSnapshot(os: OsComissaoSnapshotInput): number | null {
  if (!isOSComissionavel(os.status)) return 0;

  if (os.tecnicosDoFuncionario.length > 0) {
    return os.tecnicosDoFuncionario.reduce(
      (acc, t) => acc + (Number(t.comissao_calculada_snapshot) || 0),
      0,
    );
  }

  if (os.comissao_calculada_snapshot != null) {
    return Number(os.comissao_calculada_snapshot);
  }

  return null;
}

// ===========================================================================
// Vários técnicos na mesma OS (regra "a", 2026-11-23): cada técnico ganha SÓ
// pelo serviço em que está ligado em "Técnicos por Serviço" (os_tecnicos).
// Nada é dividido entre técnicos e ninguém recebe a comissão da OS inteira
// por estar só em os_tecnicos.

/** Linha de os_tecnicos com o mínimo que a comissão precisa. */
export interface LinhaTecnicoComissao {
  os_id: string;
  funcionario_id: string;
  comissao_calculada_snapshot: number | null | undefined;
  servico_id?: string | null;
  servico_nome_snapshot?: string | null;
}

/**
 * A linha foi calculada sobre um serviço da OS? salvarTecnicosOS grava
 * servico_nome_snapshot sempre que achou o serviço (mesmo quando o id do
 * catálogo já foi apagado e servico_id virou null). Linha sem nenhum dos dois
 * = legado "sem serviço ligado" (cálculo antigo: tipo da OS × total da OS).
 */
export function linhaTemServicoLigado(l: Pick<LinhaTecnicoComissao, "servico_id" | "servico_nome_snapshot">): boolean {
  return !!l.servico_id || (l.servico_nome_snapshot != null && l.servico_nome_snapshot !== "");
}

/** O mínimo de uma linha de os_tecnicos para decidir e somar a comissão. */
export type LinhaParticipacao = Pick<LinhaTecnicoComissao, "comissao_calculada_snapshot" | "servico_id" | "servico_nome_snapshot">;

/** Participação de um funcionário numa OS: como principal, por serviço, ou nenhuma (null). */
export interface ParticipacaoOS<L extends LinhaParticipacao = LinhaParticipacao> {
  ehPrincipal: boolean;
  /** Linhas de os_tecnicos DELE nesta OS que contam para a comissão. */
  linhas: L[];
}

/**
 * - Técnico Principal (ordens_servico.funcionario_id): participa sempre, com
 *   TODAS as linhas dele em os_tecnicos — exatamente como antes.
 * - Não principal: participa só se tiver linha ligada a um serviço; linhas
 *   dele sem serviço ligado não contam (técnico sem serviço ligado não ganha
 *   comissão automática — e era R$ 0 antes também).
 */
export function participacaoNaOS<L extends LinhaParticipacao>(
  funcionarioId: string,
  osFuncionarioId: string | null | undefined,
  linhasDoFuncionario: L[],
): ParticipacaoOS<L> | null {
  if (osFuncionarioId === funcionarioId) return { ehPrincipal: true, linhas: linhasDoFuncionario };
  const ligadas = linhasDoFuncionario.filter(linhaTemServicoLigado);
  return ligadas.length > 0 ? { ehPrincipal: false, linhas: ligadas } : null;
}

/**
 * Comissão da OS para o funcionário segundo a participação. Para quem não é
 * o principal o snapshot do nível-OS NUNCA entra (é do principal): só as
 * linhas dele. Para o principal é comissaoOsDoSnapshot sem mudança.
 */
export function comissaoOsDaParticipacao(
  os: { status: string | null | undefined; comissao_calculada_snapshot: number | null | undefined },
  p: { ehPrincipal: boolean; linhas: Pick<LinhaTecnicoComissao, "comissao_calculada_snapshot">[] },
): number | null {
  return comissaoOsDoSnapshot({
    status: os.status,
    comissao_calculada_snapshot: p.ehPrincipal ? os.comissao_calculada_snapshot : null,
    tecnicosDoFuncionario: p.linhas,
  });
}

/**
 * OS do período em que o funcionário participa (principal ou por serviço),
 * na ordem recebida. `linhasPorFuncOS` é indexado por `${funcionarioId}:${osId}`.
 */
export function participacoesDoFuncionario<T extends { id: string; funcionario_id: string | null }, L extends LinhaParticipacao>(
  funcionarioId: string,
  osDoPeriodo: T[],
  linhasPorFuncOS: Map<string, L[]>,
): { os: T; participacao: ParticipacaoOS<L> }[] {
  const r: { os: T; participacao: ParticipacaoOS<L> }[] = [];
  for (const os of osDoPeriodo) {
    const p = participacaoNaOS(funcionarioId, os.funcionario_id, linhasPorFuncOS.get(`${funcionarioId}:${os.id}`) || []);
    if (p) r.push({ os, participacao: p });
  }
  return r;
}
