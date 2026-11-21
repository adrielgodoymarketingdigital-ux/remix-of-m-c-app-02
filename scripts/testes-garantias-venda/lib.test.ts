// node --test scripts/testes-garantias-venda/
// Fase B de "Minhas garantias": regras puras de src/lib/garantias/vendaGarantia.ts e md5.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { md5Hex } from "../../src/lib/garantias/md5.ts";
import { garantiasPadraoVirtuais, type GarantiaExibida } from "../../src/lib/garantias/garantias.ts";
import { textoPadraoGarantia, TEXTO_PADRAO_COM_GARANTIA } from "../../src/lib/garantias/textoPadrao.ts";
import {
  camposGarantiaVenda,
  escolhaDeGarantia,
  escolhaGarantiaValida,
  escolhaPersonalizada,
  preSelecionarGarantia,
  textoACongelar,
} from "../../src/lib/garantias/vendaGarantia.ts";
import { seletorGarantiaVendaVisivelPara, MINHAS_GARANTIAS_LIBERADA } from "../../src/lib/garantias/visibilidadeMinhasGarantias.ts";

const g = (p: Partial<GarantiaExibida> & { chave: string }): GarantiaExibida => ({
  id: p.chave, virtual: false, nome: "G", meses: 3, texto: "T {{garantia_meses}}", ativo: true, ordem: 10, revisar: false, origem: "manual", ...p,
});

test("md5Hex = md5 do Postgres/Node (UTF-8, vazio, acentos, emoji, 20 mil bytes)", () => {
  const amostras = ["", "a", "Garantia de 3 meses", "ÇÃÉ ção — “aspas” • 90 dias", "📱 iPhone ✓", TEXTO_PADRAO_COM_GARANTIA, "x".repeat(55), "x".repeat(56), "x".repeat(64), "é".repeat(10000)];
  for (let i = 0; i < 200; i++) amostras.push(Array.from({ length: i * 7 }, (_, k) => String.fromCodePoint(32 + ((k * 7919 + i) % 20000))).join(""));
  for (const s of amostras) assert.equal(md5Hex(s), createHash("md5").update(s, "utf8").digest("hex"), JSON.stringify(s.slice(0, 20)));
});

test("escolha da loja / virtual / personalizada", () => {
  assert.deepEqual(escolhaDeGarantia(g({ chave: "g1", nome: "Garantia 6", meses: 6, texto: "T6" })),
    { garantia_id: "g1", nome: "Garantia 6", meses: 6, texto: "T6", tipo: "loja" });
  const v = garantiasPadraoVirtuais()[1];
  assert.deepEqual(escolhaDeGarantia(v), { garantia_id: null, nome: "Garantia 3 meses", meses: 3, texto: TEXTO_PADRAO_COM_GARANTIA, tipo: "virtual" });
  assert.deepEqual(escolhaPersonalizada(4), { garantia_id: null, nome: "Personalizada (4 meses)", meses: 4, texto: textoPadraoGarantia(4), tipo: "personalizada" });
  assert.equal(escolhaPersonalizada(12)?.nome, "Personalizada (1 ano)");
  assert.equal(escolhaPersonalizada(0)?.nome, "Sem garantia");
  for (const ruim of [-1, 121, 2.5, NaN]) assert.equal(escolhaPersonalizada(ruim), null, String(ruim));
});

test("pré-seleção pelo prazo do aparelho: um match, vários (1º pela ordem), nenhum, inativa ignorada", () => {
  const lista = [
    g({ chave: "sem", meses: 0, ordem: 0 }),
    g({ chave: "tres-a", meses: 3, ordem: 10 }),
    g({ chave: "tres-b", meses: 3, ordem: 20 }),
    g({ chave: "seis-inativa", meses: 6, ordem: 30, ativo: false }),
    g({ chave: "doze", meses: 12, ordem: 40 }),
  ];
  assert.deepEqual(preSelecionarGarantia(lista, { garantia: true, tempo_garantia: 12 }), { tipo: "garantia", chave: "doze" });
  assert.deepEqual(preSelecionarGarantia(lista, { garantia: true, tempo_garantia: 3 }), { tipo: "garantia", chave: "tres-a" });
  assert.deepEqual(preSelecionarGarantia(lista, { garantia: true, tempo_garantia: 6 }), { tipo: "personalizada", meses: 6 });
  assert.deepEqual(preSelecionarGarantia(lista, { garantia: true, tempo_garantia: 9 }), { tipo: "personalizada", meses: 9 });
  assert.deepEqual(preSelecionarGarantia(lista, { garantia: false, tempo_garantia: 12 }), { tipo: "garantia", chave: "sem" });
  assert.deepEqual(preSelecionarGarantia(lista, { garantia: true, tempo_garantia: null }), { tipo: "garantia", chave: "sem" });
  assert.deepEqual(preSelecionarGarantia([], { garantia: true, tempo_garantia: 3 }), { tipo: "personalizada", meses: 3 });
  assert.deepEqual(preSelecionarGarantia([], {}), { tipo: "personalizada", meses: 0 });
  assert.deepEqual(preSelecionarGarantia(garantiasPadraoVirtuais(), { garantia: true, tempo_garantia: 6 }), { tipo: "garantia", chave: "padrao:6" });
});

