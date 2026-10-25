// deno test --no-check --no-lock scripts/testes-os-multi/
// Etapa 6d da OS com vários dispositivos: "aparelhos e serviços" da linha
// expandida na lista de OS (src/lib/ordemServico/aparelhosServicosListaOS.ts).
// Só dados fictícios; nada vai à rede.
import { assertEquals } from "jsr:@std/assert@1";
import {
  adicionaisFalharam,
  agruparServicosPorAparelho,
  CHAVE_GRUPO_PRINCIPAL,
  lerLinhasServicoOS,
  TITULO_GRUPO_PRINCIPAL,
} from "../../src/lib/ordemServico/aparelhosServicosListaOS.ts";

const D1 = { dispositivo_tipo: "Celular", dispositivo_marca: "Apple", dispositivo_modelo: "iPhone 11", dispositivo_imei: "3567", dispositivo_numero_serie: null };
const A = { id: "a", dispositivo_marca: "Samsung", dispositivo_modelo: "A55", dispositivo_imei: null, dispositivo_numero_serie: "SN-2" };
const B = { id: "b", dispositivo_marca: "Motorola", dispositivo_modelo: "G8", dispositivo_imei: null, dispositivo_numero_serie: null };
const resumo = (r: ReturnType<typeof agruparServicosPorAparelho>) =>
  r.grupos.map((g) => [g.titulo, g.detalhe, g.servicos.map((s) => `${s.nome}=${s.valor}`)]);

// ------------------------------------------------------------------- leitura

Deno.test("leitura: resposta normal", () => {
  const l = lerLinhasServicoOS({ servicos: [{ nome: "Tela", preco: 350, custo: 180, linha_id: "l1", dispositivo_ref: "a", quantidade: 2 }] });
  assertEquals(l, [{ nome: "Tela", quantidade: 2, preco: 350, custo: 180, peca_valor: null, peca_repassada: false, dispositivo_ref: "a", linha_id: "l1" }]);
});

Deno.test("leitura defensiva: servicos_realizados ausente, nulo ou que não é lista", () => {
  for (const d of [null, undefined, {}, { servicos: null }, { servicos: "x" }, { servicos: { nome: "a" } }, { servicos: 3 }, [], "x"]) {
    assertEquals(lerLinhasServicoOS(d), []);
  }
});

Deno.test("leitura defensiva: itens que não são objeto saem; campos estranhos viram vazio", () => {
  const l = lerLinhasServicoOS({ servicos: [null, 1, "x", [], { nome: 5, preco: {}, dispositivo_ref: "", linha_id: 7 }] });
  assertEquals(l, [{ nome: "", quantidade: undefined, preco: null, custo: null, peca_valor: null, peca_repassada: false }]);
});

// --------------------------------------------------------------- agrupamento

Deno.test("agrupar: aparelho 1, extras com seus serviços e 'Da OS / principal' por último", () => {
  const linhas = lerLinhasServicoOS({ servicos: [
    { nome: "Troca de tela", preco: 350 },
    { nome: "Formatação", preco: 50, dispositivo_ref: "a" },
    { nome: "Bateria", preco: 120, dispositivo_ref: "b" },
  ] });
  const r = agruparServicosPorAparelho(linhas, D1, [A, B]);
  assertEquals(resumo(r), [
    ["Dispositivo 1 — Apple iPhone 11", "IMEI 3567", []],
    ["Dispositivo 2 — Samsung A55", "Série SN-2", ["Formatação=50"]],
    ["Dispositivo 3 — Motorola G8", null, ["Bateria=120"]],
    [TITULO_GRUPO_PRINCIPAL, null, ["Troca de tela=350"]],
  ]);
  assertEquals(r.semServicos, false);
  assertEquals(r.grupos.map((g) => g.tipo), ["dispositivo1", "adicional", "adicional", "principal"]);
});

Deno.test("agrupar: ligação a aparelho que não existe mais vai para 'Da OS / principal'", () => {
  const r = agruparServicosPorAparelho(lerLinhasServicoOS({ servicos: [{ nome: "Formatação", preco: 50, dispositivo_ref: "removido" }] }), D1, [A]);
  assertEquals(resumo(r)[1], ["Dispositivo 2 — Samsung A55", "Série SN-2", []]);
  assertEquals(r.grupos[2].chave, CHAVE_GRUPO_PRINCIPAL);
  assertEquals(resumo(r)[2][2], ["Formatação=50"]);
});

