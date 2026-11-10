// deno test -A --no-check src/lib/catalogo/listaItensDesktop.test.ts
// Lista de itens do Catálogo no computador. Dados fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apareceNoPublico,
  chaveTipo,
  contarPorCategoria,
  estaOculto,
  estaSelecionado,
  filtrarItens,
  gruposDeCategoria,
  ID_SEM_CATEGORIA,
  lucroDoItem,
  montarMapaCustos,
  normalizarTexto,
  OPCOES_POR_PAGINA,
  ordenarItens,
  paginar,
  POR_PAGINA_PADRAO,
  precoEfetivo,
  semCategoria,
  tiposDisponiveis,
  visibilidadeCustoLucro,
  type CategoriaManual,
  type ItemDaLista,
} from "./listaItensDesktop.ts";

const item = (p: Partial<ItemDaLista> & Pick<ItemDaLista, "id" | "nome">): ItemDaLista => ({
  tipo_item: "produto",
  quantidade: 1,
  created_at: "2026-01-01T00:00:00Z",
  ...p,
});

const IPHONE = item({
  id: "d1", nome: "Apple iPhone 13", tipo_item: "dispositivo", marca: "Apple", modelo: "iPhone 13",
  tipo_dispositivo: "Celular", subtitulo: "Celular", preco: 3000, preco_promocional: 2700, condicao: "semi_novo",
  created_at: "2026-03-01T00:00:00Z", quantidade: 1,
});
const IPAD = item({
  id: "d2", nome: "Apple iPad 9", tipo_item: "dispositivo", tipo_dispositivo: "Tablet", preco: 2000, condicao: "novo",
  created_at: "2026-02-01T00:00:00Z", exibir_no_catalogo: false,
});
const CAPA = item({
  id: "p1", nome: "Capa Antichoque", tipo_item: "produto", sku: "CAP-001", preco: 49.9,
  categoria_id: "c-capas", categoria_nome: "Capas", categoria_cor: "#ff0000", quantidade: 5,
});
const CABO = item({
  id: "p2", nome: "Cabo USB-C Ação", tipo_item: "produto", codigo_barras: "7890001", preco: null,
  categoria_id: "c-cabos", categoria_nome: "Cabos", quantidade: 0,
});
const TELA = item({ id: "x1", nome: "Tela Moto G", tipo_item: "peca", preco: 150 });
const TODOS = [IPHONE, IPAD, CAPA, CABO, TELA];

// ---------- texto ----------

test("normalizarTexto tira acento, caixa e espaços extras", () => {
  assert.equal(normalizarTexto("  Ação  ÇÃO   Película "), "acao cao pelicula");
  assert.equal(normalizarTexto(null), "");
  assert.equal(normalizarTexto(undefined), "");
});

// ---------- tipo ----------

test("chaveTipo separa produto, peça e cada tipo de dispositivo", () => {
  assert.equal(chaveTipo(CAPA), "produto");
  assert.equal(chaveTipo(TELA), "peca");
  assert.equal(chaveTipo(IPHONE), "dispositivo:Celular");
  assert.equal(chaveTipo({ tipo_item: "dispositivo" }), "dispositivo:");
});

test("tiposDisponiveis: produto, peça e depois dispositivos em ordem, sem repetir", () => {
  assert.deepEqual(tiposDisponiveis(TODOS), ["produto", "peca", "dispositivo:Celular", "dispositivo:Tablet"]);
  assert.deepEqual(tiposDisponiveis([IPHONE]), ["dispositivo:Celular"]);
  assert.deepEqual(tiposDisponiveis([]), []);
});

// ---------- entrada no catálogo ----------

test("seleção vazia = todos entram (regra atual)", () => {
  assert.equal(estaSelecionado("qualquer", []), true);
  assert.equal(estaSelecionado("d1", ["d1"]), true);
  assert.equal(estaSelecionado("d2", ["d1"]), false);
});

test("só exibir_no_catalogo === false oculta", () => {
  assert.equal(estaOculto({ exibir_no_catalogo: false }), true);
  assert.equal(estaOculto({ exibir_no_catalogo: true }), false);
  assert.equal(estaOculto({}), false);
});

test("apareceNoPublico exige selecionado e não oculto", () => {
  assert.equal(apareceNoPublico(IPHONE, []), true);
  assert.equal(apareceNoPublico(IPAD, []), false); // oculto
  assert.equal(apareceNoPublico(IPHONE, ["p1"]), false); // fora da seleção
});

