// deno test --no-check scripts/testes-servicos-layout/
// Dados totalmente fictícios.
import { assertEquals } from "jsr:@std/assert@1";
import {
  contarSemTipo,
  filtrarServicos,
  lerValorFiltro,
  lucroDoServico,
  normalizarTexto,
  paginar,
  paginasVisiveis,
  resumoServicos,
  type ServicoDaLista,
} from "../../src/lib/servicos/listaServicosDesktop.ts";

const s = (id: string, extra: Partial<ServicoDaLista> = {}): ServicoDaLista => ({
  id, nome: `Serviço ${id}`, codigo: null, custo: 0, preco: 0, peca_id: null, tipo_servico_id: null, ...extra,
});
const ids = (l: { id: string }[]) => l.map((x) => x.id).join(",");

// Lista feita à mão para conferir os indicadores.
const catalogo: ServicoDaLista[] = [
  s("a", { nome: "Troca de Tela", codigo: "TEL-01", custo: 180, preco: 580, peca_id: "p1", tipo_servico_id: "t-tela" }),
  s("b", { nome: "Software", custo: 0, preco: 80, tipo_servico_id: "t-soft" }),
  s("c", { nome: "Troca de Bateria", custo: null, preco: 100 }),           // sem custo
  s("d", { nome: "Limpeza Ótica", custo: 30, preco: null, peca_id: "p2" }), // sem preço
  s("e", { nome: "Conector de Carga", custo: 0.1, preco: 0.3 }),            // centavos
  s("f", { nome: "Reparo placa", custo: 300, preco: 250, peca_id: "p3" }),  // preço < custo
];

// ---------- Lucro por serviço ----------

Deno.test("lucro = preço − custo; vazio conta 0; pode ser negativo; sem erro de centavos", () => {
  assertEquals(lucroDoServico(catalogo[0]), 400);
  assertEquals(lucroDoServico(catalogo[2]), 100);  // sem custo
  assertEquals(lucroDoServico(catalogo[3]), -30);  // sem preço
  assertEquals(lucroDoServico(catalogo[4]), 0.2);  // 0.3 - 0.1 em ponto flutuante daria 0.19999…
  assertEquals(lucroDoServico(catalogo[5]), -50);
  assertEquals(lucroDoServico({ custo: null, preco: null }), 0);
});

// ---------- Indicadores ----------

Deno.test("indicadores somam certo contra a lista feita à mão", () => {
  // lucros: 400 + 80 + 100 − 30 + 0,20 − 50 = 500,20
  assertEquals(resumoServicos(catalogo), {
    total: 6, comPeca: 3, semPeca: 3, percentualComPeca: 50, percentualSemPeca: 50, lucroTotal: 500.2,
  });
});

Deno.test("indicadores: lista vazia = tudo zero (sem divisão por zero)", () => {
  assertEquals(resumoServicos([]), {
    total: 0, comPeca: 0, semPeca: 0, percentualComPeca: 0, percentualSemPeca: 0, lucroTotal: 0,
  });
  assertEquals(contarSemTipo([]), 0);
});

Deno.test("indicadores: percentuais arredondados fecham 100", () => {
  const r = resumoServicos([s("1", { peca_id: "p" }), s("2"), s("3")]);
  assertEquals([r.percentualComPeca, r.percentualSemPeca], [33, 67]);
});

Deno.test("indicadores: lucro total negativo quando só há prejuízo", () => {
  assertEquals(resumoServicos([s("1", { custo: 50, preco: 20 })]).lucroTotal, -30);
});

Deno.test("sem tipo vinculado conta tipo de serviço, não peça", () => {
  assertEquals(contarSemTipo(catalogo), 4); // c, d, e, f
  // "a" tem peça e tipo; "d" tem peça e não tem tipo: as duas contagens são independentes
  assertEquals(resumoServicos(catalogo).semPeca, 3);
});

// ---------- Filtros ----------

Deno.test("busca ignora acento e maiúscula, no nome e no código", () => {
  assertEquals(ids(filtrarServicos(catalogo, { busca: "otica" })), "d");
  assertEquals(ids(filtrarServicos(catalogo, { busca: "  LIMPEZA   ÓTICA " })), "d");
  assertEquals(ids(filtrarServicos(catalogo, { busca: "tel-01" })), "a");
  assertEquals(ids(filtrarServicos(catalogo, { busca: "TROCA" })), "a,c");
  assertEquals(ids(filtrarServicos(catalogo, { busca: "" })), "a,b,c,d,e,f");
  assertEquals(filtrarServicos(catalogo, { busca: "não existe" }), []);
  assertEquals(normalizarTexto("Ação  ÚTIL"), "acao util");
});

Deno.test("somente sem tipo e filtro por tipo", () => {
  assertEquals(ids(filtrarServicos(catalogo, { soSemTipo: true })), "c,d,e,f");
  assertEquals(ids(filtrarServicos(catalogo, { tipoServicoId: "t-soft" })), "b");
  assertEquals(ids(filtrarServicos(catalogo, { tipoServicoId: null })), "a,b,c,d,e,f");
});

