// deno test -A --no-check src/lib/produtos/exportarPorCategoria.test.ts
// Exportar relatório por categoria (Produtos e Peças): seleção, filtro, totais e planilha.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SEM_CATEGORIA,
  agruparPorCategoria,
  alternarCategoria,
  contarComSubcategorias,
  contarItensPorCategoria,
  descendentes,
  estadoCaixa,
  filtrarItens,
  montarPlanilhas,
  mostraCustoELucro,
  nomeDeAba,
  ordemDaArvore,
  selecionarTodas,
  totaisGerais,
  type CategoriaBasica,
  type ItemBasico,
} from "./exportarPorCategoria.ts";

// Árvore fictícia:
//   Capas (cap)
//     ├─ iPhone (cap-ip)
//     │    └─ iPhone 15 (cap-ip15)
//     └─ Samsung (cap-sam)
//   Telas (tel)
//   Vazia (vaz)              ← sem nenhum item
const categorias: CategoriaBasica[] = [
  { id: "tel", nome: "Telas", cor: "#ff0000" },
  { id: "cap", nome: "Capas", cor: "#00ff00" },
  { id: "cap-sam", nome: "Samsung", categoria_pai_id: "cap" },
  { id: "cap-ip", nome: "iPhone", categoria_pai_id: "cap" },
  { id: "cap-ip15", nome: "iPhone 15", categoria_pai_id: "cap-ip" },
  { id: "vaz", nome: "Vazia" },
];

const item = (
  id: string,
  categoria_id: string | null,
  quantidade: number,
  custo: number,
  preco: number,
  extra: Partial<ItemBasico> = {},
): ItemBasico => ({ id, nome: `Item ${id}`, tipo: "produto", quantidade, custo, preco, categoria_id, ...extra });

const itens: ItemBasico[] = [
  item("1", "cap", 2, 10, 25),            // capa genérica
  item("2", "cap-ip", 3, 5, 20),          // capa iPhone
  item("3", "cap-ip15", 1, 8, 30),        // capa iPhone 15
  item("4", "cap-sam", 0, 7, 15),         // capa Samsung, sem estoque
  item("5", "tel", 4, 100, 180.5, { tipo: "peca", codigo_barras: "789" }),
  item("6", null, 5, 2, 3),               // sem categoria
  item("7", "apagada", 1, 1, 4),          // categoria que não existe mais → sem categoria
];

test("descendentes pega filhas e netas", () => {
  assert.deepEqual(descendentes("cap", categorias).sort(), ["cap-ip", "cap-ip15", "cap-sam"]);
  assert.deepEqual(descendentes("tel", categorias), []);
});

test("descendentes não trava com ciclo", () => {
  const ciclo: CategoriaBasica[] = [
    { id: "a", nome: "A", categoria_pai_id: "b" },
    { id: "b", nome: "B", categoria_pai_id: "a" },
  ];
  assert.deepEqual(descendentes("a", ciclo), ["b"]);
});

test("marcar o pai marca as subcategorias; desmarcar uma filha deixa o pai parcial", () => {
  let sel = alternarCategoria(new Set(), "cap", categorias);
  assert.deepEqual([...sel].sort(), ["cap", "cap-ip", "cap-ip15", "cap-sam"]);
  assert.equal(estadoCaixa(sel, "cap", categorias), true);

  sel = alternarCategoria(sel, "cap-sam", categorias);
  assert.equal(sel.has("cap-sam"), false);
  assert.equal(estadoCaixa(sel, "cap", categorias), "indeterminate");
  assert.equal(estadoCaixa(sel, "cap-ip", categorias), true);

  // Clicar no pai parcial marca tudo de novo.
  sel = alternarCategoria(sel, "cap", categorias);
  assert.equal(estadoCaixa(sel, "cap", categorias), true);

  // Clicar no pai inteiro desmarca tudo.
  sel = alternarCategoria(sel, "cap", categorias);
  assert.equal(sel.size, 0);
});

test("marcar só a subcategoria deixa o pai parcial e não inclui os itens do pai", () => {
  const sel = alternarCategoria(new Set(), "cap-ip15", categorias);
  assert.equal(estadoCaixa(sel, "cap", categorias), "indeterminate");
  assert.equal(estadoCaixa(sel, "cap-ip", categorias), "indeterminate");
  assert.deepEqual(filtrarItens(itens, sel, categorias).map((i) => i.id), ["3"]);
});

test("Sem categoria inclui item sem categoria e item de categoria apagada", () => {
  const sel = alternarCategoria(new Set(), SEM_CATEGORIA, categorias);
  assert.deepEqual(filtrarItens(itens, sel, categorias).map((i) => i.id), ["6", "7"]);
  const grupos = agruparPorCategoria(filtrarItens(itens, sel, categorias), categorias);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].nome, "Sem categoria");
});