// ---------- categorias ----------

const MANUAIS: CategoriaManual[] = [
  { id: "m2", nome: "Promoção", cor: "#00f", itemIds: ["p1", "d1"] },
  { id: "m1", nome: "Apple", icone: "smartphone", itemIds: ["d1", "d2", "sumiu"] },
  { id: "m3", nome: "Vazia", itemIds: [] },
];

test("com categorias manuais valem só elas, na ordem salva (vazias incluídas)", () => {
  const g = gruposDeCategoria(TODOS, MANUAIS);
  assert.deepEqual(g.map((x) => x.id), ["m2", "m1", "m3"]);
  assert.equal(g.every((x) => x.origem === "manual"), true);
  assert.equal(g[1].icone, "smartphone");
});

test("sem manuais agrupa pela categoria do estoque, em ordem alfabética", () => {
  for (const manuais of [undefined, []]) {
    const g = gruposDeCategoria(TODOS, manuais);
    assert.deepEqual(g.map((x) => x.nome), ["Cabos", "Capas"]);
    assert.equal(g[1].cor, "#ff0000");
    assert.equal(g[0].origem, "estoque");
    assert.deepEqual([...g[1].itemIds], ["p1"]);
  }
});

test("contarPorCategoria conta só itens da lista e aceita item em duas categorias", () => {
  const g = gruposDeCategoria(TODOS, MANUAIS);
  const c = contarPorCategoria(TODOS, g);
  assert.equal(c.total, 5);
  assert.equal(c.porCategoria.get("m2"), 2);
  assert.equal(c.porCategoria.get("m1"), 2); // "sumiu" não conta
  assert.equal(c.porCategoria.get("m3"), 0);
  assert.equal(c.semCategoria, 2); // cabo e tela
  assert.equal(semCategoria("x1", g), true);
  assert.equal(semCategoria("d1", g), false);
});

test("contarPorCategoria com lista vazia", () => {
  const c = contarPorCategoria([], gruposDeCategoria([], MANUAIS));
  assert.equal(c.total, 0);
  assert.equal(c.semCategoria, 0);
  assert.equal(c.porCategoria.get("m1"), 0);
});

// ---------- filtros ----------

const ids = (l: ItemDaLista[]) => l.map((i) => i.id);

test("busca sem acento e sem caixa no nome, sku, código de barras e categoria", () => {
  const g = gruposDeCategoria(TODOS, undefined);
  assert.deepEqual(ids(filtrarItens(TODOS, { busca: "ACAO" }, g)), ["p2"]);
  assert.deepEqual(ids(filtrarItens(TODOS, { busca: "cap-001" }, g)), ["p1"]);
  assert.deepEqual(ids(filtrarItens(TODOS, { busca: "7890001" }, g)), ["p2"]);
  assert.deepEqual(ids(filtrarItens(TODOS, { busca: "capas" }, g)), ["p1"]);
  assert.deepEqual(ids(filtrarItens(TODOS, { busca: "   " }, g)), ids(TODOS));
});

test("busca com várias palavras em qualquer ordem", () => {
  assert.deepEqual(ids(filtrarItens(TODOS, { busca: "13 apple" })), ["d1"]);
  assert.deepEqual(ids(filtrarItens(TODOS, { busca: "apple xyz" })), []);
});

test("busca acha pelo nome da categoria manual", () => {
  const g = gruposDeCategoria(TODOS, MANUAIS);
  assert.deepEqual(ids(filtrarItens(TODOS, { busca: "promocao" }, g)), ["d1", "p1"]);
});

test("filtro por tipo", () => {
  assert.deepEqual(ids(filtrarItens(TODOS, { tipo: "peca" })), ["x1"]);
  assert.deepEqual(ids(filtrarItens(TODOS, { tipo: "dispositivo:Tablet" })), ["d2"]);
  assert.deepEqual(ids(filtrarItens(TODOS, { tipo: "todos" })), ids(TODOS));
  assert.deepEqual(ids(filtrarItens(TODOS, { tipo: null })), ids(TODOS));
});

