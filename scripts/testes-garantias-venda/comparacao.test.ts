// node --test scripts/testes-garantias-venda/
// Fluxo ANTIGO (freio fechado, usuário não admin: nenhum item com garantia_escolhida):
// o objeto vendaData e o item vindo do cartão (location.state) são IDÊNTICOS aos
// da origin/main — mesmas chaves, mesma ordem, mesmos valores — avaliando os
// trechos reais dos dois PDV.tsx com as mesmas entradas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarObjeto, fonte, objetoLiteral } from "./apoio.ts";
import * as venda from "../../src/lib/garantias/vendaGarantia.ts";

const PDV = { main: fonte("src/pages/PDV.tsx", "main"), branch: fonte("src/pages/PDV.tsx", "branch") };
const posLaco = (s: string) => s.indexOf("for (let parcIdx = 0; parcIdx < totalParcelas; parcIdx++)");
const LINHA = {
  main: objetoLiteral(PDV.main, "const vendaData = {", posLaco(PDV.main)),
  branch: objetoLiteral(PDV.branch, "const vendaData = {", posLaco(PDV.branch)),
};
const ITEM_CARTAO = {
  main: objetoLiteral(PDV.main, "const itemVenda: ItemVenda = {"),
  branch: objetoLiteral(PDV.branch, "const itemVenda: ItemVenda = {"),
};

const base = {
  tipoParaBanco: "dispositivo", clienteId: null, dispositivoId: "disp-1", produtoId: null, pecaId: null,
  duplo: false, totalBrutoItem: 3000, valorPorParcela: 3000, isParceladoReceber: false, totalParcelas: 1,
  formaBanco: "pix", userIdParaVenda: "dono-1", empresaIdPDV: null, dataPrevisao: null, forma: "pix",
  grupoVendaId: "grupo-1", descontoPorParcela: 0, funcionarioSelecionadoId: null, parcIdx: 0,
  sufixoForma: false, nomeForma: "Pix", segundaFormaPagamento: "", resolverFormaPagamentoBanco: (f: string) => `banco:${f}`,
  valorSegundaPagamento: 0, segundaPorItem: null, idxItem: 0, trocaPorLinha: null,
  // só a branch usa (fluxo antigo: nenhum texto)
  camposGarantiaVenda: venda.camposGarantiaVenda, textosGarantia: { textoIdPorItem: [], falhas: 0 },
};
const disp = { id: "disp-1", tipo: "dispositivo", nome: "Aparelho Exemplo", preco: 3000, custo: 2000, quantidade: 1, estoque: 1, dispositivo_id: "disp-1", imei_dispositivo: "350000000000000", tempo_garantia: 6, modelo_termo_garantia_id: "padrao_6meses" };

const CASOS: [string, Record<string, unknown>][] = [
  ["aparelho à vista com garantia", { item: disp }],
  ["aparelho sem tempo de garantia", { item: { ...disp, tempo_garantia: undefined } }],
  ["aparelho sem IMEI escolhido", { item: { ...disp, imei_dispositivo: undefined } }],
  ["produto", { item: { id: "p1", tipo: "produto", nome: "Capinha", preco: 50, custo: 10, quantidade: 2, produto_id: "p1" }, tipoParaBanco: "produto", dispositivoId: null, produtoId: "p1" }],
  ["peça", { item: { id: "pc1", tipo: "peca", nome: "Tela", preco: 300, custo: 100, quantidade: 1, peca_id: "pc1" }, tipoParaBanco: "produto", dispositivoId: null, pecaId: "pc1" }],
  ["a receber parcelado (parcela 2 de 3)", { item: disp, forma: "a_receber", formaBanco: "a_receber", isParceladoReceber: true, totalParcelas: 3, parcIdx: 1, valorPorParcela: 1000, dataPrevisao: "2026-12-20" }],
  ["pagamento duplo", { item: disp, duplo: true, segundaFormaPagamento: "dinheiro", valorSegundaPagamento: 500, segundaPorItem: [500] }],
  ["troca na venda", { item: disp, trocaPorLinha: [[700]] }],
  ["forma customizada", { item: disp, sufixoForma: true, nomeForma: "Carnê da loja", formaBanco: "outro" }],
  ["funcionário + filial", { item: disp, funcionarioSelecionadoId: "func-1", empresaIdPDV: "filial-1", clienteId: "cli-1" }],
  ["2º item do carrinho", { item: { ...disp, id: "disp-2", dispositivo_id: "disp-2" }, idxItem: 1, dispositivoId: "disp-2" }],
];

for (const [nome, extra] of CASOS) {
  test(`vendaData idêntico à main: ${nome}`, () => {
    const escopo = { ...base, ...extra };
    const a = avaliarObjeto(LINHA.main, escopo);
    const b = avaliarObjeto(LINHA.branch, escopo);
    assert.equal(JSON.stringify(b), JSON.stringify(a)); // mesma ordem de chaves
    assert.deepStrictEqual(b, a);
  });
}

const dispositivoCartao = { id: "disp-1", marca: "Marca", modelo: "Modelo X", preco: 3000, custo: 2000, quantidade: 1, imei: "350000000000000", imei2: null, condicao: "seminovo", tempo_garantia: 6, cor: "Preto", capacidade_gb: 128, numero_serie: "SERIE1" };

test("item vindo do cartão (location.state antigo) idêntico à main", () => {
  for (const d of [dispositivoCartao, { ...dispositivoCartao, tempo_garantia: undefined }, { ...dispositivoCartao, imei: null, cor: undefined }]) {
    const state = { dispositivoSelecionado: d, entradaTrocaInicial: null };
    const escopo = { dispositivo: d, state, escolhaGarantiaValida: venda.escolhaGarantiaValida };
    const a = avaliarObjeto(ITEM_CARTAO.main, escopo);
    const b = avaliarObjeto(ITEM_CARTAO.branch, escopo);
    assert.equal(JSON.stringify(b), JSON.stringify(a));
  }
});

test("item vindo do cartão com garantia escolhida (seletor novo): só acrescenta garantia_escolhida; state inválido é ignorado", () => {
  const escolha = { garantia_id: "g-6", nome: "Garantia 6 meses", meses: 6, texto: "T", tipo: "loja" };
  const d = { ...dispositivoCartao, tempo_garantia: 6 };
  const comEscolha = avaliarObjeto(ITEM_CARTAO.branch, { dispositivo: d, state: { dispositivoSelecionado: d, garantiaEscolhida: escolha }, escolhaGarantiaValida: venda.escolhaGarantiaValida });
  const antigo = avaliarObjeto(ITEM_CARTAO.main, { dispositivo: d, state: { dispositivoSelecionado: d } });
  assert.deepStrictEqual(comEscolha, { ...antigo, garantia_escolhida: escolha });
  const invalido = avaliarObjeto(ITEM_CARTAO.branch, { dispositivo: d, state: { dispositivoSelecionado: d, garantiaEscolhida: { nome: "x" } }, escolhaGarantiaValida: venda.escolhaGarantiaValida });
  assert.equal(JSON.stringify(invalido), JSON.stringify(antigo));
});