test("categoria vazia não gera grupo", () => {
  const sel = alternarCategoria(new Set(), "vaz", categorias);
  const filtrados = filtrarItens(itens, sel, categorias);
  assert.equal(filtrados.length, 0);
  assert.deepEqual(agruparPorCategoria(filtrados, categorias), []);
});

test("filtro 'somente com estoque' tira quantidade 0", () => {
  const sel = alternarCategoria(new Set(), "cap", categorias);
  assert.deepEqual(filtrarItens(itens, sel, categorias).map((i) => i.id).sort(), ["1", "2", "3", "4"]);
  assert.deepEqual(
    filtrarItens(itens, sel, categorias, { somenteComEstoque: true }).map((i) => i.id).sort(),
    ["1", "2", "3"],
  );
});

test("contadores por categoria e com subcategorias", () => {
  const c = contarItensPorCategoria(itens, categorias);
  assert.equal(c.get("cap"), 1);
  assert.equal(c.get(SEM_CATEGORIA), 2);
  assert.equal(c.get("vaz"), undefined);
  assert.equal(contarComSubcategorias("cap", c, categorias), 4);
  const comEstoque = contarItensPorCategoria(itens, categorias, { somenteComEstoque: true });
  assert.equal(contarComSubcategorias("cap", comEstoque, categorias), 3);
});

test("ordem da árvore e caminho do nome", () => {
  assert.deepEqual(
    ordemDaArvore(categorias).map((o) => `${o.nivel}:${o.caminho}`),
    ["0:Capas", "1:Capas › iPhone", "2:Capas › iPhone › iPhone 15", "1:Capas › Samsung", "0:Telas", "0:Vazia"],
  );
});

test("totais conferidos à mão (seleção de tudo)", () => {
  const filtrados = filtrarItens(itens, selecionarTodas(categorias), categorias);
  assert.equal(filtrados.length, 7);
  const grupos = agruparPorCategoria(filtrados, categorias);
  assert.deepEqual(grupos.map((g) => g.nome), [
    "Capas",
    "Capas › iPhone",
    "Capas › iPhone › iPhone 15",
    "Capas › Samsung",
    "Telas",
    "Sem categoria",
  ]);

  // Capas: 2 × (10 → 25) → custo 20, venda 50, lucro 30
  assert.deepEqual(
    { q: grupos[0].quantidade, c: grupos[0].custo, v: grupos[0].venda, l: grupos[0].lucro },
    { q: 2, c: 20, v: 50, l: 30 },
  );
  // Telas: 4 × (100 → 180,50) → custo 400, venda 722, lucro 322
  assert.deepEqual(
    { q: grupos[4].quantidade, c: grupos[4].custo, v: grupos[4].venda, l: grupos[4].lucro },
    { q: 4, c: 400, v: 722, l: 322 },
  );
  // Sem categoria: 5 × (2 → 3) + 1 × (1 → 4) → custo 11, venda 19, lucro 8
  assert.deepEqual(
    { q: grupos[5].quantidade, c: grupos[5].custo, v: grupos[5].venda, l: grupos[5].lucro },
    { q: 6, c: 11, v: 19, l: 8 },
  );
  // Samsung com quantidade 0 entra no grupo mas soma zero.
  assert.deepEqual(
    { q: grupos[3].quantidade, c: grupos[3].custo, v: grupos[3].venda, l: grupos[3].lucro },
    { q: 0, c: 0, v: 0, l: 0 },
  );

  // Geral: qtd 2+3+1+0+4+5+1 = 16
  // custo 20+15+8+0+400+10+1 = 454 ; venda 50+60+30+0+722+15+4 = 881 ; lucro 427
  assert.deepEqual(totaisGerais(grupos), { itens: 7, quantidade: 16, custo: 454, venda: 881, lucro: 427 });
});

test("planilha: Resumo + uma aba por categoria, totais iguais", () => {
  const grupos = agruparPorCategoria(filtrarItens(itens, selecionarTodas(categorias), categorias), categorias);
  const abas = montarPlanilhas(grupos, "Loja Teste", "24/11/2026");
  assert.equal(abas.length, 1 + grupos.length);
  assert.equal(abas[0].nome, "Resumo");
  assert.deepEqual(abas[0].linhas[0], ["Loja Teste"]);
  assert.deepEqual(abas[0].linhas[abas[0].linhaCabecalho], ["Categoria", "Itens", "Quantidade", "Custo total", "Venda total", "Lucro total"]);
  assert.deepEqual(abas[0].linhas.at(-1), ["TOTAL", 7, 16, 454, 881, 427]);

  const telas = abas.find((a) => a.nome === "Telas")!;
  const linhaItem = telas.linhas[telas.linhaCabecalho + 1];
  assert.deepEqual(linhaItem, ["Item 5", "789", "Peça", "Telas", 4, 100, 180.5, 80.5, 400, 722, 322]);
  assert.deepEqual(telas.linhas.at(-1), ["TOTAL", "", "", "", 4, "", "", "", 400, 722, 322]);

  // Nomes de aba válidos e únicos
  assert.ok(abas.every((a) => a.nome.length <= 31 && !/[:\\/?*[\]]/.test(a.nome)));
  assert.equal(new Set(abas.map((a) => a.nome.toLowerCase())).size, abas.length);
});

