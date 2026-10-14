/**
 * Limite de dispositivos que renova a cada período da assinatura (por usuário).
 *
 * Padrão (todos): o limite conta TODOS os aparelhos já cadastrados com o user_id
 * (total acumulado, inclusive vendidos e na lixeira). Isso não muda.
 *
 * Com a marca `modulos_extras.limite_dispositivos_por_periodo = true` na
 * assinatura: o número do limite é o mesmo do plano, mas só contam os aparelhos
 * CRIADOS dentro do período atual (inclusive os depois vendidos ou excluídos).
 *
 * Período = ciclos de 30 dias alinhados com a renovação. Âncora:
 *   1. assinaturas.data_fim (= próxima cobrança; os webhooks de cartão, PIX,
 *      Ticto e Hotmart gravam pagamento + 30 dias, ou + 365 no anual);
 *   2. sem data_fim: data_inicio (mês corrido a partir do início);
 *   3. sem nenhuma: created_at da assinatura;
 *   4. sem datas: mês do calendário em America/Sao_Paulo.
 * No anual a âncora é a mesma data_fim e o limite renova a cada 30 dias contados
 * para trás dela. Nunca bloqueia por falta de data. Sem dependências (testado com
 * Deno em scripts/testes-limite-dispositivos-periodo/).
 */

export const CHAVE_LIMITE_POR_PERIODO = "limite_dispositivos_por_periodo";
export const DURACAO_PERIODO_DIAS = 30;
const DIA_MS = 24 * 60 * 60 * 1000;
const PERIODO_MS = DURACAO_PERIODO_DIAS * DIA_MS;

export interface AssinaturaPeriodo {
  modulos_extras?: unknown;
  data_fim?: string | null;
  data_inicio?: string | null;
  created_at?: string | null;
}

export type OrigemPeriodo = "data_fim" | "data_inicio" | "created_at" | "mes_calendario";

export interface PeriodoLimite {
  /** Início do período (inclusivo). */
  inicio: Date;
  /** Próxima renovação do limite (exclusivo). */
  fim: Date;
  origem: OrigemPeriodo;
}

/** A marca está ligada? Só `true` liga; ausente, false ou modulos_extras vazio = regra de sempre. */
export function usaLimiteDispositivosPorPeriodo(assinatura: AssinaturaPeriodo | null | undefined): boolean {
  const extras = assinatura?.modulos_extras;
  if (!extras || typeof extras !== "object" || Array.isArray(extras)) return false;
  return (extras as Record<string, unknown>)[CHAVE_LIMITE_POR_PERIODO] === true;
}

function dataValida(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Ciclo de 30 dias, alinhado em `ancora`, que contém `agora`: inicio <= agora < fim. */
export function cicloQueContem(ancora: Date, agora: Date): { inicio: Date; fim: Date } {
  const k = Math.floor((agora.getTime() - ancora.getTime()) / PERIODO_MS) + 1;
  const fim = new Date(ancora.getTime() + k * PERIODO_MS);
  return { inicio: new Date(fim.getTime() - PERIODO_MS), fim };
}

/** "AAAA-MM" e dia 1 do mês atual em Brasília, como instante UTC (Brasília é UTC-3, sem horário de verão). */
function mesCalendarioBrasilia(agora: Date): { inicio: Date; fim: Date } {
  const brasilia = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  const ano = brasilia.getUTCFullYear();
  const mes = brasilia.getUTCMonth();
  const inicio = new Date(Date.UTC(ano, mes, 1, 3, 0, 0));
  const fim = new Date(Date.UTC(ano, mes + 1, 1, 3, 0, 0));
  return { inicio, fim };
}

/** Período atual do limite, ou null quando a marca está desligada (regra de sempre: total acumulado). */
export function periodoLimiteDispositivos(assinatura: AssinaturaPeriodo | null | undefined, agora: Date = new Date()): PeriodoLimite | null {
  if (!usaLimiteDispositivosPorPeriodo(assinatura)) return null;
  const ancoras: [OrigemPeriodo, Date | null][] = [
    ["data_fim", dataValida(assinatura?.data_fim)],
    ["data_inicio", dataValida(assinatura?.data_inicio)],
    ["created_at", dataValida(assinatura?.created_at)],
  ];
  for (const [origem, ancora] of ancoras) {
    if (ancora) return { ...cicloQueContem(ancora, agora), origem };
  }
  return { ...mesCalendarioBrasilia(agora), origem: "mes_calendario" };
}

/** O aparelho conta no limite? Sem período: sempre (regra de sempre). Com período: criado dentro dele. */
export function dispositivoContaNoLimite(
  dispositivo: { created_at?: string | null },
  periodo: PeriodoLimite | null,
): boolean {
  if (!periodo) return true;
  const criado = dataValida(dispositivo.created_at);
  if (!criado) return false;
  return criado >= periodo.inicio && criado < periodo.fim;
}

/** "DD/MM" da renovação, no calendário de Brasília. */
export function formatarRenovacao(periodo: PeriodoLimite): string {
  const brasilia = new Date(periodo.fim.getTime() - 3 * 60 * 60 * 1000);
  const dd = String(brasilia.getUTCDate()).padStart(2, "0");
  const mm = String(brasilia.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/** Texto do contador: "utilizados no total" (padrão) ou "utilizados neste período (renova em DD/MM)". */
export function textoUsoDispositivos(periodo: PeriodoLimite | null): string {
  return periodo ? `utilizados neste período (renova em ${formatarRenovacao(periodo)})` : "utilizados no total";
}
