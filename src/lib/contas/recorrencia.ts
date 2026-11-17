/**
 * Próxima data de uma conta recorrente (mensal), direto do texto "YYYY-MM-DD".
 *
 * Antes era `new Date(conta.data)`: o texto vira meia-noite UTC, que no Brasil
 * ainda é o dia anterior, e a próxima conta nascia 1 dia antes (20/11 → 19/12),
 * recuando um dia por mês. Aqui não há Date nem fuso no caminho.
 *
 * Mês sem o dia (31 → fevereiro): usa o último dia do mês, em vez de pular
 * para o mês seguinte (31/01 virava 03/03).
 *
 * diaAnterior: onde o código antigo teria gerado a mesma conta (1 dia antes),
 * para a checagem de "já existe a próxima" não duplicar contas antigas.
 */
export function proximaDataRecorrente(data: string): { data: string; diaAnterior: string; ano: number; mes: number } {
  const [ano, mes, dia] = String(data).slice(0, 10).split("-").map(Number);
  const proxAno = mes === 12 ? ano + 1 : ano;
  const proxMes = mes === 12 ? 1 : mes + 1;
  const ultimoDia = new Date(Date.UTC(proxAno, proxMes, 0)).getUTCDate();
  const p2 = (n: number) => String(n).padStart(2, "0");
  const diaProx = Math.min(dia, ultimoDia);
  const anterior = new Date(Date.UTC(proxAno, proxMes - 1, diaProx - 1));
  return {
    data: `${proxAno}-${p2(proxMes)}-${p2(diaProx)}`,
    diaAnterior: `${anterior.getUTCFullYear()}-${p2(anterior.getUTCMonth() + 1)}-${p2(anterior.getUTCDate())}`,
    ano: proxAno,
    mes: proxMes,
  };
}

// ============================================================================
// Série recorrente (Fase 1: lógica pura, ainda não usada pelo app)
//
// Não existe coluna de série nem de dia fixo: a série é reconhecida por dono,
// filial, nome normalizado e tipo; o dia fixo é deduzido das datas já
// existentes. Tudo aqui trabalha com o texto "YYYY-MM-DD" (sem Date local nem
// fuso), como proximaDataRecorrente.
// ============================================================================

const p2 = (n: number) => String(n).padStart(2, "0");

