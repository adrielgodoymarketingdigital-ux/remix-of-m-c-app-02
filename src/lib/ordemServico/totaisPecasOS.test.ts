// deno test -A --no-check src/lib/ordemServico/totaisPecasOS.test.ts
// Valor da linha de produto/peça na impressão da OS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { valorLinhaProduto } from "./totaisPecasOS.ts";

test("preco_total normal é o valor da linha", () => {
  assert.equal(valorLinhaProduto({ quantidade: 2, preco_unitario: 50, preco_total: 100 }), 100);
  assert.equal(valorLinhaProduto({ quantidade: 1, preco_unitario: 10, preco_total: "35.5" }), 35.5);
});

test("preco_total ausente ou null usa quantidade × unitário", () => {
  assert.equal(valorLinhaProduto({ quantidade: 3, preco_unitario: 20 }), 60);
  assert.equal(valorLinhaProduto({ quantidade: 3, preco_unitario: 20, preco_total: null }), 60);
  assert.equal(valorLinhaProduto({ quantidade: "2", preco_unitario: "12.5", preco_total: undefined }), 25);
});

test("preco_total 0 (dado antigo) usa o unitário", () => {
  assert.equal(valorLinhaProduto({ quantidade: 2, preco_unitario: 40, preco_total: 0 }), 80);
  assert.equal(valorLinhaProduto({ quantidade: 2, preco_unitario: 40, preco_total: "" }), 80);
});

test("NaN em qualquer campo nunca vira NaN", () => {
  assert.equal(valorLinhaProduto({ quantidade: 2, preco_unitario: 40, preco_total: NaN }), 80);
  assert.equal(valorLinhaProduto({ quantidade: 2, preco_unitario: NaN, preco_total: NaN }), 0);
  assert.equal(valorLinhaProduto({ quantidade: 2, preco_unitario: "abc", preco_total: "xyz" }), 0);
  assert.equal(valorLinhaProduto({ quantidade: NaN, preco_unitario: 15, preco_total: 0 }), 15);
  assert.equal(valorLinhaProduto({ preco_total: Infinity, preco_unitario: 5, quantidade: 1 }), 5);
});

test("sem nada aproveitável = 0", () => {
  assert.equal(valorLinhaProduto({}), 0);
  assert.equal(valorLinhaProduto(null), 0);
  assert.equal(valorLinhaProduto(undefined), 0);
  assert.equal(valorLinhaProduto({ quantidade: 2, preco_unitario: 0, preco_total: 0 }), 0);
});

test("quantidade decimal", () => {
  assert.equal(valorLinhaProduto({ quantidade: 1.5, preco_unitario: 10, preco_total: 15 }), 15);
  assert.equal(valorLinhaProduto({ quantidade: 0.25, preco_unitario: 80, preco_total: null }), 20);
  assert.equal(valorLinhaProduto({ quantidade: "2.5", preco_unitario: "4", preco_total: 0 }), 10);
});

test("preço editado na OS: vale o valor gravado na OS, não o do cadastro", () => {
  const editado = { quantidade: 2, preco_unitario: 70, preco_total: 140, preco_cadastro: 100, preco_editado: true };
  assert.equal(valorLinhaProduto(editado), 140);
  // dado antigo editado sem preco_total: usa o unitário editado, nunca o cadastro
  assert.equal(valorLinhaProduto({ ...editado, preco_total: 0 }), 140);
});
