// TZ=UTC deno test --no-check scripts/testes-imei/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-imei/
// Roda as funções reais de src/lib/codigos/imei.ts e src/lib/ocr/preprocessamento.ts
// (leitor de IMEI/série por código de barras e por OCR). Só IMEIs SINTÉTICOS,
// gerados aqui com o dígito Luhn — nunca IMEIs reais de clientes.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  avisoImeiDigitado,
  confirmarEntreQuadros,
  decidirLeituraOcr,
  extrairImeis,
  extrairSeries,
  serieValida,
  validarImei,
} from "../../src/lib/codigos/imei.ts";
import { escalaParaOcr, limiarOtsu, preprocessarPixels } from "../../src/lib/ocr/preprocessamento.ts";

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

/** IMEI sintético: 14 dígitos + dígito Luhn. */
function comLuhn(base14: string): string {
  let soma = 0;
  for (let i = 0; i < 14; i++) {
    let d = Number(base14[13 - i]);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    soma += d;
  }
  return base14 + ((10 - (soma % 10)) % 10);
}
const A = comLuhn("35000011112222"); // sintético
const B = comLuhn("35000011113333"); // sintético
const errarUltimo = (i: string) => i.slice(0, 14) + ((Number(i[14]) + 1) % 10);

Deno.test("validarImei: Luhn válido e inválido, 15 dígitos", () => {
  assert(validarImei(A));
  assert(validarImei(B));
  assert(!validarImei(errarUltimo(A)), "dígito verificador errado");
  assert(!validarImei(A.slice(0, 14)), "14 dígitos");
  assert(!validarImei(A + "0"), "16 dígitos");
  assert(validarImei(`${A.slice(0, 2)} ${A.slice(2, 8)} ${A.slice(8, 14)} ${A[14]}`), "com espaços");
  assert(!validarImei("abc"));
  assert(!validarImei(null));
});

Deno.test("extrairImeis: prefixos IMEI, IMEI1:, IMEI 2", () => {
  assertEquals(extrairImeis(`IMEI ${A}`), [A]);
  assertEquals(extrairImeis(`IMEI1: ${A}\nIMEI2: ${B}`), [A, B]);
  assertEquals(extrairImeis(`IMEI 1 ${A} IMEI 2 ${B}`), [A, B]);
  assertEquals(extrairImeis(`imei:${A}`), [A]);
});

Deno.test("extrairImeis: grupos com espaço, hífen ou barra", () => {
  const g = (sep: string) => [A.slice(0, 2), A.slice(2, 8), A.slice(8, 14), A[14]].join(sep);
  assertEquals(extrairImeis(g(" ")), [A]);
  assertEquals(extrairImeis(g("-")), [A]);
  assertEquals(extrairImeis(g("/")), [A]);
  assertEquals(extrairImeis(`IMEI: ${g(" ")}`), [A]);
});

Deno.test("extrairImeis: QR com IMEI1+IMEI2 colados no texto, sem repetidos, na ordem", () => {
  assertEquals(extrairImeis(`IMEI1:${A}IMEI2:${B}`), [A, B]);
  assertEquals(extrairImeis(`MODEL:SM-X;SN:R58T12;IMEI1:${B};IMEI2:${A};IMEI1:${B}`), [B, A]);
  assertEquals(extrairImeis(`${A} ${B}`), [A, B], "dois IMEIs na mesma linha");
  assertEquals(extrairImeis(`${A}\n${B}`), [A, B]);
});

Deno.test("extrairImeis: recusa 14 e 16 dígitos soltos e 15 dentro de número maior", () => {
  assertEquals(extrairImeis(A.slice(0, 14)), []);
  assertEquals(extrairImeis(A + "7"), [], "16 dígitos");
  assertEquals(extrairImeis("9" + A), [], "15 dígitos dentro de um número de 16");
  assertEquals(extrairImeis(A + B), [], "30 dígitos colados");
  assertEquals(extrairImeis(errarUltimo(A)), [], "Luhn inválido");
  assertEquals(extrairImeis("7891234567895"), [], "EAN-13");
});

Deno.test("extrairImeis: ruído comum de OCR já normalizado (espaço no meio, quebra de linha)", () => {
  assertEquals(extrairImeis(`${A.slice(0, 7)} ${A.slice(7)}`), [A]);
  assertEquals(extrairImeis(`${A.slice(0, 9)}\n${A.slice(9)}`), [A]);
  assertEquals(extrairImeis(`  IMEI   ${A.slice(0, 8)}  ${A.slice(8)}  `), [A]);
  assertEquals(extrairImeis(""), []);
  assertEquals(extrairImeis(null), []);
});

Deno.test("serieValida: alfanumérico 5–20, maiúsculas, sem espaço/hífen", () => {
  assertEquals(serieValida("f2lx-9kq1 abc"), "F2LX9KQ1ABC");
  assertEquals(serieValida("R58T12"), "R58T12");
  assertEquals(serieValida("ZY22/AB"), "ZY22AB");
  assertEquals(serieValida("AB12"), null, "4 caracteres");
  assertEquals(serieValida("A".repeat(21)), null, "21 caracteres");
  assertEquals(serieValida("SN#1234"), null, "símbolo");
});