function partesData(data: string): [number, number, number] {
  const [ano, mes, dia] = String(data).slice(0, 10).split("-").map(Number);
  return [ano, mes, dia];
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function montarData(ano: number, mes: number, dia: number): string {
  return `${ano}-${p2(mes)}-${p2(dia)}`;
}

function ehFimDoMes(data: string): boolean {
  const [ano, mes, dia] = partesData(data);
  return dia === ultimoDiaDoMes(ano, mes);
}

/**
 * Dia fixo da série a partir das datas das ocorrências (qualquer ordem).
 *
 * A mais recente manda. Se ela cai no último dia do mês, o dia pode ter sido
 * "encurtado" (31 → 28 em fevereiro): volta pelas anteriores que também caem
 * no fim do mês e fica com o maior dia; a primeira anterior que NÃO é fim de
 * mês só conta se tiver dia maior (ex.: 30/01 → 28/02 = dia 30). Dia menor ali
 * significa que o usuário mudou o dia, e a recente vale.
 */
export function diaFixoDaSerie(datas: string[]): number {
  const ordenadas = datas.map((d) => String(d).slice(0, 10)).sort().reverse();
  if (ordenadas.length === 0) throw new Error("diaFixoDaSerie: série sem datas");
  let dia = partesData(ordenadas[0])[2];
  if (!ehFimDoMes(ordenadas[0])) return dia;
  for (const data of ordenadas.slice(1)) {
    const d = partesData(data)[2];
    if (ehFimDoMes(data)) {
      dia = Math.max(dia, d);
      continue;
    }
    if (d > dia) dia = d;
    break;
  }
  return Math.min(dia, 31);
}

export interface ProximaRecorrente {
  /** Data da próxima ocorrência (YYYY-MM-DD). */
  data: string;
  ano: number;
  mes: number;
  /**
   * Início da janela de "já existe": cobre o dia em que o código antigo teria
   * gerado (1 dia antes, sem dia fixo) até `data`.
   */
  janelaInicio: string;
}

/**
 * Próxima data mantendo o dia fixo: 31/01 → 28/02 → 31/03 → 30/04.
 * Sem diaFixo, usa o dia da própria data (igual a proximaDataRecorrente).
 */
export function proximaDataComDiaFixo(data: string, diaFixo?: number): ProximaRecorrente {
  const [ano, mes, dia] = partesData(data);
  const proxAno = mes === 12 ? ano + 1 : ano;
  const proxMes = mes === 12 ? 1 : mes + 1;
  const ultimo = ultimoDiaDoMes(proxAno, proxMes);
  const diaProx = Math.min(diaFixo ?? dia, ultimo);
  const proxima = montarData(proxAno, proxMes, diaProx);
  const antiga = proximaDataRecorrente(data).diaAnterior;
  const vespera = new Date(Date.UTC(proxAno, proxMes - 1, diaProx - 1));
  const vesperaTxt = montarData(vespera.getUTCFullYear(), vespera.getUTCMonth() + 1, vespera.getUTCDate());
  return {
    data: proxima,
    ano: proxAno,
    mes: proxMes,
    janelaInicio: antiga < vesperaTxt ? antiga : vesperaTxt,
  };
}

/** O mínimo de uma conta que importa para decidir a recorrência. */
export interface ContaRecorrencia {
  id?: string;
  user_id?: string | null;
  empresa_id?: string | null;
  nome: string;
  tipo: "pagar" | "receber" | string;
  data: string;
  status?: string | null;
  recorrente?: boolean | null;
  /** Não influencia a decisão (era isso que impedia gerar a próxima). */
  usa_historico_pagamentos?: boolean | null;
}

/**
 * Pagamento de uma conta: gera a próxima? null = nada a gerar.
 *
 * Gera quando a conta é recorrente, real (não é a conta virtual "venda_…") e
 * está quitada (pago/recebido). O modelo da conta (usa_historico_pagamentos)
 * NÃO importa: no fluxo de hoje, a conta do modelo novo sai antes de chegar à
 * geração (useContas.ts, marcarComoPaga), e a próxima nunca nascia.
 */
export function deveGerarProxima(conta: ContaRecorrencia, diaFixo?: number): ProximaRecorrente | null {
  if (conta.recorrente !== true) return null;
  if (conta.id?.startsWith("venda_")) return null;
  if (conta.status !== "pago" && conta.status !== "recebido") return null;
  return proximaDataComDiaFixo(conta.data, diaFixo);
}

export interface Competencia {
  ano: number;
  mes: number;
}

/**
 * Meses sem ocorrência entre a última data da série (exclusive) e o mês de
 * `hoje` (inclusive). Vazio quando a última já está no mês de hoje ou depois.
 * `hoje` = dataBrasiliaISO() (texto do dia em Brasília).
 */
export function competenciasFaltantes(ultimaData: string, hoje: string): Competencia[] {
  const [ua, um] = partesData(ultimaData);
  const [ha, hm] = partesData(hoje);
  const faltantes: Competencia[] = [];
  let ano = ua;
  let mes = um;
  while (true) {
    mes += 1;
    if (mes === 13) {
      mes = 1;
      ano += 1;
    }
    if (ano > ha || (ano === ha && mes > hm)) break;
    faltantes.push({ ano, mes });
  }
  return faltantes;
}

/**
 * Decisão do Adriel (2026-11-17): série parada recupera só o mês atual, uma
 * parcela por série. Devolve a data dessa parcela, ou null se o mês atual já
 * tem ocorrência (ou a série está no futuro).
 */
export function parcelaDoMesAtual(ultimaData: string, hoje: string, diaFixo?: number): string | null {
  const faltantes = competenciasFaltantes(ultimaData, hoje);
  const atual = faltantes[faltantes.length - 1];
  const [ha, hm] = partesData(hoje);
  if (!atual || atual.ano !== ha || atual.mes !== hm) return null;
  const dia = Math.min(diaFixo ?? partesData(ultimaData)[2], ultimoDiaDoMes(ha, hm));
  return montarData(ha, hm, dia);
}

/** Nome para comparar séries: sem espaços nas pontas/repetidos, minúsculo. Acento continua contando. */
export function normalizarNomeConta(nome: string): string {
  return String(nome ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

/** Identidade da série: dono, filial (ou sem filial), nome normalizado e tipo. */
export function chaveSerie(conta: Pick<ContaRecorrencia, "user_id" | "empresa_id" | "nome" | "tipo">): string {
  return [conta.user_id ?? "", conta.empresa_id ?? "-", normalizarNomeConta(conta.nome), conta.tipo].join("|");
}

/** Identidade de uma ocorrência: série + data. */
export function chaveOcorrencia(
  conta: Pick<ContaRecorrencia, "user_id" | "empresa_id" | "nome" | "tipo">,
  data: string,
): string {
  return `${chaveSerie(conta)}|${String(data).slice(0, 10)}`;
}

/**
 * Já existe a próxima? Mesma regra da checagem de hoje (dono, recorrente, data
 * entre janelaInicio e data; filial igual ou sem filial quando a conta tem
 * filial; só sem filial quando ela não tem), agora com nome normalizado e tipo.
 */
export function ocorrenciaJaExiste(
  conta: Pick<ContaRecorrencia, "user_id" | "empresa_id" | "nome" | "tipo">,
  proxima: Pick<ProximaRecorrente, "data" | "janelaInicio">,
  candidatas: Array<Pick<ContaRecorrencia, "user_id" | "empresa_id" | "nome" | "tipo" | "data" | "recorrente">>,
): boolean {
  const nome = normalizarNomeConta(conta.nome);
  return candidatas.some((c) => {
    const data = String(c.data).slice(0, 10);
    if (c.recorrente !== true) return false;
    if ((c.user_id ?? "") !== (conta.user_id ?? "")) return false;
    if (c.tipo !== conta.tipo) return false;
    if (normalizarNomeConta(c.nome) !== nome) return false;
    if (data < proxima.janelaInicio || data > proxima.data) return false;
    return conta.empresa_id ? c.empresa_id === conta.empresa_id || c.empresa_id == null : c.empresa_id == null;
  });
}