test("filtro por categoria, inclusive 'sem categoria' e id desconhecido", () => {
  const g = gruposDeCategoria(TODOS, MANUAIS);
  assert.deepEqual(ids(filtrarItens(TODOS, { categoriaId: "m1" }, g)), ["d1", "d2"]);
  assert.deepEqual(ids(filtrarItens(TODOS, { categoriaId: ID_SEM_CATEGORIA }, g)), ["p2", "x1"]);
  assert.deepEqual(ids(filtrarItens(TODOS, { categoriaId: "nao-existe" }, g)), []);
  assert.deepEqual(ids(filtrarItens(TODOS, { categoriaId: "todos" }, g)), ids(TODOS));
});

test("filtro por condição deixa de fora produto e peça", () => {
  assert.deepEqual(ids(filtrarItens(TODOS, { condicao: "novo" })), ["d2"]);
  assert.deepEqual(ids(filtrarItens(TODOS, { condicao: "todos" })), ids(TODOS));
});

test("filtro por situação: no catálogo, fora da seleção, ocultos", () => {
  const sel = ["d1", "d2", "p1"];
  assert.deepEqual(ids(filtrarItens(TODOS, { situacao: "no_catalogo" }, [], sel)), ["d1", "p1"]);
  assert.deepEqual(ids(filtrarItens(TODOS, { situacao: "fora" }, [], sel)), ["p2", "x1"]);
  assert.deepEqual(ids(filtrarItens(TODOS, { situacao: "ocultos" }, [], sel)), ["d2"]);
  // seleção vazia: ninguém está "fora"
  assert.deepEqual(ids(filtrarItens(TODOS, { situacao: "fora" }, [], [])), []);
  assert.deepEqual(ids(filtrarItens(TODOS, { situacao: "no_catalogo" }, [], [])), ["d1", "p1", "p2", "x1"]);
});

test("filtros combinados (E) e lista recebida não é alterada", () => {
  const copia = [...TODOS];
  const r = filtrarItens(TODOS, { tipo: "produto", busca: "cabo" });
  assert.deepEqual(ids(r), ["p2"]);
  assert.deepEqual(TODOS, copia);
});

// ---------- ordem ----------

test("ordem por nome sem caixa/acento, empate desfeito por id", () => {
  const a = item({ id: "b", nome: "ábaco" });
  const b = item({ id: "a", nome: "Abaco" });
  const c = item({ id: "c", nome: "zebra" });
  assert.deepEqual(ids(ordenarItens([c, a, b], "nome_asc")), ["a", "b", "c"]);
  assert.deepEqual(ids(ordenarItens([c, a, b])), ["a", "b", "c"]); // padrão = nome
});

test("ordem por preço usa o preço efetivo (promoção) e vazio conta 0", () => {
  // iPhone 2700 (promo), iPad 2000, capa 49.9, cabo null→0, tela 150
  assert.deepEqual(ids(ordenarItens(TODOS, "preco_asc")), ["p2", "p1", "x1", "d2", "d1"]);
  assert.deepEqual(ids(ordenarItens(TODOS, "preco_desc")), ["d1", "d2", "x1", "p1", "p2"]);
});

test("ordem por mais recente e por estoque", () => {
  assert.deepEqual(ids(ordenarItens(TODOS, "recente")).slice(0, 2), ["d1", "d2"]);
  assert.deepEqual(ids(ordenarItens(TODOS, "estoque_desc"))[0], "p1");
  assert.deepEqual(ids(ordenarItens(TODOS, "estoque_desc")).at(-1), "p2");
});

test("ordenar não altera a lista recebida", () => {
  const copia = [...TODOS];
  ordenarItens(TODOS, "preco_desc");
  assert.deepEqual(TODOS, copia);
});

// ---------- paginação ----------

const lista = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

test("opções 10/20/50 e padrão 20", () => {
  assert.deepEqual([...OPCOES_POR_PAGINA], [10, 20, 50]);
  assert.equal(POR_PAGINA_PADRAO, 20);
});

test("paginar 45 itens de 20 em 20", () => {
  const p1 = paginar(lista(45), 1);
  assert.equal(p1.totalPaginas, 3);
  assert.deepEqual([p1.inicio, p1.fim, p1.total], [1, 20, 45]);
  const p3 = paginar(lista(45), 3);
  assert.deepEqual(p3.itens, [41, 42, 43, 44, 45]);
  assert.deepEqual([p3.inicio, p3.fim], [41, 45]);
});

test("página além do fim volta para a última; abaixo de 1 vai para 1", () => {
  assert.equal(paginar(lista(45), 9).pagina, 3);
  assert.equal(paginar(lista(45), 0).pagina, 1);
  assert.equal(paginar(lista(45), -3).pagina, 1);
  assert.equal(paginar(lista(45), Number.NaN).pagina, 1);
  assert.equal(paginar(lista(45), 2.7).pagina, 2);
});

