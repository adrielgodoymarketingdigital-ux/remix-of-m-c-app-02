// deno test -A --no-check src/lib/catalogo/navegacaoRadio.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { proximoIndiceRadio } from "./navegacaoRadio.ts";

test("setas andam e dão a volta; Home/End; outras teclas não navegam", () => {
  assert.equal(proximoIndiceRadio("ArrowRight", 0, 6), 1);
  assert.equal(proximoIndiceRadio("ArrowDown", 5, 6), 0);
  assert.equal(proximoIndiceRadio("ArrowLeft", 0, 6), 5);
  assert.equal(proximoIndiceRadio("ArrowUp", 3, 6), 2);
  assert.equal(proximoIndiceRadio("Home", 4, 6), 0);
  assert.equal(proximoIndiceRadio("End", 1, 6), 5);
  assert.equal(proximoIndiceRadio("Enter", 1, 6), null);
  assert.equal(proximoIndiceRadio("ArrowRight", -1, 6), 1); // nada escolhido: parte da primeira
  assert.equal(proximoIndiceRadio("ArrowRight", 0, 0), null);
});
