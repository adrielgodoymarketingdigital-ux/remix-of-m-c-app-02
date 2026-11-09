/**
 * Regras puras da tela Orçamentos no computador (>= 1024px): status efetivo,
 * indicadores do topo, busca, filtros de status e período, textos de tempo
 * ("Vencido há N dias", "Em N dias", "Hoje", "Há N dias") e paginação.
 * Tudo em memória sobre a lista que useOrcamentos já carrega inteira; nenhuma consulta.
 * Testado com Deno em scripts/testes-orcamentos-layout/.
 *
 * Abaixo de 1024px a tela segue com as regras antigas (TabelaOrcamentos/Orcamentos.tsx).
 */
import { dataBrasiliaISO, limitesDiaBrasilia } from "../dataBrasilia.ts";
import { normalizarTexto } from "../servicos/listaServicosDesktop.ts";

export {
  normalizarTexto,
  OPCOES_POR_PAGINA,
  POR_PAGINA_PADRAO,
  paginar,
  paginasVisiveis,
  type PaginaServicos as PaginaLista,
} from "../servicos/listaServicosDesktop.ts";

/** Mesmos valores de StatusOrcamento (src/types/orcamento.ts). */
export type StatusDoOrcamento = "pendente" | "aprovado" | "rejeitado" | "expirado" | "convertido";

/** Só os campos de `orcamentos` que estas regras leem. */
export interface OrcamentoDaLista {
  id: string;
  numero_orcamento: string;
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  status: StatusDoOrcamento;
  valor_total: number;
  /** timestamptz: criação + validade_dias, com a hora da criação. */
  data_validade?: string | null;
  created_at: string;
}

const centavos = (v: number | null | undefined) => Math.round((Number(v) || 0) * 100);

// ---------- Status efetivo ----------

/**
 * A MESMA regra do selo de hoje (TabelaOrcamentos): pendente cujo instante de
 * validade já passou. Comparação de instante (não de dia): um orçamento criado
 * às 15h vence às 15h do último dia.
 */
export function estaExpirado(
  o: Pick<OrcamentoDaLista, "status" | "data_validade">,
  agora: Date = new Date(),
): boolean {
  if (o.status !== "pendente" || !o.data_validade) return false;
  const validade = Date.parse(o.data_validade);
  return !Number.isNaN(validade) && validade < agora.getTime();
}

/** Status mostrado no selo e usado no filtro de status do computador. */
export function statusEfetivo(
  o: Pick<OrcamentoDaLista, "status" | "data_validade">,
  agora: Date = new Date(),
): StatusDoOrcamento {
  return estaExpirado(o, agora) ? "expirado" : o.status;
}

// ---------- Indicadores ----------

export interface ResumoOrcamentos {
  total: number;
  /** Status do banco igual a "pendente" (inclui os vencidos), como hoje. */
  pendentes: number;
  aprovados: number;
  /** Soma de valor_total dos aprovados e convertidos, somada em centavos. */
  valorAprovado: number;
}

/** Cartões do topo: sobre TODOS os orçamentos carregados (não seguem busca, status nem período). */
export function resumoOrcamentos(lista: readonly Pick<OrcamentoDaLista, "status" | "valor_total">[]): ResumoOrcamentos {
  let pendentes = 0;
  let aprovados = 0;
  let valorCentavos = 0;
  for (const o of lista) {
    if (o.status === "pendente") pendentes++;
    if (o.status === "aprovado") aprovados++;
    if (o.status === "aprovado" || o.status === "convertido") valorCentavos += centavos(o.valor_total);
  }
  return { total: lista.length, pendentes, aprovados, valorAprovado: valorCentavos / 100 };
}

// ---------- Filtros ----------

/** Valor do filtro de status quando nenhum está escolhido. */
export const TODOS_OS_STATUS = "todos";

export interface FiltrosOrcamentos {
  /** Trecho do número, do nome do cliente ou do telefone (sem acento/maiúscula). */
  busca?: string;
  /** Status efetivo ou TODOS_OS_STATUS / vazio. */
  status?: StatusDoOrcamento | typeof TODOS_OS_STATUS | null;
  /** Período pela data de criação, dias de calendário de Brasília (YYYY-MM-DD, inclusivos). Vazio = sem limite. */
  dataInicio?: string | null;
  dataFim?: string | null;
}

const soDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
/** Termo que é só telefone: dígitos com espaço, parênteses, +, ponto ou hífen. */
const pareceTelefone = (termo: string) => /\d/.test(termo) && /^[\d\s()+.-]+$/.test(termo);