test("escolha vinda do state da navegação é conferida", () => {
  assert.ok(escolhaGarantiaValida({ garantia_id: null, nome: "X", meses: 3, texto: "t", tipo: "virtual" }));
  assert.ok(escolhaGarantiaValida({ garantia_id: "g", nome: "X", meses: 0, texto: null, tipo: "loja" }));
  for (const ruim of [null, undefined, "x", {}, { garantia_id: 1, nome: "X", meses: 3, texto: "t", tipo: "loja" },
    { garantia_id: null, nome: "", meses: 3, texto: "t", tipo: "loja" }, { garantia_id: null, nome: "X", meses: 121, texto: "t", tipo: "loja" },
    { garantia_id: null, nome: "X", meses: 3, texto: "t", tipo: "outro" }, { garantia_id: null, nome: "x".repeat(81), meses: 3, texto: "t", tipo: "loja" }]) {
    assert.equal(escolhaGarantiaValida(ruim), false, JSON.stringify(ruim));
  }
});

test("texto a congelar: só aparelho, com escolha nova, prazo > 0 e texto", () => {
  const e = { garantia_id: "g", nome: "G", meses: 3, texto: "T", tipo: "loja" as const };
  assert.equal(textoACongelar({ tipo: "dispositivo", garantia_escolhida: e }), "T");
  assert.equal(textoACongelar({ tipo: "dispositivo", garantia_escolhida: { ...e, meses: 0, texto: "TERMO SEM GARANTIA" } }), null);
  assert.equal(textoACongelar({ tipo: "dispositivo", garantia_escolhida: { ...e, texto: "  " } }), null);
  assert.equal(textoACongelar({ tipo: "dispositivo" }), null);
  assert.equal(textoACongelar({ tipo: "produto", garantia_escolhida: e }), null);
  assert.equal(textoACongelar({ tipo: "peca", garantia_escolhida: e }), null);
});

test("colunas da linha de vendas", () => {
  const e = { garantia_id: "g", nome: "G 6", meses: 6, texto: "T", tipo: "loja" as const };
  assert.deepEqual(camposGarantiaVenda({ tipo: "dispositivo", garantia_escolhida: e }, "tx"),
    { garantia_id: "g", garantia_nome: "G 6", garantia_meses: 6, garantia_texto_id: "tx", tempo_garantia: 6 });
  assert.deepEqual(camposGarantiaVenda({ tipo: "dispositivo", garantia_escolhida: e }, null),
    { garantia_id: "g", garantia_nome: "G 6", garantia_meses: 6, garantia_texto_id: null, tempo_garantia: 6 });
  assert.deepEqual(camposGarantiaVenda({ tipo: "dispositivo", garantia_escolhida: { ...e, meses: 0, garantia_id: "s", nome: "Sem garantia" } }, "tx"),
    { garantia_id: "s", garantia_nome: "Sem garantia", garantia_meses: 0, garantia_texto_id: null, tempo_garantia: null });
  assert.deepEqual(camposGarantiaVenda({ tipo: "dispositivo" }, "tx"), {});
  assert.deepEqual(camposGarantiaVenda({ tipo: "produto", garantia_escolhida: e }, "tx"), {});
});

test("freio do seletor da venda: fechado → só admin; liberado → todos; carregando → antigo", () => {
  assert.equal(MINHAS_GARANTIAS_LIBERADA, false);
  assert.equal(seletorGarantiaVendaVisivelPara({ isAdmin: true }), true);
  assert.equal(seletorGarantiaVendaVisivelPara({ isAdmin: false }), false);
  assert.equal(seletorGarantiaVendaVisivelPara({ isAdmin: undefined }), false);
  assert.equal(seletorGarantiaVendaVisivelPara({ isAdmin: false }, true), true);
});
