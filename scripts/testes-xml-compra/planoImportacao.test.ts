// deno test --no-check --no-lock --node-modules-dir=none -A scripts/testes-xml-compra/
// Etapa 2 da importação de XML (sem gravar): dados tributáveis, sugestão de
// vínculo, quantidade/fator, custo em centavos, previsão do custo médio e
// resumo. Só XMLs e cadastros fictícios.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { JSDOM } from "npm:jsdom@25.0.1";
import { lerXmlNfe, type ItemNfe } from "../../src/lib/nfe/lerXmlNfe.ts";
import { lerDadosTributaveis } from "../../src/lib/nfe/dadosTributaveisNfe.ts";
import {
  buscarCandidatos,
  indexarCandidatos,
  normalizarGtin,
  sugerirVinculo,
  type CandidatoEstoque,
} from "../../src/lib/nfe/sugestaoVinculo.ts";
import {
  calcularCustoItem,
  calcularQuantidade,
  decisaoInicial,
  lerCustoUsuario,
  montarLinha,
  resumirImportacao,
  sugerirFator,
  type DecisaoItem,
} from "../../src/lib/nfe/planoImportacao.ts";
import { gerarXmlNfe, imeiFicticio } from "./fixtures.ts";

const janela = new JSDOM("").window;
const criarParser = () => new janela.DOMParser() as unknown as DOMParser;
const ler = (xml: string) => lerXmlNfe(xml, { criarParser });
const trib = (xml: string) => lerDadosTributaveis(xml, { criarParser });

const cand = (p: Partial<CandidatoEstoque> & { id: string; nome: string }): CandidatoEstoque => ({
  tipo: "produto", variacaoLabel: null, sku: null, codigoBarras: null, quantidade: 0, custo: null, ...p,
});
const CADASTRO: CandidatoEstoque[] = [
  cand({ id: "p1", nome: "Película 3D Fictícia Modelo A", codigoBarras: "7891234567895", quantidade: 10, custo: 4 }),
  cand({ id: "p2", nome: "Capinha Silicone Fictícia", sku: "FIC-CAP-02", quantidade: 0, custo: null }),
  cand({ id: "p3", nome: "Cabo USB-C Fictício 1m", codigoBarras: "0789100000001" + "0", quantidade: 5, custo: 9.9 }),
  cand({ id: "k1", nome: "Tela Fictícia Modelo Z", tipo: "peca", codigoBarras: "FORN-TELA-9", quantidade: 2, custo: 120 }),
];
const indice = indexarCandidatos(CADASTRO);

/** Item mínimo para as funções de custo/quantidade. */
const item = (p: Partial<ItemNfe>): ItemNfe => ({
  nItem: 1, cProd: "X", ean: null, cEANOriginal: "", xProd: "ITEM", ncm: "", cest: "", cfop: "", uCom: "UN",
  qCom: "1.0000", vUnCom: "1.00", vProd: "1.00", vDesc: "", vFrete: "", vSeg: "", vOutro: "", vIPI: "", vST: "",
  vFCPST: "", infAdProd: "", imeisSugeridos: [], ...p,
});
const decisao = (p: Partial<DecisaoItem> = {}): DecisaoItem => ({
  acao: "novo", vinculo: null, origemVinculo: null, tipoNovo: "produto", fator: "1", quantidadeManual: "",
  custoManual: "", atualizarCustoMedio: null, ...p,
});

// ---------------------------------------------------------------- custo
Deno.test("custo: desconto, frete, seguro, outras, IPI, ST e FCP-ST somam/subtraem em centavos", () => {
  const c = calcularCustoItem(item({
    qCom: "10.0000", vUnCom: "4.5000000000", vProd: "45.00", vFrete: "2.00", vSeg: "0.50", vOutro: "0.30",
    vIPI: "1.20", vST: "3.10", vFCPST: "0.40", vDesc: "5.00",
  }), 10);
  assertEquals(c.totalCentavos, 4500 + 200 + 50 + 30 + 120 + 310 + 40 - 500);
  assertEquals(c.unitarioCentavos, 475); // 4750 / 10
  assertEquals(c.parcelas.map((p) => [p.rotulo.split(" ")[0], p.sinal * p.centavos]),
    [["Produtos", 4500], ["Frete", 200], ["Seguro", 50], ["Outras", 30], ["IPI", 120], ["ICMS-ST", 310], ["FCP-ST", 40], ["Desconto", -500]]);
  assertEquals(c.erro, null);
});

