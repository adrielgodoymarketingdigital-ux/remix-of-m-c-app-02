// deno test --no-check scripts/testes-pedidos-layout/
// Dados totalmente fictícios.
import { assertEquals } from "jsr:@std/assert@1";
import {
  diaCriacaoBrasilia,
  filtrarPedidos,
  OPCOES_POR_PAGINA,
  pedidoAReceber,
  pedidoCombinaComBusca,
  type PedidoDaLista,
  paginar,
  POR_PAGINA_PADRAO,
  resumoPedidos,
  STATUS_PEDIDO,
  type StatusDoPedido,
  temFiltrosAtivos,
  TODOS_OS_STATUS,
} from "../../src/lib/pedidos/listaPedidosDesktop.ts";

const p = (id: string, extra: Partial<PedidoDaLista> = {}): PedidoDaLista => ({
  id, cliente_nome: `Cliente ${id}`, cliente_telefone: null, descricao: `Pedido ${id}`, status: "aguardando", pago: false, ...extra,
});
const ids = (l: { id: string }[]) => l.map((x) => x.id).join(",");

// Lista feita à mão, na ordem em que o hook entrega (mais novo primeiro).
const pedidos: PedidoDaLista[] = [
  p("a", { cliente_nome: "João Fictício", cliente_telefone: "(11) 99999-0001", descricao: "iPhone 15 Pro Max 256GB", status: "aguardando" }),
  p("b", { cliente_nome: "Márcia Teste", cliente_telefone: "11 98888-0002", descricao: "Tela Galaxy A54", status: "confirmado", pago: true }),
  p("c", { cliente_nome: "Ana Exemplo", descricao: "Capinha transparente", status: "chegou" }),
  p("d", { cliente_nome: "Pedro Modelo", descricao: "Película 3D", status: "chegou", pago: true }),
  p("e", { cliente_nome: "José Inventado", descricao: "Bateria Moto G", status: "entregue" }),          // entregue sem pagar: não conta
  p("f", { cliente_nome: "Luíza Fictícia", descricao: "Carregador turbo", status: "cancelado" }),     // cancelado sem pagar: não conta
  p("g", { cliente_nome: "Caio Teste", cliente_telefone: "+55 21 97777-0003", descricao: "Fone sem fio", status: "aguardando", pago: true }),
];

// ---------- Indicadores ----------

Deno.test("indicadores batem com a lista feita à mão (mesma regra dos cartões de hoje)", () => {
  // aguardando: a, g · chegou: c, d · a receber: a (aguardando), c (chegou) — b, d, g pagos; e entregue; f cancelado.
  assertEquals(resumoPedidos(pedidos), { total: 7, aguardando: 2, chegou: 2, aReceber: 2 });
});

Deno.test("indicadores: lista vazia = tudo zero", () => {
  assertEquals(resumoPedidos([]), { total: 0, aguardando: 0, chegou: 0, aReceber: 0 });
});

Deno.test("a receber: só não pago e em aberto (aguardando, confirmado, chegou)", () => {
  const abertos: StatusDoPedido[] = ["aguardando", "confirmado", "chegou"];
  for (const status of STATUS_PEDIDO) {
    assertEquals(pedidoAReceber({ status, pago: false }), abertos.includes(status), status);
    assertEquals(pedidoAReceber({ status, pago: true }), false, `${status} pago`);
  }
});

Deno.test("indicadores = a conta antiga da página (contadores) em 200 pedidos variados", () => {
  const lista = Array.from({ length: 200 }, (_, i) =>
    p(`x${i}`, { status: STATUS_PEDIDO[i % 5], pago: i % 3 === 0 }));
  const antigo = {
    total: lista.length,
    aguardando: lista.filter((x) => x.status === "aguardando").length,
    chegou: lista.filter((x) => x.status === "chegou").length,
    aReceber: lista.filter((x) => !x.pago && x.status !== "cancelado" && x.status !== "entregue").length,
  };
  assertEquals(resumoPedidos(lista), antigo);
});

// ---------- Busca ----------

Deno.test("busca: cliente, descrição e telefone, sem acento e sem maiúscula", () => {
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "joao" })), "a");
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "MÁRCIA" })), "b");
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "pelicula" })), "d");
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "fictícia" })), "f");      // "Luíza Fictícia"; "João Fictício" não
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "ficti" })), "a,f");
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "  tela   galaxy " })), "b"); // espaços colapsados
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "nada disso" })), "");
});

Deno.test("busca no telefone: como digitado ou só os números", () => {
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "(11) 99999" })), "a");
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "1199999" })), "a");
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "98888-0002" })), "b");
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "21 97777" })), "g");
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "0003" })), "g");
  // Termo com letras não vira busca pelos números do telefone: "iphone 1" acha só pela descrição,
  // mesmo havendo "1" em todos os telefones.
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "iphone 1" })), "a");
  assertEquals(pedidoCombinaComBusca(p("z", { cliente_telefone: "11 90000-0000" }), "galaxy 11"), false);
});

