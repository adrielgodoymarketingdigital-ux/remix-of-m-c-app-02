// deno test -A --no-check scripts/testes-catalogo-pdf/
// Lógica pura do PDF do Catálogo (src/lib/catalogo/itensParaPdf.ts):
// quais itens entram, em que ordem, preço/promoção e agrupamento.
// Dados fictícios; sem rede e sem banco.
import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  agruparItensParaPdf,
  coresCatalogoPdf,
  corTextoSobre,
  encaixarProporcional,
  hexParaRgb,
  itemPodeIrParaPdf,
  itensParaPdf,
  precoParaPdf,
  promocaoValida,
  textoSeguroPdf,
  totalItensGrupos,
} from "../../src/lib/catalogo/itensParaPdf.ts";
import { TEMPLATES_PADRAO } from "../../src/types/catalogo.ts";
import type { ItemCatalogo } from "../../src/types/catalogo-item.ts";

const base = (id: string, extra: Partial<ItemCatalogo> = {}): ItemCatalogo => ({
  id,
  tipo_item: "produto",
  nome: `Item ${id}`,
  fotos: [],
  quantidade: 1,
  created_at: "2026-11-01T00:00:00Z",
  preco: 100,
  ...extra,
});

const disp = (id: string, extra: Partial<ItemCatalogo> = {}) =>
  base(id, { tipo_item: "dispositivo", marca: "Apple", modelo: `iPhone ${id}`, vendido: false, ...extra });
const prod = (id: string, extra: Partial<ItemCatalogo> = {}) => base(id, { tipo_item: "produto", ...extra });
const peca = (id: string, extra: Partial<ItemCatalogo> = {}) => base(id, { tipo_item: "peca", ...extra });

const ids = (itens: ItemCatalogo[]) => itens.map((i) => i.id);

// ---------- Seleção ----------

Deno.test("seleção vazia = todos os itens válidos (dispositivo, produto e peça)", () => {
  const itens = [disp("d1"), prod("p1"), peca("c1")];
  assertEquals(ids(itensParaPdf(itens, [])).sort(), ["c1", "d1", "p1"]);
  assertEquals(ids(itensParaPdf(itens, undefined)).sort(), ["c1", "d1", "p1"]);
});

Deno.test("seleção parcial: só os marcados", () => {
  const itens = [disp("d1"), disp("d2"), prod("p1"), peca("c1")];
  assertEquals(ids(itensParaPdf(itens, ["d2", "c1"])).sort(), ["c1", "d2"]);
});

Deno.test("produto e peça entram (antes o PDF só aceitava dispositivo)", () => {
  const r = itensParaPdf([prod("p1"), peca("c1")], ["p1", "c1"]);
  assertEquals(r.map((i) => i.tipo_item).sort(), ["peca", "produto"]);
});

Deno.test("itens ocultos (exibir_no_catalogo = false) nunca entram, nem selecionados", () => {
  const itens = [prod("p1", { exibir_no_catalogo: false }), peca("c1", { exibir_no_catalogo: true }), disp("d1", { exibir_no_catalogo: undefined })];
  assertEquals(ids(itensParaPdf(itens, [])).sort(), ["c1", "d1"]);
  assertEquals(ids(itensParaPdf(itens, ["p1"])), []);
});

Deno.test("dispositivo vendido nunca entra, nem selecionado", () => {
  const itens = [disp("d1", { vendido: true }), disp("d2")];
  assertEquals(ids(itensParaPdf(itens, [])), ["d2"]);
  assertEquals(ids(itensParaPdf(itens, ["d1"])), []);
  assertEquals(itemPodeIrParaPdf(disp("d1", { vendido: true })), false);
});

Deno.test("ordem da prévia: menor preço primeiro, empate mantém a ordem recebida, sem preço conta 0", () => {
  const itens = [prod("a", { preco: 300 }), prod("b", { preco: 100 }), prod("c", { preco: null }), prod("d", { preco: 100 })];
  assertEquals(ids(itensParaPdf(itens, [])), ["c", "b", "d", "a"]);
});

