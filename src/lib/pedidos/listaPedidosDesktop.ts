/**
 * Regras puras da tela Pedidos / Encomendas no computador (≥1024px): indicadores
 * do topo, busca + status e paginação. Tudo em memória sobre a lista que
 * usePedidos já carrega inteira (sem paginação no banco); nenhuma consulta.
 * Sem dependências de React/Supabase (testado com Deno em scripts/testes-pedidos-layout/).
 */
import { normalizarTexto } from "../servicos/listaServicosDesktop.ts";
import { dataBrasiliaISO } from "../dataBrasilia.ts";

// A paginação é a mesma da tela Serviços (20 por página, 10/20/50, "1 … 4 5 6 … 12").
export {
  OPCOES_POR_PAGINA,
  POR_PAGINA_PADRAO,
  paginar,
  paginasVisiveis,
  type PaginaServicos as PaginaPedidos,
} from "../servicos/listaServicosDesktop.ts";

/** Os status do CHECK da tabela `pedidos`, na ordem em que o app sempre os mostrou. */
export const STATUS_PEDIDO = ["aguardando", "confirmado", "chegou", "entregue", "cancelado"] as const;
export type StatusDoPedido = (typeof STATUS_PEDIDO)[number];

/** Valor do filtro de status quando nenhum está escolhido. */
export const TODOS_OS_STATUS = "todos";
export type FiltroStatusPedido = StatusDoPedido | typeof TODOS_OS_STATUS;

/** Só os campos de `pedidos` que estas regras leem. */
export interface PedidoDaLista {
  id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  descricao: string;
  status: StatusDoPedido;
  pago: boolean;
}

// ---------- Indicadores ----------

/**
 * "A Receber" é uma QUANTIDADE de pedidos (não um valor em dinheiro): os não
 * pagos que ainda estão em aberto — cancelado e entregue não contam. Mesma
 * regra do cartão que a tela sempre teve.
 */
export function pedidoAReceber(p: Pick<PedidoDaLista, "pago" | "status">): boolean {
  return !p.pago && p.status !== "cancelado" && p.status !== "entregue";
}

export interface ResumoPedidos {
  total: number;
  aguardando: number;
  chegou: number;
  aReceber: number;
}

/** Indicadores do topo sobre TODOS os pedidos (não seguem a busca nem o status), como hoje. */
export function resumoPedidos(pedidos: readonly Pick<PedidoDaLista, "status" | "pago">[]): ResumoPedidos {
  const resumo: ResumoPedidos = { total: pedidos.length, aguardando: 0, chegou: 0, aReceber: 0 };
  for (const p of pedidos) {
    if (p.status === "aguardando") resumo.aguardando++;
    if (p.status === "chegou") resumo.chegou++;
    if (pedidoAReceber(p)) resumo.aReceber++;
  }
  return resumo;
}

// ---------- Filtros ----------

export interface FiltrosPedidos {
  /** Trecho do cliente, da descrição ou do telefone (sem acento/maiúscula); vazio = sem filtro. */
  busca?: string;
  status?: FiltroStatusPedido;
}

const soDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/**
 * Busca no cliente, na descrição e no telefone, sem acento e sem diferenciar
 * maiúscula. No telefone também vale só os números: "11999" encontra "(11) 99999-0000".
 */
export function pedidoCombinaComBusca(p: PedidoDaLista, busca: string | null | undefined): boolean {
  const termo = normalizarTexto(busca);
  if (!termo) return true;
  if (normalizarTexto(p.cliente_nome).includes(termo)) return true;
  if (normalizarTexto(p.descricao).includes(termo)) return true;
  if (normalizarTexto(p.cliente_telefone).includes(termo)) return true;
  const digitos = soDigitos(termo);
  // Só quando o termo é um número (com ou sem máscara): "iPhone 15" não vira busca por "15" no telefone.
  return digitos !== "" && /^[\d\s()+.-]+$/.test(termo) && soDigitos(p.cliente_telefone).includes(digitos);
}

/** Aplica busca e status juntos (E). Mantém a ordem recebida (o hook já traz do mais novo ao mais antigo). */
export function filtrarPedidos<T extends PedidoDaLista>(pedidos: readonly T[], f: FiltrosPedidos): T[] {
  const status = f.status && f.status !== TODOS_OS_STATUS ? f.status : null;
  return pedidos.filter((p) => (!status || p.status === status) && pedidoCombinaComBusca(p, f.busca));
}

/** Algum filtro valendo: mostra "Limpar filtros". Busca só com espaços não conta. */
export function temFiltrosAtivos(f: FiltrosPedidos): boolean {
  return normalizarTexto(f.busca) !== "" || (!!f.status && f.status !== TODOS_OS_STATUS);
}

// ---------- Datas da tabela ----------

/**
 * Dia de calendário de Brasília ("AAAA-MM-DD") em que o pedido foi criado.
 * `created_at` é timestamptz: um pedido feito às 23h30 de Brasília (02h30 UTC
 * do dia seguinte) é do dia de Brasília, não do dia UTC. Inválido/vazio → null.
 */
export function diaCriacaoBrasilia(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const instante = new Date(createdAt);
  return Number.isNaN(instante.getTime()) ? null : dataBrasiliaISO(instante);
}

// ---------- Valor da tabela ----------

/**
 * Valor que a coluna Valor mostra. Vazio (null) ou zero = null (a tabela mostra "—"),
 * como a lista de sempre, que escondia o valor nos dois casos (`pedido.valor_total && …`).
 */
export function valorDoPedido(valorTotal: number | null | undefined): number | null {
  const n = Number(valorTotal);
  return valorTotal == null || !Number.isFinite(n) || Math.round(n * 100) === 0 ? null : n;
}
