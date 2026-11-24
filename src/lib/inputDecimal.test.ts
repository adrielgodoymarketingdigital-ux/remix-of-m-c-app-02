// deno test -A --no-check src/lib/inputDecimal.test.ts
// Campo de valor no celular: vírgula não pode zerar o campo.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mensagemForaDaFaixa,
  normalizarTextoDecimal,
  parseTextoDecimal,
  sanitizarTextoDecimal,
  textoDoValorExterno,
  textoRepresentaValor,
} from "./inputDecimal.ts";

/** Simula o campo: tecla a tecla, como o onChange do componente faz. */
function digitar(teclas: string, casasDecimais?: number): string {
  let texto = "";
  for (const t of teclas) texto = sanitizarTextoDecimal(texto + t, { casasDecimais });
  return texto;
}
const colar = (s: string, casasDecimais?: number) =>
  sanitizarTextoDecimal(s, { colado: true, casasDecimais });

test('"39,50" vira "39.50"', () => {
  assert.equal(digitar("39,50"), "39,50");
  assert.equal(normalizarTextoDecimal(digitar("39,50")), "39.50");
  assert.equal(parseTextoDecimal("39,50"), 39.5);
});

test('"39," mantém o texto; emite "39." e o parse dá 39', () => {
  const texto = digitar("39,");
  assert.equal(texto, "39,");
  assert.equal(normalizarTextoDecimal(texto), "39.");
  assert.equal(parseFloat(normalizarTextoDecimal(texto)), 39);
  assert.equal(parseTextoDecimal(texto), 39);
  // o pai guarda "39." (ou 39): o texto "39," não é trocado
  assert.equal(textoRepresentaValor(texto, "39."), true);
  assert.equal(textoRepresentaValor(texto, 39), true);
});

test('"39.5" com ponto também funciona', () => {
  assert.equal(digitar("39.5"), "39.5");
  assert.equal(normalizarTextoDecimal("39.5"), "39.5");
});

test('"0,05"', () => {
  assert.equal(normalizarTextoDecimal(digitar("0,05")), "0.05");
  assert.equal(parseTextoDecimal("0,05"), 0.05);
});

test('",5" vira "0.5"', () => {
  assert.equal(digitar(",5"), ",5");
  assert.equal(normalizarTextoDecimal(",5"), "0.5");
});

test('"1.234,56": colado entende milhar; digitado tecla a tecla vira "1.23"', () => {
  assert.equal(normalizarTextoDecimal(colar("1.234,56")), "1234.56");
  assert.equal(normalizarTextoDecimal(colar("1,234.56")), "1234.56");
  assert.equal(normalizarTextoDecimal(colar("1.234.567")), "1234567");
  assert.equal(normalizarTextoDecimal(colar("1.500")), "1500");
  assert.equal(normalizarTextoDecimal(colar("1,500")), "1.50");
  // comportamento documentado: o primeiro separador digitado é o decimal
  assert.equal(digitar("1.234,56"), "1.23");
});

test("letras e símbolos são ignorados", () => {
  assert.equal(digitar("3a9b,c5%0"), "39,50");
  assert.equal(digitar("-10"), "10");
  assert.equal(digitar("abc"), "");
});

test("duas vírgulas: a segunda é ignorada", () => {
  assert.equal(digitar("39,,5"), "39,5");
  assert.equal(digitar("39,5,0"), "39,50");
  assert.equal(digitar("39,5.0"), "39,50");
});

test("3 casas decimais são cortadas para 2; casasDecimais configurável", () => {
  assert.equal(digitar("39,505"), "39,50");
  assert.equal(digitar("2,555", 3), "2,555");
  assert.equal(digitar("2,55", 1), "2,5");
  assert.equal(digitar("12,5", 0), "125");
});

test('vazio continua "" (não 0)', () => {
  assert.equal(sanitizarTextoDecimal(""), "");
  assert.equal(normalizarTextoDecimal(""), "");
  assert.equal(parseTextoDecimal(""), null);
  assert.equal(textoDoValorExterno(""), "");
  assert.equal(textoDoValorExterno(null), "");
  assert.equal(textoDoValorExterno(undefined), "");
  assert.equal(textoDoValorExterno(Number.NaN), "");
});

test('colar "R$ 39,50" vira "39.50"', () => {
  assert.equal(colar("R$ 39,50"), "39,50");
  assert.equal(normalizarTextoDecimal(colar("R$ 39,50")), "39.50");
  assert.equal(normalizarTextoDecimal(colar("R$ 1.234,56")), "1234.56");
});

test("valor externo (number/string do formulário) vira texto", () => {
  assert.equal(textoDoValorExterno(39.5), "39.5");
  assert.equal(textoDoValorExterno(0), "0");
  assert.equal(textoDoValorExterno("150.00"), "150.00");
  assert.equal(textoDoValorExterno(150), "150");
});

test("re-sincroniza quando o valor de fora muda de verdade", () => {
  assert.equal(textoRepresentaValor("39,5", 39.5), true);
  assert.equal(textoRepresentaValor("39,5", "39.50"), true);
  assert.equal(textoRepresentaValor("39,5", 10), false); // edição de outro item
  assert.equal(textoRepresentaValor("39,5", ""), false); // reset do formulário
  assert.equal(textoRepresentaValor("39,5", null), false);
  // apagar o campo quando o pai guarda `Number(v) || 0` não traz o 0 de volta
  assert.equal(textoRepresentaValor("", 0), true);
});

test("min/max: mesma faixa do type=number", () => {
  assert.equal(mensagemForaDaFaixa("", 0, 100), "");
  assert.equal(mensagemForaDaFaixa("50", 0, 100), "");
  assert.notEqual(mensagemForaDaFaixa("150", 0, 100), "");
  assert.notEqual(mensagemForaDaFaixa("0", "0.01"), "");
  assert.equal(mensagemForaDaFaixa("0,01", "0.01"), "");
  assert.equal(mensagemForaDaFaixa("5", undefined, undefined), "");
});