test("opção mostrarCustoELucro: só false explícito desliga", () => {
  assert.equal(mostraCustoELucro(), true);
  assert.equal(mostraCustoELucro({}), true);
  assert.equal(mostraCustoELucro({ mostrarCustoELucro: true }), true);
  assert.equal(mostraCustoELucro({ mostrarCustoELucro: false }), false);
});

test("planilha ligada (true) é igual à de quem não passa a opção", () => {
  const grupos = agruparPorCategoria(filtrarItens(itens, selecionarTodas(categorias), categorias), categorias);
  assert.deepEqual(
    montarPlanilhas(grupos, "Loja Teste", "24/11/2026", { mostrarCustoELucro: true }),
    montarPlanilhas(grupos, "Loja Teste", "24/11/2026"),
  );
});

test("planilha sem custo e lucro: sem colunas, sem totais e sem valores de custo/lucro", () => {
  const grupos = agruparPorCategoria(filtrarItens(itens, selecionarTodas(categorias), categorias), categorias);
  const abas = montarPlanilhas(grupos, "Loja Teste", "24/11/2026", { mostrarCustoELucro: false });
  const resumo = abas[0];
  assert.equal(abas.length, 1 + grupos.length);
  assert.deepEqual(resumo.linhas.slice(0, resumo.linhaCabecalho), [["Loja Teste"], ["Gerado em 24/11/2026"], []]);
  assert.deepEqual(resumo.linhas[resumo.linhaCabecalho], ["Categoria", "Itens", "Quantidade", "Venda total"]);
  assert.deepEqual(resumo.linhas.at(-1), ["TOTAL", 7, 16, 881]);
  assert.deepEqual(resumo.colunasMoeda, [3]);

  const telas = abas.find((a) => a.nome === "Telas")!;
  assert.deepEqual(telas.linhas[telas.linhaCabecalho], ["Nome", "Código/SKU", "Tipo", "Categoria", "Quantidade", "Preço de venda", "Venda total"]);
  assert.deepEqual(telas.linhas[telas.linhaCabecalho + 1], ["Item 5", "789", "Peça", "Telas", 4, 180.5, 722]);
  assert.deepEqual(telas.linhas.at(-1), ["TOTAL", "", "", "", 4, "", 722]);
  assert.deepEqual(telas.colunasMoeda, [5, 6]);

  // Nenhuma célula com "custo"/"lucro" e nenhum valor de custo ou lucro (unit., total, por categoria, geral).
  const proibidos = new Set<number>();
  for (const i of itens) [i.custo, i.custo * i.quantidade, i.preco - i.custo, (i.preco - i.custo) * i.quantidade].forEach((n) => proibidos.add(n));
  for (const g of grupos) [g.custo, g.lucro].forEach((n) => proibidos.add(n));
  const t = totaisGerais(grupos);
  [t.custo, t.lucro].forEach((n) => proibidos.add(n));
  // Que também são valores legítimos neste conjunto (quantidade/itens/preço/venda) não provam nada: fora.
  const legitimos = new Set<number>([0]);
  for (const i of itens) [i.quantidade, i.preco, i.preco * i.quantidade].forEach((n) => legitimos.add(n));
  for (const g of grupos) [g.quantidade, g.itens.length, g.venda].forEach((n) => legitimos.add(n));
  [t.itens, t.quantidade, t.venda].forEach((n) => legitimos.add(n));
  for (const n of legitimos) proibidos.delete(n);
  assert.ok(proibidos.size >= 10, "poucos valores para conferir");

  for (const aba of abas) {
    for (const linha of aba.linhas.slice(aba.linhaCabecalho)) {
      for (const cel of linha) {
        if (typeof cel === "string") assert.ok(!/custo|lucro|margem/i.test(cel), `${aba.nome}: "${cel}"`);
        else assert.ok(!proibidos.has(cel), `${aba.nome}: valor ${cel} revela custo/lucro`);
      }
    }
    assert.ok(!/custo|lucro/i.test(aba.nome));
  }
});

test("nomeDeAba corta em 31, troca caracteres proibidos e não repete", () => {
  const usados = new Set<string>();
  const longo = "Acessórios / Cabos: USB-C [originais] e paralelos";
  const a = nomeDeAba(longo, usados);
  const b = nomeDeAba(longo, usados);
  assert.ok(a.length <= 31 && b.length <= 31);
  assert.ok(!/[:\\/?*[\]]/.test(a));
  assert.notEqual(a, b);
  assert.ok(b.endsWith("(2)"));
});