/** Busca: número, nome do cliente ou telefone. Telefone também casa só pelos dígitos ("(19) 99442" acha "19994429176"). */
export function casaBusca(
  o: Pick<OrcamentoDaLista, "numero_orcamento" | "cliente_nome" | "cliente_telefone">,
  busca: string | null | undefined,
): boolean {
  const termo = normalizarTexto(busca);
  if (!termo) return true;
  if (normalizarTexto(o.numero_orcamento).includes(termo)) return true;
  if (normalizarTexto(o.cliente_nome).includes(termo)) return true;
  if (normalizarTexto(o.cliente_telefone).includes(termo)) return true;
  if (pareceTelefone(termo)) {
    const digitos = soDigitos(termo);
    if (digitos && soDigitos(o.cliente_telefone).includes(digitos)) return true;
  }
  return false;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Aplica busca, status e período juntos (E). Mantém a ordem recebida (o hook já ordena pela criação, mais novo primeiro). */
export function filtrarOrcamentos<T extends OrcamentoDaLista>(
  lista: readonly T[],
  f: FiltrosOrcamentos,
  agora: Date = new Date(),
): T[] {
  const status = f.status && f.status !== TODOS_OS_STATUS ? f.status : null;
  const desde = f.dataInicio && DATA_ISO.test(f.dataInicio) ? Date.parse(limitesDiaBrasilia(f.dataInicio).inicioISO) : null;
  const ate = f.dataFim && DATA_ISO.test(f.dataFim) ? Date.parse(limitesDiaBrasilia(f.dataFim).fimISO) : null;
  return lista.filter((o) => {
    if (status && statusEfetivo(o, agora) !== status) return false;
    if (desde != null || ate != null) {
      const criado = Date.parse(o.created_at);
      if (Number.isNaN(criado)) return false;
      // Início depois do fim não é invertido: o resultado fica vazio.
      if (desde != null && criado < desde) return false;
      if (ate != null && criado > ate) return false;
    }
    return casaBusca(o, f.busca);
  });
}

// ---------- Datas e textos de tempo (dia de calendário de Brasília) ----------

/** Dia de calendário de Brasília (YYYY-MM-DD) de um instante; null se vazio ou inválido. */
export function diaBrasilia(instante: string | null | undefined): string | null {
  if (!instante) return null;
  const ms = Date.parse(instante);
  return Number.isNaN(ms) ? null : dataBrasiliaISO(new Date(ms));
}

/** "2026-10-28" → "28/10/2026". */
export function dataCurta(diaISO: string): string {
  const [a, m, d] = diaISO.split("-");
  return `${d}/${m}/${a}`;
}

/** Dias de calendário de `de` até `ate` (YYYY-MM-DD); positivo se `ate` vem depois. */
export function diasEntre(de: string, ate: string): number {
  const ms = (dia: string) => {
    const [a, m, d] = dia.split("-").map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((ms(ate) - ms(de)) / 864e5);
}

export type TextoValidade =
  | { tipo: "vencido"; dias: number }
  | { tipo: "hoje" }
  | { tipo: "em"; dias: number };

/**
 * Texto embaixo da Validade, comparando o DIA de validade com o dia de HOJE
 * (ambos em Brasília). Vence hoje = "Hoje", mesmo se a hora já passou (o selo,
 * que compara instantes, já mostra "Expirado"). Sem validade = null.
 */
export function textoValidade(dataValidade: string | null | undefined, agora: Date = new Date()): TextoValidade | null {
  const dia = diaBrasilia(dataValidade);
  if (!dia) return null;
  const n = diasEntre(dataBrasiliaISO(agora), dia);
  if (n < 0) return { tipo: "vencido", dias: -n };
  if (n === 0) return { tipo: "hoje" };
  return { tipo: "em", dias: n };
}

export type TextoCriacao = { tipo: "hoje" } | { tipo: "ha"; dias: number };

/** Texto embaixo da Data: "Hoje" ou "Há N dias" (dia de criação × hoje, em Brasília). */
export function textoCriacao(createdAt: string, agora: Date = new Date()): TextoCriacao | null {
  const dia = diaBrasilia(createdAt);
  if (!dia) return null;
  // Relógio do aparelho atrasado (criação "no futuro") conta como hoje.
  const n = Math.max(0, diasEntre(dia, dataBrasiliaISO(agora)));
  return n === 0 ? { tipo: "hoje" } : { tipo: "ha", dias: n };
}

// ---------- Avatar ----------

/** Iniciais do cliente para o avatar: até 2 letras (primeira e segunda palavra). Sem nome = "". */
export function iniciaisCliente(nome: string | null | undefined): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p));
  return partes
    .slice(0, 2)
    .map((p) => Array.from(p.replace(/^[^\p{L}\p{N}]+/u, ""))[0] ?? "")
    .join("")
    .toLocaleUpperCase("pt-BR");
}