Deno.test("filtros combinados (E)", () => {
  assertEquals(ids(filtrarServicos(catalogo, { busca: "troca", soSemTipo: true })), "c");
  assertEquals(ids(filtrarServicos(catalogo, { busca: "troca", tipoServicoId: "t-tela" })), "a");
  // sem tipo + um tipo específico = nada
  assertEquals(filtrarServicos(catalogo, { soSemTipo: true, tipoServicoId: "t-tela" }), []);
});

Deno.test("filtros em lista vazia", () => {
  assertEquals(filtrarServicos([], { busca: "x", soSemTipo: true, tipoServicoId: "t" }), []);
});

// ---------- Filtro de preço ----------
// preços do catálogo: a 580, b 80, c 100, d vazio (conta 0), e 0,30, f 250

Deno.test("preço: só mínimo, só máximo, os dois (limites inclusivos)", () => {
  assertEquals(ids(filtrarServicos(catalogo, { precoMinimo: 100 })), "a,c,f");
  assertEquals(ids(filtrarServicos(catalogo, { precoMaximo: 100 })), "b,c,d,e");
  assertEquals(ids(filtrarServicos(catalogo, { precoMinimo: 80, precoMaximo: 250 })), "b,c,f");
  assertEquals(ids(filtrarServicos(catalogo, { precoMinimo: 0.3, precoMaximo: 0.3 })), "e");
});

Deno.test("preço vazio conta 0 no filtro", () => {
  assertEquals(ids(filtrarServicos(catalogo, { precoMaximo: 0 })), "d");
  assertEquals(ids(filtrarServicos(catalogo, { precoMinimo: 0.01 })), "a,b,c,e,f");
});

Deno.test("preço: mínimo maior que máximo = vazio, sem erro", () => {
  assertEquals(filtrarServicos(catalogo, { precoMinimo: 500, precoMaximo: 100 }), []);
});

Deno.test("preço: limite null = sem limite", () => {
  assertEquals(ids(filtrarServicos(catalogo, { precoMinimo: null, precoMaximo: null })), "a,b,c,d,e,f");
});

Deno.test("preço combinado com busca, tipo e sem tipo", () => {
  assertEquals(ids(filtrarServicos(catalogo, { busca: "troca", precoMinimo: 200 })), "a");
  assertEquals(ids(filtrarServicos(catalogo, { soSemTipo: true, precoMaximo: 100 })), "c,d,e");
  assertEquals(ids(filtrarServicos(catalogo, { tipoServicoId: "t-soft", precoMinimo: 81 })), "");
});

Deno.test("valor digitado: formatos aceitos; vazio, inválido e negativo = sem limite", () => {
  assertEquals(lerValorFiltro("100"), 100);
  assertEquals(lerValorFiltro("1.234,56"), 1234.56);
  assertEquals(lerValorFiltro("R$ 1.234,56"), 1234.56);
  assertEquals(lerValorFiltro("1234.56"), 1234.56);
  assertEquals(lerValorFiltro("1.234"), 1234);
  assertEquals(lerValorFiltro("0,5"), 0.5);
  assertEquals(lerValorFiltro(""), null);
  assertEquals(lerValorFiltro("   "), null);
  assertEquals(lerValorFiltro(null), null);
  assertEquals(lerValorFiltro("abc"), null);
  assertEquals(lerValorFiltro("-10"), null);
  assertEquals(lerValorFiltro("-10,50"), null);
  // negativo digitado não filtra nada
  assertEquals(filtrarServicos(catalogo, { precoMaximo: lerValorFiltro("-10") }).length, 6);
});

// ---------- Paginação ----------

const muitos = Array.from({ length: 23 }, (_, i) => s(String(i + 1)));

Deno.test("paginação 10/20/50", () => {
  const p1 = paginar(muitos, 1, 10);
  assertEquals([p1.inicio, p1.fim, p1.total, p1.totalPaginas, p1.itens.length], [1, 10, 23, 3, 10]);
  const p3 = paginar(muitos, 3, 10);
  assertEquals([p3.inicio, p3.fim, ids(p3.itens)], [21, 23, "21,22,23"]);
  assertEquals(paginar(muitos, 2, 20).itens.length, 3);
  assertEquals(paginar(muitos, 1, 50).totalPaginas, 1);
});

Deno.test("paginação: página fora do intervalo é corrigida", () => {
  assertEquals(paginar(muitos, 9, 10).pagina, 3);
  assertEquals(paginar(muitos, 0, 10).pagina, 1);
  assertEquals(paginar(muitos, -4, 10).pagina, 1);
  assertEquals(paginar(muitos, NaN, 10).pagina, 1);
});

Deno.test("paginação: lista vazia = 0 a 0 de 0, uma página", () => {
  assertEquals(paginar([], 5, 10), { itens: [], pagina: 1, totalPaginas: 1, inicio: 0, fim: 0, total: 0 });
});

Deno.test("botões de página com reticências", () => {
  assertEquals(paginasVisiveis(1, 1), [1]);
  assertEquals(paginasVisiveis(1, 12), [1, 2, "…", 12]);
  assertEquals(paginasVisiveis(5, 12), [1, "…", 4, 5, 6, "…", 12]);
  assertEquals(paginasVisiveis(12, 12), [1, "…", 11, 12]);
});
