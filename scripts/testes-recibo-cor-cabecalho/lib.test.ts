// node --test scripts/testes-recibo-cor-cabecalho/
// Cor do cabeçalho dos recibos: validação, leitura da loja, contraste, degradê
// e destaque (src/lib/recibo/corCabecalhoRecibo.ts). Dados fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTRASTE_MINIMO_ACENTO,
  TEXTO_CLARO,
  TEXTO_ESCURO,
  contraste,
  corCabecalhoDaLoja,
  escurecer,
  normalizarCorHex,
  paletaCabecalhoRecibo,
} from "../../src/lib/recibo/corCabecalhoRecibo.ts";

// Primeira cor de cada paleta da tela de Cores (PersonalizacaoCores.tsx).
const PALETAS = ["#1e40af", "#1e3a8a", "#172554", "#312e81", "#064e3b", "#14532d", "#581c87", "#4c1d95", "#c2410c", "#991b1b", "#134e4a", "#155e75", "#1f2937", "#1e293b"];

test("hex válido: #rrggbb e #rgb, maiúsculas, espaços nas pontas → #rrggbb minúsculo", () => {
  assert.equal(normalizarCorHex("#1D4ED8"), "#1d4ed8");
  assert.equal(normalizarCorHex(" #abc "), "#aabbcc");
  assert.equal(normalizarCorHex("#000000"), "#000000");
});

test("hex inválido → null (azul padrão)", () => {
  for (const v of ["azul", "#12", "#1234", "#12345", "#1234567", "1d4ed8", "#gggggg", "rgb(0,0,0)", "", " ", null, undefined, 123, {}, [], true, "#1d4ed8;color:red", "#1d4ed8 !important"]) {
    assert.equal(normalizarCorHex(v), null, `aceitou: ${JSON.stringify(v)}`);
  }
});

test("cor da loja: só recibo_cabecalho_cor válido; o resto vira null", () => {
  assert.equal(corCabecalhoDaLoja({ cores_personalizadas: { recibo_cabecalho_cor: "#7F1D1D", tracking_config: {} } }), "#7f1d1d");
  for (const loja of [null, undefined, "loja", 1, {}, { cores_personalizadas: null }, { cores_personalizadas: [] }, { cores_personalizadas: "x" }, { cores_personalizadas: {} },
    { cores_personalizadas: { primary_from: "#ff0000" } }, { cores_personalizadas: { recibo_cabecalho_cor: "azul" } }, { cores_personalizadas: { recibo_cabecalho_cor: null } }]) {
    assert.equal(corCabecalhoDaLoja(loja), null, JSON.stringify(loja));
  }
});

test("erro ao ler a loja (getter que lança) → null, nunca lança", () => {
  const lojaQueLanca = Object.defineProperty({}, "cores_personalizadas", { get() { throw new Error("falha simulada"); } });
  assert.equal(corCabecalhoDaLoja(lojaQueLanca), null);
  const coresQueLancam = { cores_personalizadas: Object.defineProperty({}, "recibo_cabecalho_cor", { get() { throw new Error("falha"); } }) };
  assert.equal(corCabecalhoDaLoja(coresQueLancam), null);
});

test("degradê: a cor escolhida até um tom 15% mais escuro", () => {
  assert.equal(escurecer("#ffffff", 0.15), "#d9d9d9");
  assert.equal(escurecer("#7f1d1d", 0.15), "#6c1919");
  const p = paletaCabecalhoRecibo("#7f1d1d");
  assert.equal(p.fundo, "#7f1d1d");
  assert.equal(p.fundo2, "#6c1919");
});

test("contraste: cor escura → texto branco; cor clara → texto escuro", () => {
  for (const c of ["#7f1d1d", "#000000", "#0a1a3f", ...PALETAS]) assert.equal(paletaCabecalhoRecibo(c).texto, TEXTO_CLARO, c);
  for (const c of ["#fde68a", "#ffffff", "#fef08a", "#a7f3d0", "#bae6fd", "#f5f5f5", "#facc15"]) assert.equal(paletaCabecalhoRecibo(c).texto, TEXTO_ESCURO, c);
});

test("texto do cabeçalho legível: >= 4,5 nas paletas e >= 3,6 em qualquer cor (pior ponta do degradê)", () => {
  const pior = (c: string) => {
    const p = paletaCabecalhoRecibo(c);
    return Math.min(contraste(p.texto, p.fundo), contraste(p.texto, p.fundo2));
  };
  for (const c of PALETAS) assert.ok(pior(c) >= 4.5, `${c}: ${pior(c)}`);
  let menor = 99;
  for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) {
    const c = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
    menor = Math.min(menor, pior(c));
  }
  // Tons médios saturados (ex.: #ff3311, #ee11dd) ficam em ~3,66: nem branco nem escuro passam de 4,5.
  assert.ok(menor >= 3.6, `menor contraste: ${menor}`);
});

test("destaque (número da OS, ícones, onda): contraste >= 3 sobre o degradê e derivado da cor", () => {
  for (let r = 0; r < 256; r += 51) for (let g = 0; g < 256; g += 51) for (let b = 0; b < 256; b += 51) {
    const c = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
    const p = paletaCabecalhoRecibo(c);
    assert.ok(Math.min(contraste(p.acento, p.fundo), contraste(p.acento, p.fundo2)) >= CONTRASTE_MINIMO_ACENTO, `${c} → ${p.acento}`);
  }
  // Cor escura: tom CLARO derivado (nem branco puro nem a própria cor).
  const escura = paletaCabecalhoRecibo("#7f1d1d");
  assert.notEqual(escura.acento, TEXTO_CLARO);
  assert.ok(contraste(escura.acento, "#000000") > contraste("#7f1d1d", "#000000"));
  // Cor clara: tom ESCURO derivado.
  const clara = paletaCabecalhoRecibo("#fde68a");
  assert.notEqual(clara.acento, TEXTO_ESCURO);
  assert.ok(contraste(clara.acento, "#ffffff") > contraste("#fde68a", "#ffffff"));
});

test("paleta com cor inválida lança (quem chama valida antes)", () => {
  assert.throws(() => paletaCabecalhoRecibo("azul"));
});