test("tamanho fora de 10/20/50 vira 20", () => {
  assert.equal(paginar(lista(45), 1, 7).porPagina, 20);
  assert.equal(paginar(lista(45), 1, 50).itens.length, 45);
  assert.equal(paginar(lista(45), 1, 10).totalPaginas, 5);
});

test("lista vazia = 1 página, 0 a 0 de 0", () => {
  const p = paginar([], 4);
  assert.deepEqual([p.pagina, p.totalPaginas, p.inicio, p.fim, p.total], [1, 1, 0, 0, 0]);
  assert.deepEqual(p.itens, []);
});

// ---------- preço, custo, lucro ----------

test("precoEfetivo: promoção só se > 0 e menor que o preço", () => {
  assert.equal(precoEfetivo({ preco: 100, preco_promocional: 80 }), 80);
  assert.equal(precoEfetivo({ preco: 100, preco_promocional: 100 }), 100);
  assert.equal(precoEfetivo({ preco: 100, preco_promocional: 120 }), 100);
  assert.equal(precoEfetivo({ preco: 100, preco_promocional: 0 }), 100);
  assert.equal(precoEfetivo({ preco: 100, preco_promocional: null }), 100);
  assert.equal(precoEfetivo({ preco: 0, preco_promocional: 50 }), null);
  assert.equal(precoEfetivo({ preco: null }), null);
});

test("lucro em centavos (sem erro de ponto flutuante)", () => {
  assert.equal(lucroDoItem({ preco: 49.9 }, 25), 24.9);
  assert.equal(lucroDoItem({ preco: 0.3 }, 0.1), 0.2);
  assert.equal(lucroDoItem({ preco: 69.9 }, 28), 41.9);
});

test("lucro usa a promoção, aceita custo 0 e pode ser negativo", () => {
  assert.equal(lucroDoItem({ preco: 3000, preco_promocional: 2700 }, 2000), 700);
  assert.equal(lucroDoItem({ preco: 50 }, 0), 50);
  assert.equal(lucroDoItem({ preco: 50 }, 80), -30);
});

test("lucro null sem preço ou com custo desconhecido", () => {
  assert.equal(lucroDoItem({ preco: null }, 10), null);
  assert.equal(lucroDoItem({ preco: 0 }, 10), null);
  assert.equal(lucroDoItem({ preco: 50 }, null), null);
  assert.equal(lucroDoItem({ preco: 50 }, undefined), null);
  assert.equal(lucroDoItem({ preco: 50 }, Number.NaN), null);
});

test("mapa de custos separado do item; inválido vira null", () => {
  const m = montarMapaCustos([{ id: "p1", custo: 25 }, { id: "p2", custo: null }, { id: "d1" }, { id: "x", custo: Number.NaN }]);
  assert.equal(m.get("p1"), 25);
  assert.equal(m.get("p2"), null);
  assert.equal(m.get("d1"), null);
  assert.equal(m.get("x"), null);
  assert.equal(m.has("nao"), false);
  assert.equal(lucroDoItem(CAPA, m.get(CAPA.id)), 24.9); // capa (p1) está no mapa
  assert.equal(lucroDoItem(TELA, m.get(TELA.id)), null); // tela (x1) não está no mapa
  assert.equal("custo" in CAPA, false); // o item nunca carrega custo
});

test("custo e lucro: dono vê sempre; funcionário só com cada permissão", () => {
  assert.deepEqual(visibilidadeCustoLucro({ ehDono: true }), { custo: true, lucro: true });
  assert.deepEqual(visibilidadeCustoLucro({ ehDono: true, ver_custos: false, ver_lucros: false }), { custo: true, lucro: true });
  assert.deepEqual(visibilidadeCustoLucro({ ehDono: false }), { custo: false, lucro: false });
  assert.deepEqual(visibilidadeCustoLucro({ ehDono: false, ver_custos: true }), { custo: true, lucro: false });
  assert.deepEqual(visibilidadeCustoLucro({ ehDono: false, ver_lucros: true }), { custo: false, lucro: true });
  assert.deepEqual(visibilidadeCustoLucro({ ehDono: false, ver_custos: true, ver_lucros: true }), { custo: true, lucro: true });
});
