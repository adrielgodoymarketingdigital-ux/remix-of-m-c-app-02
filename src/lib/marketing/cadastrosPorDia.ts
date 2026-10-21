/**
 * Painel Marketing — cálculos puros do card "Cadastros por dia".
 *
 * Sem imports de alias (@/) para rodar também no deno test
 * (scripts/testes-marketing-cadastros). Todas as datas são strings
 * YYYY-MM-DD de calendário de Brasília; a conta é feita em UTC sobre essas
 * strings, então o fuso do navegador não interfere. O "hoje" de Brasília vem
 * de dataBrasiliaISO() (src/lib/dataBrasilia.ts), passado por quem chama.
 */

export type PeriodoMarketing = "7d" | "14d" | "30d" | "mes";

export const PERIODOS_MARKETING: { valor: PeriodoMarketing; rotulo: string }[] = [
  { valor: "7d", rotulo: "Últimos 7 dias" },
  { valor: "14d", rotulo: "Últimos 14 dias" },
  { valor: "30d", rotulo: "Últimos 30 dias" },
  { valor: "mes", rotulo: "Este mês" },
];

export interface IntervaloDatas {
  inicio: string;
  fim: string;
}

/** Linha devolvida pela RPC admin_mkt_cadastros_por_dia (bigint pode vir como string). */
export interface LinhaCadastrosDia {
  dia: string;
  cadastros: number | string;
  com_utm: number | string;
  meta: number | string;
}

export interface CadastrosDia {
  dia: string;
  cadastros: number;
  com_utm: number;
  meta: number;
}

export interface TotaisCadastros {
  cadastros: number;
  com_utm: number;
  meta: number;
}

export type Variacao =
  | { tipo: "percentual"; valor: number }
  | { tipo: "novo" }
  | { tipo: "sem_dados" };

const DIA_MS = 24 * 60 * 60 * 1000;

function paraUTC(dataISO: string): number {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

function deUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function somarDias(dataISO: string, dias: number): string {
  return deUTC(paraUTC(dataISO) + dias * DIA_MS);
}

/** Quantidade de dias do intervalo, contando início e fim. */
export function diasNoIntervalo({ inicio, fim }: IntervaloDatas): number {
  return Math.round((paraUTC(fim) - paraUTC(inicio)) / DIA_MS) + 1;
}

/**
 * Período escolhido (terminando hoje) e o período anterior de mesmo tamanho,
 * imediatamente antes. "Este mês" vai do dia 1 até hoje.
 */
export function calcularPeriodos(
  periodo: PeriodoMarketing,
  hojeISO: string,
): { atual: IntervaloDatas; anterior: IntervaloDatas } {
  const inicio = periodo === "mes"
    ? `${hojeISO.slice(0, 8)}01`
    : somarDias(hojeISO, -({ "7d": 7, "14d": 14, "30d": 30 }[periodo] - 1));
  const atual = { inicio, fim: hojeISO };
  const tamanho = diasNoIntervalo(atual);
  const fimAnterior = somarDias(inicio, -1);
  return { atual, anterior: { inicio: somarDias(fimAnterior, -(tamanho - 1)), fim: fimAnterior } };
}

/** Um item por dia do intervalo, com zero nos dias que a RPC não devolveu. */
export function preencherDias(linhas: LinhaCadastrosDia[], intervalo: IntervaloDatas): CadastrosDia[] {
  const porDia = new Map(linhas.map((l) => [l.dia.slice(0, 10), l]));
  const total = diasNoIntervalo(intervalo);
  const dias: CadastrosDia[] = [];
  for (let i = 0; i < total; i++) {
    const dia = somarDias(intervalo.inicio, i);
    const linha = porDia.get(dia);
    dias.push({
      dia,
      cadastros: Number(linha?.cadastros ?? 0),
      com_utm: Number(linha?.com_utm ?? 0),
      meta: Number(linha?.meta ?? 0),
    });
  }
  return dias;
}

export function somarTotais(dias: CadastrosDia[]): TotaisCadastros {
  return dias.reduce(
    (t, d) => ({ cadastros: t.cadastros + d.cadastros, com_utm: t.com_utm + d.com_utm, meta: t.meta + d.meta }),
    { cadastros: 0, com_utm: 0, meta: 0 },
  );
}

/** Variação % do atual sobre o anterior; sem base de comparação vira "novo" ou "—". */
export function calcularVariacao(atual: number, anterior: number): Variacao {
  if (anterior === 0) return atual > 0 ? { tipo: "novo" } : { tipo: "sem_dados" };
  return { tipo: "percentual", valor: ((atual - anterior) / anterior) * 100 };
}

export function formatarVariacao(v: Variacao): string {
  if (v.tipo === "novo") return "novo";
  if (v.tipo === "sem_dados") return "—";
  const arredondado = Math.round(v.valor);
  return `${arredondado > 0 ? "+" : ""}${arredondado}%`;
}

/** Percentual de parte sobre total (0 quando total é 0). */
export function percentual(parte: number, total: number): number {
  return total === 0 ? 0 : (parte / total) * 100;
}