Deno.test("custo: arredonda meio-para-cima em centavos, sem float acumulado", () => {
  // 3 × 3,3333333333 = 9,9999999999 → R$ 10,00; ÷ 3 = 3,333… → 3,33
  const c = calcularCustoItem(item({ qCom: "3.0000", vUnCom: "3.3333333333", vProd: "10.00" }), 3);
  assertEquals([c.totalCentavos, c.unitarioCentavos], [1000, 333]);
  // 0,1 + 0,2 clássico: 2 × 0,15 = 0,30 exato
  assertEquals(calcularCustoItem(item({ qCom: "2.0000", vUnCom: "0.15" }), 2).totalCentavos, 30);
  // 1,005 por unidade → meio-para-cima → 1,01
  assertEquals(calcularCustoItem(item({ qCom: "2.0000", vUnCom: "1.00", vFrete: "0.01" }), 2).unitarioCentavos, 101);
  // desconto maior que o item = erro
  assert(calcularCustoItem(item({ vDesc: "5.00" }), 1).erro !== null);
});

Deno.test("custo digitado: vírgula, ponto, inválido", () => {
  assertEquals(lerCustoUsuario("12,50"), 1250);
  assertEquals(lerCustoUsuario("12.5"), 1250);
  assertEquals(lerCustoUsuario(""), null);
  assert(Number.isNaN(lerCustoUsuario("1.234,56") as number));
  assert(Number.isNaN(lerCustoUsuario("-3") as number));
});

// ---------------------------------------------------------------- quantidade
Deno.test("quantidade: inteira passa; fracionada é erro até ajustar", () => {
  assertEquals(calcularQuantidade(item({ qCom: "10.0000" }), "1", "").inteira, 10);
  const frac = calcularQuantidade(item({ qCom: "1.5000", uCom: "CX" }), "1", "");
  assertEquals([frac.inteira, frac.calculada, frac.precisaAjuste], [null, "1.5", true]);
  assert(frac.erro!.includes("1,5"));
  // corrigindo pelo fator (1 CX = 12 → 18) ou digitando a quantidade
  assertEquals(calcularQuantidade(item({ qCom: "1.5000", uCom: "CX" }), "12", "").inteira, 18);
  assertEquals(calcularQuantidade(item({ qCom: "1.5000", uCom: "CX" }), "1", "2").inteira, 2);
  assert(calcularQuantidade(item({ qCom: "1.5000" }), "1", "2,5").erro !== null);
  assert(calcularQuantidade(item({ qCom: "2.0000" }), "0", "").erro !== null);
  assert(calcularQuantidade(item({ qCom: "2.0000" }), "abc", "").erro !== null);
  // fator decimal exato: 3 × 0,5 = 1,5 (erro); 4 × 0,25 = 1
  assertEquals(calcularQuantidade(item({ qCom: "4.0000" }), "0,25", "").inteira, 1);
});

Deno.test("caixa: fator sugerido por qTrib ÷ qCom quando a unidade tributável é outra", () => {
  const xml = gerarXmlNfe({ itens: [
    { cProd: "CX-1", uCom: "CX", qCom: "2.0000", uTrib: "UN", qTrib: "24.0000", vUnCom: "60.00", vProd: "120.00" },
    { cProd: "UN-1", qCom: "3.0000", vUnCom: "1.00", vProd: "3.00" },
    { cProd: "CX-2", uCom: "CX", qCom: "2.0000", uTrib: "UN", qTrib: "25.0000", vUnCom: "1.00", vProd: "2.00" },
  ] });
  const r = ler(xml);
  const t = trib(xml);
  assertEquals(sugerirFator(r.itens[0], t.get(1)), { fator: "12", origem: "tributavel" });
  assertEquals(sugerirFator(r.itens[1], t.get(2)), { fator: "1", origem: null });
  assertEquals(sugerirFator(r.itens[2], t.get(3)).fator, "1"); // 25/2 não é inteiro
  const d = decisaoInicial(r.itens[0], null, t.get(1));
  const linha = montarLinha(r.itens[0], d, true);
  assertEquals([linha.quantidade.inteira, linha.custoUnitarioCentavos, linha.situacao], [24, 500, "importar"]);
  assert(linha.quantidade.precisaAjuste);
});