Deno.test("serieValida: recusa IMEI (15 dígitos Luhn) e EAN-13 válido", () => {
  assertEquals(serieValida(A), null);
  assertEquals(serieValida(errarUltimo(A)), errarUltimo(A), "15 dígitos sem Luhn pode ser série");
  assertEquals(serieValida("7891234567895"), null, "EAN-13 com dígito válido");
  assertEquals(serieValida("7891234567890"), "7891234567890", "13 dígitos com verificador EAN inválido");
});

Deno.test("extrairSeries (OCR): palavras válidas com dígito, sem rótulos", () => {
  assertEquals(extrairSeries("Número de série: F2LX9KQ1ABC"), ["F2LX9KQ1ABC"]);
  assertEquals(extrairSeries(`SERIAL R58T12 IMEI ${A}`), ["R58T12"]);
  assertEquals(extrairSeries("MODELO SERIE NUMERO"), []);
});

Deno.test("confirmarEntreQuadros: só vale o que se repetiu em 2 quadros seguidos", () => {
  assertEquals(confirmarEntreQuadros([], [A]), []);
  assertEquals(confirmarEntreQuadros([A], [A]), [A]);
  assertEquals(confirmarEntreQuadros([A], [B]), []);
  assertEquals(confirmarEntreQuadros([A, B], [B, A]), [B, A]);
  assertEquals(confirmarEntreQuadros([A, B], [A]), [A]);
  assertEquals(confirmarEntreQuadros([A], [A, A]), [A]);
});

Deno.test("pré-processamento: binariza por Otsu; fundo escuro é invertido (texto preto, fundo branco)", () => {
  // 10x10: 90% fundo escuro (20) e 10% texto claro (200), com ruído leve
  const montar = (fundo: number, texto: number) => {
    const px = new Uint8ClampedArray(100 * 4);
    for (let i = 0; i < 100; i++) {
      const ruido = ((i * 37) % 9) - 4;
      const v = (i % 10 === 5 ? texto : fundo) + ruido;
      px.set([v, v, v, 255], i * 4);
    }
    return px;
  };
  const escuro = montar(20, 200);
  const r1 = preprocessarPixels(escuro, 10, 10);
  assertEquals(r1.invertido, true);
  assertEquals([escuro[0], escuro[5 * 4]], [255, 0], "fundo branco, texto preto");
  const claro = montar(235, 40);
  const r2 = preprocessarPixels(claro, 10, 10);
  assertEquals(r2.invertido, false);
  assertEquals([claro[0], claro[5 * 4]], [255, 0]);
  // Só 2 valores na saída (binário)
  assertEquals(new Set(Array.from(claro).filter((_, i) => i % 4 === 0)).size, 2);
});

Deno.test("Otsu: limiar entre as duas populações", () => {
  const h = new Array(256).fill(0); h[30] = 50; h[220] = 450;
  const l = limiarOtsu(h, 500);
  assert(l >= 30 && l < 220, `limiar ${l}`);
});

Deno.test("escala do recorte: amplia até 3×, nunca reduz", () => {
  assertEquals(escalaParaOcr(400), 3);
  assertEquals(escalaParaOcr(600), 2);
  assertEquals(escalaParaOcr(1600), 1);
  assertEquals(escalaParaOcr(0), 1);
});

Deno.test("aviso do IMEI digitado: só 15 dígitos com Luhn errado; não bloqueia nada", () => {
  assertEquals(avisoImeiDigitado(A), null);
  assertEquals(avisoImeiDigitado(errarUltimo(A)), "IMEI inválido, confira");
  assertEquals(avisoImeiDigitado(`${A.slice(0, 7)} ${errarUltimo(A).slice(7)}`), "IMEI inválido, confira");
  assertEquals(avisoImeiDigitado(A.slice(0, 10)), null, "ainda digitando");
  assertEquals(avisoImeiDigitado(""), null);
  assertEquals(avisoImeiDigitado(null), null);
});

Deno.test("decisão do OCR: 1 IMEI confirmado grava; 2 na tela nunca escolhe sozinho", () => {
  assertEquals(decidirLeituraOcr([], [A]), { acao: "continuar" }, "primeiro quadro");
  assertEquals(decidirLeituraOcr([A], [A]), { acao: "aceitar", valor: A });
  // Tela *#06# com os dois: só um confirmado ainda → continua (não grava o IMEI 2 no campo IMEI)
  assertEquals(decidirLeituraOcr([B], [A, B]), { acao: "continuar" });
  assertEquals(decidirLeituraOcr([A, B], [A, B]), { acao: "escolher", opcoes: [A, B] });
  assertEquals(decidirLeituraOcr([A], [B]), { acao: "continuar" });
});

Deno.test("decisão do OCR: série (sem dígito verificador) sempre pede confirmação", () => {
  assertEquals(decidirLeituraOcr(["F2LX9KQ1"], ["F2LX9KQ1"], true), { acao: "escolher", opcoes: ["F2LX9KQ1"] });
  assertEquals(decidirLeituraOcr([], ["F2LX9KQ1"], true), { acao: "continuar" });
});
