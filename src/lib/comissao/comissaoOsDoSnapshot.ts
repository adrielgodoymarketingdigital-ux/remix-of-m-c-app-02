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
