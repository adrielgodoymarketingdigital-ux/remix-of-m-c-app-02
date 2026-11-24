/**
 * Tempo de garantia do serviço da OS (ordens_servico.tempo_garantia, em dias).
 *
 * "Sem garantia" é gravado como null (formato de sempre; a impressão trata
 * null/0 como sem garantia em termo-garantia-utils). O campo também é null em
 * OS antigas que nunca tiveram o campo — e a impressão delas já sai "sem
 * garantia", então carregar null como null mantém tela e papel iguais.
 *
 * Só a OS NOVA começa em 90 dias.
 */

/** Valor inicial de uma OS nova. */
export const TEMPO_GARANTIA_OS_PADRAO = 90;

/** Valor do item "Sem garantia" no Select. */
export const VALOR_SELECT_SEM_GARANTIA = "0";

/** Estado do formulário → valor do Select. null/undefined/0 => "Sem garantia". */
export function tempoGarantiaParaSelect(tempo: number | null | undefined): string {
  return typeof tempo === "number" && Number.isFinite(tempo) && tempo > 0
    ? String(tempo)
    : VALOR_SELECT_SEM_GARANTIA;
}

/** Valor escolhido no Select → estado do formulário (o que é gravado). */
export function tempoGarantiaDoSelect(valor: string): number | null {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Coluna tempo_garantia da OS salva → estado do formulário ao editar. */
export function tempoGarantiaCarregadoDaOS(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0 ? valor : null;
}
