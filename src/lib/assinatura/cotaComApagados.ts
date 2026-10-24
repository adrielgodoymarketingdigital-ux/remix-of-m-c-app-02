/**
 * Cota do plano somando os "fantasmas" do Começar do zero (tabela
 * cota_registros_apagados): cada item apagado que contava na cota deixou uma
 * linha com o tipo e a data de criação original. A contagem da cota passa a ser
 * linhas vivas + fantasmas, com o MESMO filtro de data de cada contagem:
 *
 *   OS por mês ............. tipo os, created_at entre início e fim do mês (gte/lte)
 *   aparelhos .............. tipo dispositivo; regra de total: sem data;
 *                            regra por período: gte início, lt fim
 *   produtos/peças por mês . tipos produto e peca, gte/lte do mês
 *   serviços avulsos/mês ... tipo servico_avulso, gte início do mês
 *
 * Quem nunca usou o Começar do zero não tem fantasmas: soma 0, igual a antes.
 * Se a consulta dos fantasmas falhar, vale 0 (nunca bloqueia ninguém).
 * Sem dependências (testado com Deno em scripts/testes-cota-com-apagados/).
 */

export type TipoCotaApagada = "os" | "dispositivo" | "produto" | "peca" | "servico_avulso";

export interface FiltroApagados {
  tipos: readonly TipoCotaApagada[];
  /** criado_em >= (inclusivo) */
  desde?: string;
  /** criado_em <= (inclusivo) */
  ateInclusivo?: string;
  /** criado_em < (exclusivo) */
  antesDe?: string;
}

/** O pedaço do query builder do supabase-js que o filtro usa. */
export interface ConsultaFiltravel extends PromiseLike<{ count: number | null; error: unknown }> {
  eq(coluna: string, valor: string): ConsultaFiltravel;
  in(coluna: string, valores: readonly string[]): ConsultaFiltravel;
  gte(coluna: string, valor: string): ConsultaFiltravel;
  lte(coluna: string, valor: string): ConsultaFiltravel;
  lt(coluna: string, valor: string): ConsultaFiltravel;
}

export const filtroOSMes = (inicioMes: Date, fimMes: Date): FiltroApagados => ({
  tipos: ["os"],
  desde: inicioMes.toISOString(),
  ateInclusivo: fimMes.toISOString(),
});

/** periodo null = regra de total (todos os aparelhos apagados contam, como os vivos). */
export const filtroDispositivos = (periodo: { inicio: Date; fim: Date } | null): FiltroApagados =>
  periodo
    ? { tipos: ["dispositivo"], desde: periodo.inicio.toISOString(), antesDe: periodo.fim.toISOString() }
    : { tipos: ["dispositivo"] };

export const filtroProdutosMes = (inicioMes: Date, fimMes: Date): FiltroApagados => ({
  tipos: ["produto", "peca"],
  desde: inicioMes.toISOString(),
  ateInclusivo: fimMes.toISOString(),
});

export const filtroServicosAvulsosMes = (inicioMes: Date): FiltroApagados => ({
  tipos: ["servico_avulso"],
  desde: inicioMes.toISOString(),
});

/** Aplica o filtro dos fantasmas de `userId` numa consulta de contagem (select count/head). */
export function aplicarFiltroApagados(consulta: ConsultaFiltravel, userId: string, filtro: FiltroApagados): ConsultaFiltravel {
  let q = consulta.eq("user_id", userId);
  q = filtro.tipos.length === 1 ? q.eq("tipo", filtro.tipos[0]) : q.in("tipo", filtro.tipos);
  if (filtro.desde) q = q.gte("criado_em", filtro.desde);
  if (filtro.ateInclusivo) q = q.lte("criado_em", filtro.ateInclusivo);
  if (filtro.antesDe) q = q.lt("criado_em", filtro.antesDe);
  return q;
}

/** Quantos fantasmas contam nesta cota. Erro (ou exceção) na consulta vale 0. */
export async function contarApagados(
  abrirConsulta: () => ConsultaFiltravel,
  userId: string,
  filtro: FiltroApagados,
): Promise<number> {
  try {
    const { count, error } = await aplicarFiltroApagados(abrirConsulta(), userId, filtro);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