Deno.test("agrupar: quantidade ausente vale 1; quantidade 3 sai '3x Nome' com o total da linha", () => {
  const r = agruparServicosPorAparelho(lerLinhasServicoOS({ servicos: [
    { nome: "Formatação", preco: 150, quantidade: 3, dispositivo_ref: "a" },
    { nome: "Limpeza", preco: 40 },
    { nome: "Película", preco: 30, quantidade: "abc" },
  ] }), D1, [A]);
  assertEquals(resumo(r)[1][2], ["3x Formatação=150"]);
  assertEquals(resumo(r)[2][2], ["Limpeza=40", "Película=30"]);
});

Deno.test("agrupar: peça repassada soma a peça (mesma conta do total da OS)", () => {
  const r = agruparServicosPorAparelho(lerLinhasServicoOS({ servicos: [
    { nome: "Tela", preco: 100, custo: 250, peca_valor: 250, peca_repassada: true, dispositivo_ref: "a" },
    { nome: "Tela sem flag", preco: 400, custo: 250 },
    { nome: "Preço em texto", preco: "80.5" },
  ] }), D1, [A]);
  assertEquals(r.grupos[1].servicos[0].valor, 350);
  assertEquals(r.grupos[2].servicos.map((s) => s.valor), [400, 80.5]);
});

Deno.test("agrupar: lista vazia = só os aparelhos e semServicos", () => {
  const r = agruparServicosPorAparelho([], D1, [A]);
  assertEquals(r.semServicos, true);
  assertEquals(r.grupos.length, 2);
  assertEquals(r.grupos.every((g) => g.servicos.length === 0), true);
});

Deno.test("agrupar: 10 aparelhos (9 extras), cada serviço no seu", () => {
  const extras = Array.from({ length: 9 }, (_, i) => ({ id: `x${i}`, dispositivo_marca: "Marca", dispositivo_modelo: `M${i}` }));
  const linhas = lerLinhasServicoOS({ servicos: extras.map((e, i) => ({ nome: `S${i}`, preco: i + 1, dispositivo_ref: e.id })) });
  const r = agruparServicosPorAparelho(linhas, D1, extras);
  assertEquals(r.grupos.length, 10);
  assertEquals(r.grupos[9].titulo, "Dispositivo 10 — Marca M8");
  assertEquals(r.grupos[9].servicos.map((s) => s.nome), ["S8"]);
  assertEquals(r.grupos.some((g) => g.tipo === "principal"), false);
});

Deno.test("agrupar: serviço repetido tem chaves diferentes (linha_id ou posição)", () => {
  const r = agruparServicosPorAparelho(lerLinhasServicoOS({ servicos: [
    { nome: "Formatação", preco: 50, linha_id: "l1" },
    { nome: "Formatação", preco: 50, linha_id: "l2" },
    { nome: "Limpeza", preco: 10 },
    { nome: "Limpeza", preco: 10 },
  ] }), D1, []);
  const chaves = r.grupos[1].servicos.map((s) => s.chave);
  assertEquals(new Set(chaves).size, 4);
});

Deno.test("agrupar: aparelho sem marca/modelo usa tipo; sem nada, só o número", () => {
  const r = agruparServicosPorAparelho([], { dispositivo_tipo: "Notebook" }, [{ id: "a" }]);
  assertEquals(r.grupos.map((g) => g.titulo), ["Dispositivo 1 — Notebook", "Dispositivo 2"]);
  assertEquals(r.grupos.map((g) => g.detalhe), [null, null]);
});

// ------------------------------------------------------------------- falha

Deno.test("falha: lista vazia com adicionais no resumo = falha; resto não", () => {
  assertEquals(adicionaisFalharam(0, 2), true);
  assertEquals(adicionaisFalharam(2, 2), false);
  assertEquals(adicionaisFalharam(1, 2), false);
  assertEquals(adicionaisFalharam(0, 0), false);
});