// ---------------------------------------------------------------- vínculo
Deno.test("vínculo por EAN (cEAN), com GTIN-14 de zero à esquerda", () => {
  assertEquals(normalizarGtin("07891234567895"), "7891234567895");
  const s = sugerirVinculo({ ean: "7891234567895", cProd: "QUALQUER", xProd: "OUTRO NOME" }, indice);
  assertEquals([s?.candidato.id, s?.motivo, s?.quantidade], ["p1", "ean", 1]);
  const s14 = sugerirVinculo({ ean: "07891234567895", cProd: "", xProd: "" }, indice);
  assertEquals(s14?.candidato.id, "p1");
});

Deno.test("vínculo por cEANTrib quando cEAN é SEM GTIN; EAN inválido nunca vincula", () => {
  const xml = gerarXmlNfe({ itens: [
    { cEAN: "SEM GTIN", cEANTrib: "7891234567895", cProd: "ZZZ-1", xProd: "NOME DIFERENTE" },
    { cEAN: "7891234567890", cEANTrib: "7891234567890", cProd: "ZZZ-2", xProd: "OUTRO NOME QUALQUER" },
  ] });
  const r = ler(xml);
  const t = trib(xml);
  assertEquals(r.itens[0].ean, null);
  assertEquals(t.get(1)?.eanTrib, "7891234567895");
  assertEquals(sugerirVinculo({ ...r.itens[0], eanTrib: t.get(1)?.eanTrib }, indice)?.candidato.id, "p1");
  // dígito errado: leitura devolve null nos dois → sem vínculo por EAN
  assertEquals(t.get(2)?.eanTrib, null);
  assertEquals(sugerirVinculo({ ...r.itens[1], eanTrib: t.get(2)?.eanTrib }, indice), null);
});

Deno.test("vínculo por cProd = sku (produto) ou código do cadastro (peça)", () => {
  assertEquals(sugerirVinculo({ ean: null, cProd: " fic-cap-02 ", xProd: "X" }, indice)?.candidato.id, "p2");
  const peca = sugerirVinculo({ ean: null, cProd: "FORN-TELA-9", xProd: "X" }, indice);
  assertEquals([peca?.candidato.id, peca?.candidato.tipo, peca?.motivo], ["k1", "peca", "codigo"]);
  // cProd curto demais não vincula
  assertEquals(sugerirVinculo({ ean: null, cProd: "A1", xProd: "" }, indice), null);
});

Deno.test("vínculo por nome parecido é fraco e só acima do limite", () => {
  const s = sugerirVinculo({ ean: null, cProd: "", xProd: "PELICULA 3D FICTICIA MODELO A" }, indice);
  assertEquals([s?.candidato.id, s?.motivo], ["p1", "nome"]);
  assertEquals(s?.similaridade, 1);
  assertEquals(sugerirVinculo({ ean: null, cProd: "", xProd: "CARREGADOR TURBO" }, indice), null);
});

Deno.test("EAN repetido no cadastro: sugere o primeiro e avisa a quantidade", () => {
  const idx = indexarCandidatos([cand({ id: "a", nome: "A", codigoBarras: "7891234567895" }), cand({ id: "b", nome: "B", codigoBarras: "7891234567895" })]);
  assertEquals(sugerirVinculo({ ean: "7891234567895", cProd: "", xProd: "" }, idx)?.quantidade, 2);
});

Deno.test("busca manual por nome, sku e código", () => {
  assertEquals(buscarCandidatos(indice, "pelicula").map((c) => c.id), ["p1"]);
  assertEquals(buscarCandidatos(indice, "cap-02").map((c) => c.id), ["p2"]);
  assertEquals(buscarCandidatos(indice, "TELA-9").map((c) => c.id), ["k1"]);
  assertEquals(buscarCandidatos(indice, "").length, 4);
});