Deno.test("ids repetidos não duplicam item", () => {
  assertEquals(ids(itensParaPdf([prod("p1"), prod("p1")], ["p1", "p1"])), ["p1"]);
});

Deno.test("lista vazia: nada entra, nenhum grupo, total 0", () => {
  assertEquals(itensParaPdf([], []), []);
  assertEquals(itensParaPdf([disp("d1", { vendido: true }), prod("p1", { exibir_no_catalogo: false })], []), []);
  assertEquals(agruparItensParaPdf([], [{ id: "x", nome: "X", itemIds: ["a"] }]), []);
  assertEquals(totalItensGrupos(agruparItensParaPdf([], undefined)), 0);
});

// ---------- Preço ----------

Deno.test("promoção válida: promocional > 0 e menor que o preço", () => {
  assertEquals(promocaoValida(100, 80), true);
  assertEquals(precoParaPdf({ preco: 100, preco_promocional: 80 }, true), {
    tipo: "promocional", valor: 80, original: 100, descontoPercentual: 20,
  });
});

Deno.test("promoção inválida (igual, maior, zero, negativa, nula) mostra o preço normal", () => {
  for (const promo of [100, 120, 0, -5, null, undefined, Number.NaN]) {
    assertEquals(promocaoValida(100, promo), false, `promo ${promo}`);
    assertEquals(precoParaPdf({ preco: 100, preco_promocional: promo }, true), { tipo: "normal", valor: 100 });
  }
});

Deno.test("sem preço não inventa valor: Consulte (mesmo com promoção preenchida)", () => {
  assertEquals(precoParaPdf({ preco: null, preco_promocional: 50 }, true), { tipo: "consulte" });
  assertEquals(precoParaPdf({ preco: 0 }, true), { tipo: "consulte" });
  assertEquals(precoParaPdf({ preco: undefined }, true), { tipo: "consulte" });
  assertEquals(promocaoValida(null, 50), false);
});

Deno.test("mostrarPrecos desligado: Consulte", () => {
  assertEquals(precoParaPdf({ preco: 100, preco_promocional: 80 }, false), { tipo: "consulte" });
});

// ---------- Agrupamento ----------

Deno.test("sem categorias configuradas: um grupo só, sem nome, na ordem recebida", () => {
  const itens = [prod("b"), disp("a"), peca("c")];
  for (const cats of [undefined, []]) {
    const g = agruparItensParaPdf(itens, cats);
    assertEquals(g.length, 1);
    assertEquals(g[0].nome, null);
    assertEquals(ids(g[0].itens), ["b", "a", "c"]);
  }
});

Deno.test("agrupa na ordem das categorias e põe 'Outros' (sem categoria) por último", () => {
  const itens = [prod("p1"), disp("d1"), peca("c1"), prod("p2")];
  const g = agruparItensParaPdf(itens, [
    { id: "k2", nome: "Acessórios", cor: "#ff0000", itemIds: ["p2", "p1"] },
    { id: "k1", nome: "Celulares", itemIds: ["d1"] },
  ]);
  assertEquals(g.map((x) => x.nome), ["Acessórios", "Celulares", "Outros"]);
  assertEquals(ids(g[0].itens), ["p1", "p2"]); // ordem da lista, não a do itemIds
  assertEquals(g[0].cor, "#ff0000");
  assertEquals(ids(g[2].itens), ["c1"]);
});

Deno.test("categoria configurada chamada 'Outros' vai para o fim, junto com os sem categoria", () => {
  const itens = [prod("p1"), prod("p2"), prod("p3")];
  const g = agruparItensParaPdf(itens, [
    { id: "o", nome: " outros ", itemIds: ["p1"] },
    { id: "a", nome: "Capas", itemIds: ["p2"] },
  ]);
  assertEquals(g.map((x) => x.nome), ["Capas", "Outros"]);
  assertEquals(ids(g[1].itens), ["p1", "p3"]);
});

