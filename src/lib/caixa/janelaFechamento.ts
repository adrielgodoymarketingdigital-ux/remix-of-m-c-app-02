/**
 * Limite superior da soma do fechamento.
 *
 * Caixa ABERTO: sem limite (null). Tudo o que já está no banco desde a abertura
 * pertence a ele, então o relógio do aparelho não corta lançamentos.
 * Caixa FECHADO: nunca soma além do próprio data_fechamento.
 * Status desconhecido (leitura falhou): a hora atual, como sempre foi.
 */
export interface CaixaParaJanela {
  status?: string | null;
  data_fechamento?: string | null;
}

export function limiteSuperiorDaSoma(
  caixa: CaixaParaJanela | null | undefined,
  agoraISO: string,
): string | null {
  if (caixa?.status === "aberto") return null;
  return caixa?.data_fechamento ?? agoraISO;
}