// ---------------------------------------------------------------- linhas e resumo
Deno.test("sugestão vira proposta de vínculo; sem sugestão começa como novo", () => {
  const r = ler(gerarXmlNfe({ itens: [{ cEAN: "7891234567895" }, { cEAN: "SEM GTIN", cProd: "NOVO-1", xProd: "PRODUTO INEXISTENTE XYZ" }] }));
  const d1 = decisaoInicial(r.itens[0], sugerirVinculo(r.itens[0], indice));
  const d2 = decisaoInicial(r.itens[1], sugerirVinculo(r.itens[1], indice));
  assertEquals([d1.acao, d1.vinculo?.id, d1.origemVinculo], ["vincular", "p1", "ean"]);
  assertEquals([d2.acao, d2.vinculo], ["novo", null]);
});

Deno.test("custo médio previsto (regra da RPC) e opção por item", () => {
  // p1: 10 un a 4,00; entram 10 a 5,00 → 4,50
  const it = item({ qCom: "10.0000", vUnCom: "5.00" });
  const p1 = CADASTRO[0];
  const com = montarLinha(it, decisao({ acao: "vincular", vinculo: p1 }), true);
  assertEquals([com.custoAtualCentavos, com.custoUnitarioCentavos, com.custoDepoisCentavos, com.atualizaCustoMedio], [400, 500, 450, true]);
  const semGeral = montarLinha(it, decisao({ acao: "vincular", vinculo: p1 }), false);
  assertEquals([semGeral.custoDepoisCentavos, semGeral.atualizaCustoMedio], [400, false]);
  const desligadoNoItem = montarLinha(it, decisao({ acao: "vincular", vinculo: p1, atualizarCustoMedio: false }), true);
  assertEquals(desligadoNoItem.custoDepoisCentavos, 400);
  // custo digitado entra na previsão
  const digitado = montarLinha(it, decisao({ acao: "vincular", vinculo: p1, custoManual: "6,00" }), true);
  assertEquals([digitado.custoUnitarioCentavos, digitado.custoDepoisCentavos, digitado.custoTotalCentavos], [600, 500, 6000]);
  // produto sem custo/estoque: custo novo direto
  assertEquals(montarLinha(it, decisao({ acao: "vincular", vinculo: CADASTRO[1] }), true).custoDepoisCentavos, 500);
});

Deno.test("item com IMEI fica fora do total (etapa futura); vincular sem produto é erro", () => {
  const a = imeiFicticio("35000000000021");
  const cel = item({ qCom: "1.0000", vUnCom: "1000.00", imeisSugeridos: [a] });
  assertEquals(montarLinha(cel, decisao(), true).situacao, "aparelho");
  const semProduto = montarLinha(item({}), decisao({ acao: "vincular" }), true);
  assertEquals(semProduto.situacao, "erro");
  assertEquals(semProduto.erros, ["Escolha o produto a vincular."]);
});