Deno.test("busca: telefone vazio não quebra; busca vazia ou só espaços devolve tudo", () => {
  assertEquals(pedidoCombinaComBusca(p("z"), "123"), false);
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "" })), ids(pedidos));
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "   " })), ids(pedidos));
  assertEquals(ids(filtrarPedidos(pedidos, {})), ids(pedidos));
});

Deno.test("busca nova encontra tudo que a busca antiga encontrava (mesma lista, mais tolerante)", () => {
  const antiga = (x: PedidoDaLista, busca: string) =>
    x.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
    x.descricao.toLowerCase().includes(busca.toLowerCase()) ||
    !!x.cliente_telefone?.includes(busca);
  const termos = ["", "a", "Jo", "iphone", "TELA", "(11)", "99999", "0002", "+55", "fone", "x", "ção", "teste"];
  for (const termo of termos) {
    for (const x of pedidos) {
      if (antiga(x, termo)) assertEquals(pedidoCombinaComBusca(x, termo), true, `${termo} / ${x.id}`);
    }
  }
});

// ---------- Status ----------

Deno.test("status: cada um dos 5, inclusive Confirmado; 'todos' não filtra", () => {
  assertEquals(ids(filtrarPedidos(pedidos, { status: "aguardando" })), "a,g");
  assertEquals(ids(filtrarPedidos(pedidos, { status: "confirmado" })), "b");
  assertEquals(ids(filtrarPedidos(pedidos, { status: "chegou" })), "c,d");
  assertEquals(ids(filtrarPedidos(pedidos, { status: "entregue" })), "e");
  assertEquals(ids(filtrarPedidos(pedidos, { status: "cancelado" })), "f");
  assertEquals(ids(filtrarPedidos(pedidos, { status: TODOS_OS_STATUS })), ids(pedidos));
});

Deno.test("busca + status juntos (E) e a ordem recebida é mantida", () => {
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "teste", status: "aguardando" })), "g");
  assertEquals(ids(filtrarPedidos(pedidos, { busca: "teste", status: "entregue" })), "");
  assertEquals(ids(filtrarPedidos([...pedidos].reverse(), { status: "chegou" })), "d,c");
});

Deno.test("status: a lista do filtro é a do CHECK do banco, na ordem do app", () => {
  assertEquals([...STATUS_PEDIDO], ["aguardando", "confirmado", "chegou", "entregue", "cancelado"]);
});

Deno.test("temFiltrosAtivos: busca com texto ou status escolhido", () => {
  assertEquals(temFiltrosAtivos({}), false);
  assertEquals(temFiltrosAtivos({ busca: "   ", status: TODOS_OS_STATUS }), false);
  assertEquals(temFiltrosAtivos({ busca: "a" }), true);
  assertEquals(temFiltrosAtivos({ status: "confirmado" }), true);
});

// ---------- Paginação (a mesma de Serviços) ----------

Deno.test("paginação: 20 por padrão, opções 10/20/50", () => {
  assertEquals(POR_PAGINA_PADRAO, 20);
  assertEquals([...OPCOES_POR_PAGINA], [10, 20, 50]);
});

Deno.test("paginação com 45 pedidos: 3 páginas e página fora do fim é corrigida", () => {
  const lista = Array.from({ length: 45 }, (_, i) => p(`n${i + 1}`));
  const pg1 = paginar(lista, 1, 20);
  assertEquals([pg1.inicio, pg1.fim, pg1.total, pg1.totalPaginas], [1, 20, 45, 3]);
  const pg3 = paginar(lista, 3, 20);
  assertEquals([pg3.inicio, pg3.fim, pg3.itens.length], [41, 45, 5]);
  // Filtro encolheu a lista de 45 para 7 estando na página 3: volta à 1.
  const encolhida = paginar(filtrarPedidos(lista, { busca: "n1" }), 3, 20); // n1, n10..n19 = 11
  assertEquals([encolhida.pagina, encolhida.total], [1, 11]);
  assertEquals(paginar([], 1, 20), { itens: [], pagina: 1, totalPaginas: 1, inicio: 0, fim: 0, total: 0 });
});

// ---------- Data de criação (dia de Brasília) ----------

Deno.test("data de criação: dia de Brasília, não o dia UTC", () => {
  assertEquals(diaCriacaoBrasilia("2026-11-10T02:30:00+00:00"), "2026-11-09"); // 23h30 de 09/11 em Brasília
  assertEquals(diaCriacaoBrasilia("2026-11-10T03:00:00Z"), "2026-11-10");      // meia-noite em Brasília
  assertEquals(diaCriacaoBrasilia("2026-11-09T12:00:00.123456+00:00"), "2026-11-09");
  assertEquals(diaCriacaoBrasilia("2026-01-01T02:59:59Z"), "2025-12-31");      // virada de ano
});

Deno.test("data de criação: vazia ou inválida = null", () => {
  assertEquals(diaCriacaoBrasilia(null), null);
  assertEquals(diaCriacaoBrasilia(""), null);
  assertEquals(diaCriacaoBrasilia("não é data"), null);
});
