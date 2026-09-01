// "Por que você não renovou?" — opções e helpers compartilhados entre o
// modal (client do usuário) e o painel Admin.

export type MotivoNaoRenovacaoCategoria =
  | "preco_alto"
  | "nao_usei"
  | "outra_solucao"
  | "problema_tecnico"
  | "volto_em_breve"
  | "outro";

export interface OpcaoMotivoNaoRenovacao {
  categoria: MotivoNaoRenovacaoCategoria;
  label: string;
  /** Só a opção "outro" abre um campo de texto livre opcional. */
  abreTextoLivre?: boolean;
}

// Ordem = ordem de exibição dos botões no modal.
export const OPCOES_MOTIVO_NAO_RENOVACAO: OpcaoMotivoNaoRenovacao[] = [
  { categoria: "preco_alto", label: "Preço muito alto" },
  { categoria: "nao_usei", label: "Não usei o suficiente" },
  { categoria: "outra_solucao", label: "Encontrei outra solução" },
  { categoria: "problema_tecnico", label: "Tive um problema técnico" },
  { categoria: "volto_em_breve", label: "Vou voltar em breve, só não deu tempo" },
  { categoria: "outro", label: "Outro motivo", abreTextoLivre: true },
];

export const LABEL_POR_CATEGORIA: Record<MotivoNaoRenovacaoCategoria, string> =
  OPCOES_MOTIVO_NAO_RENOVACAO.reduce(
    (acc, o) => ({ ...acc, [o.categoria]: o.label }),
    {} as Record<MotivoNaoRenovacaoCategoria, string>,
  );

/**
 * Formato mínimo de assinatura de que os helpers precisam. Bate com o que
 * `useVerificacaoAcesso` já carrega (`select("*")` de `assinaturas`).
 */
export interface AssinaturaParaModal {
  id?: string | null;
  user_id?: string | null;
  status?: string | null;
  plano_tipo?: string | null;
  data_fim?: string | null;
  trial_end_at?: string | null;
  cancelado_em?: string | null;
  free_trial_ends_at?: string | null;
  trial_with_card?: boolean | null;
}

/**
 * Decide se o modal "Por que você não renovou?" deve ser considerado para
 * este usuário. Reaproveita a MESMA detecção de plano vencido do
 * `useVerificacaoAcesso`: o único gatilho é `status === "trial_expirado"`,
 * que já cobre past_due / unpaid / canceled / trial (com ou sem cartão)
 * expirado / fim do período pago + carência.
 *
 * Exclui apenas o caso "demonstração sem cartão", que no
 * `useVerificacaoAcesso` significa cadastro novo incompleto (nunca teve
 * plano) — perguntar "por que não renovou" ali não faz sentido.
 */
export function deveConsiderarModalNaoRenovacao(
  statusAcesso: string | null | undefined,
  assinatura: AssinaturaParaModal | null | undefined,
): boolean {
  if (statusAcesso !== "trial_expirado") return false;
  if (!assinatura || !assinatura.user_id) return false;
  if (assinatura.plano_tipo === "demonstracao" && !assinatura.trial_with_card) return false;
  return true;
}

/**
 * Identificador estável do episódio de vencimento atual. Continua o mesmo
 * enquanto o usuário permanece vencido no mesmo ciclo; muda se ele
 * re-assina e vence de novo (novo status / nova data marco). É a chave que
 * garante "perguntar só uma vez por ciclo".
 */
export function buildCicloVencimentoRef(assinatura: AssinaturaParaModal): string {
  const marco =
    assinatura.data_fim ??
    assinatura.trial_end_at ??
    assinatura.cancelado_em ??
    assinatura.free_trial_ends_at ??
    "sem-data";
  return `${assinatura.id ?? "sem-id"}|${assinatura.status ?? "sem-status"}|${marco}`;
}