Deno.test("resumo: contagens, unidades, custo total, pendências e avisos", () => {
  const imei = imeiFicticio("35000000000031");
  const xml = gerarXmlNfe({ itens: [
    { cEAN: "7891234567895", qCom: "10.0000", vUnCom: "5.00", vProd: "50.00" },                        // vinculado (p1)
    { cEAN: "SEM GTIN", cProd: "NOVO-9", xProd: "ITEM NOVO QUALQUER", qCom: "2.0000", vUnCom: "3.00", vProd: "6.00" }, // novo
    { cEAN: "SEM GTIN", cProd: "IGN-1", xProd: "BRINDE", qCom: "1.0000", vUnCom: "1.00", vProd: "1.00" },   // ignorado
    { cEAN: "SEM GTIN", cProd: "FRAC", xProd: "FIO A METRO", uCom: "M", qCom: "2.5000", vUnCom: "2.00", vProd: "5.00" }, // erro
    { cEAN: "SEM GTIN", cProd: "CEL", xProd: "CELULAR FICTICIO", qCom: "1.0000", vUnCom: "900.00", vProd: "900.00", infAdProd: `IMEI ${imei}` },
    { cEAN: "7891234567895", qCom: "1.0000", vUnCom: "5.00", vProd: "5.00" },                          // mesmo produto do item 1
  ] });
  const r = ler(xml);
  const linhas = r.itens.map((it) => {
    const d = decisaoInicial(it, sugerirVinculo(it, indice));
    if (it.nItem === 3) d.acao = "ignorar";
    return montarLinha(it, d, true);
  });
  const res = resumirImportacao(r, linhas);
  assertEquals(
    [res.notaInvalida, res.totalItens, res.aImportar, res.vinculados, res.novos, res.ignorados, res.comErro, res.aparelhos],
    [false, 6, 3, 2, 1, 1, 1, 1],
  );
  assertEquals(res.unidades, 10 + 2 + 1);
  assertEquals(res.custoTotalCentavos, 5000 + 600 + 500);
  assertEquals(res.pendencias.map((p) => p.nItem), [4]);
  assertEquals(res.avisos.length, 1);
  assert(res.avisos[0].texto.includes("1, 6"));
  assertEquals(res.prontoParaGravar, false);
  assertEquals(res.fornecedor, "FORNECEDOR FICTICIO DE ACESSORIOS LTDA");

  // corrigindo o fracionado (quantidade digitada), fica pronto
  const corrigidas = linhas.map((l, i) => (l.nItem === 4 ? montarLinha(r.itens[i], { ...l.decisao, quantidadeManual: "3" }, true) : l));
  const ok = resumirImportacao(r, corrigidas);
  assertEquals([ok.pendencias.length, ok.prontoParaGravar, ok.aImportar], [0, true, 4]);
});

Deno.test("nota ok=false: resumo diz que não pode ser importada e nada mais", () => {
  const r = ler(gerarXmlNfe({ nNFDivergente: "999" }));
  assert(!r.ok);
  const res = resumirImportacao(r, []);
  assertEquals([res.notaInvalida, res.aImportar, res.pendencias.length], [true, 0, 0]);
});

Deno.test("tudo ignorado: pendência 'nenhum item'", () => {
  const r = ler(gerarXmlNfe());
  const res = resumirImportacao(r, r.itens.map((it) => montarLinha(it, decisao({ acao: "ignorar" }), true)));
  assertEquals(res.pendencias.map((p) => p.texto), ["Nenhum item marcado para importar."]);
});

Deno.test("990 itens com 5.000 cadastros: sugestões e resumo rápidos", () => {
  const cadastros = Array.from({ length: 5000 }, (_, i) => cand({ id: `c${i}`, nome: `Produto Ficticio Numero ${i} Modelo ${i % 37}`, sku: `SKU-${i}` }));
  const idx = indexarCandidatos(cadastros);
  const xml = gerarXmlNfe({ itens: Array.from({ length: 990 }, (_, i) => ({
    cEAN: "SEM GTIN", cProd: i % 3 === 0 ? `SKU-${i}` : `FORN-${i}`, xProd: `PRODUTO FICTICIO NUMERO ${i} MODELO ${i % 37}`,
    qCom: "1.0000", vUnCom: "1.00", vProd: "1.00",
  })) });
  const r = ler(xml);
  const t = trib(xml);
  const inicio = performance.now();
  const linhas = r.itens.map((it) => montarLinha(it, decisaoInicial(it, sugerirVinculo({ ...it, eanTrib: t.get(it.nItem)?.eanTrib }, idx), t.get(it.nItem)), true));
  const res = resumirImportacao(r, linhas);
  const ms = performance.now() - inicio;
  console.log(`    990 itens × 5.000 cadastros em ${ms.toFixed(0)} ms`);
  assertEquals(res.aImportar, 990);
  assertEquals(res.vinculados, 990); // 330 por código, o resto por nome
  assertEquals(linhas.filter((l) => l.decisao.origemVinculo === "codigo").length, 330);
  assertEquals(res.custoTotalCentavos, 99000);
  assert(ms < 3000, `lento demais: ${ms} ms`);
});