Deno.test("item em duas categorias aparece uma vez só (na primeira); categoria vazia some", () => {
  const itens = [prod("p1"), prod("p2")];
  const g = agruparItensParaPdf(itens, [
    { id: "a", nome: "A", itemIds: ["p1"] },
    { id: "b", nome: "B", itemIds: ["p1", "p2"] },
    { id: "c", nome: "Vazia", itemIds: ["nao-existe"] },
  ]);
  assertEquals(g.map((x) => x.nome), ["A", "B"]);
  assertEquals(ids(g[1].itens), ["p2"]);
  assertEquals(totalItensGrupos(g), 2);
});

Deno.test("categorias sem nenhum item da lista: lista sem grupos (como a prévia)", () => {
  const g = agruparItensParaPdf([prod("p1")], [{ id: "a", nome: "A", itemIds: ["zzz"] }]);
  assertEquals(g, [{ nome: null, itens: [prod("p1")] }]);
});

Deno.test("sem 'Outros' quando todos os itens estão categorizados", () => {
  const g = agruparItensParaPdf([prod("p1")], [{ id: "a", nome: "A", itemIds: ["p1"] }]);
  assertEquals(g.map((x) => x.nome), ["A"]);
});

// ---------- Cores, imagem e texto ----------

Deno.test("cores personalizadas têm prioridade sobre o template (mesma regra da prévia)", () => {
  const t = TEMPLATES_PADRAO[0];
  assertEquals(coresCatalogoPdf({}, t).header, t.cores.primaria);
  const c = coresCatalogoPdf({ corPrimariaPersonalizada: "#111111", corFundoPersonalizada: "#222222", corTextoPersonalizada: "#eeeeee" }, t);
  assertEquals([c.primaria, c.header, c.fundo, c.texto], ["#111111", "#111111", "#222222", "#eeeeee"]);
  assertEquals(coresCatalogoPdf({ corPrimariaPersonalizada: "#111111", corHeaderPersonalizada: "#333333" }, t).header, "#333333");
});

Deno.test("hexParaRgb aceita #abc/#aabbcc e cai no padrão com cor inválida; texto legível sobre o fundo", () => {
  assertEquals(hexParaRgb("#fff"), [255, 255, 255]);
  assertEquals(hexParaRgb("3B82F6"), [59, 130, 246]);
  assertEquals(hexParaRgb("vermelho", [1, 2, 3]), [1, 2, 3]);
  assertEquals(hexParaRgb(undefined, [1, 2, 3]), [1, 2, 3]);
  assertEquals(corTextoSobre([255, 255, 255]), [17, 24, 39]);
  assertEquals(corTextoSobre([30, 58, 138]), [255, 255, 255]);
});

Deno.test("logo/foto encaixa sem distorcer (proporção mantida)", () => {
  const largo = encaixarProporcional(800, 200, 110, 48); // logo 4:1
  assertAlmostEquals(largo.largura, 110);
  assertAlmostEquals(largo.altura, 27.5);
  assertAlmostEquals(largo.largura / largo.altura, 4);
  const alto = encaixarProporcional(300, 600, 80, 40);
  assertAlmostEquals(alto.largura, 20);
  assertAlmostEquals(alto.altura, 40);
  assertEquals(encaixarProporcional(0, 100, 10, 10), { largura: 0, altura: 0 });
});

Deno.test("texto seguro para as fontes do PDF: tira emoji, troca espaço especial", () => {
  assertEquals(textoSeguroPdf("Capinha 📱 Ação R$"), "Capinha Ação R$");
  assertEquals(textoSeguroPdf("Película – “3D”"), "Película – “3D”");
  assertEquals(textoSeguroPdf(null), "");
});

Deno.test("o item do PDF não carrega custo, lucro nem margem", () => {
  const r = itensParaPdf([prod("p1"), disp("d1")], []);
  for (const item of r) {
    for (const chave of Object.keys(item)) {
      assert(!/custo|lucro|margem/i.test(chave), `campo interno no PDF: ${chave}`);
    }
  }
});
