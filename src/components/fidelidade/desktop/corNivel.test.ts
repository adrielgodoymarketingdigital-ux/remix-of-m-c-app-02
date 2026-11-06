// node --test src/components/fidelidade/desktop/corNivel.test.ts
// Cor do chip de nível no computador: qualquer hex do lojista vira fundo
// translúcido + bolinha; valor inválido cai no visual neutro.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estiloChipNivel,
  normalizarCorNivel,
  OPACIDADE_BORDA_NIVEL,
  OPACIDADE_FUNDO_NIVEL,
} from "./corNivel.ts";

test("cores claras (amarelo, prata, branco) viram fundo translúcido e bolinha sólida", () => {
  for (const [entrada, hex] of [["#FFD700", "#ffd700"], ["#C0C0C0", "#c0c0c0"], ["#ffffff", "#ffffff"]]) {
    const estilo = estiloChipNivel(entrada);
    assert.equal(estilo.temCor, true);
    assert.deepEqual(estilo.ponto, { backgroundColor: hex });
    assert.equal(estilo.chip.backgroundColor, `color-mix(in srgb, ${hex} ${OPACIDADE_FUNDO_NIVEL}%, transparent)`);
    assert.equal(estilo.chip.borderColor, `color-mix(in srgb, ${hex} ${OPACIDADE_BORDA_NIVEL}%, transparent)`);
  }
});

test("cores escuras também funcionam (o texto nunca usa a cor do nível)", () => {
  for (const [entrada, hex] of [["#000000", "#000000"], ["#1E3A8A", "#1e3a8a"], ["#CD7F32", "#cd7f32"]]) {
    const estilo = estiloChipNivel(entrada);
    assert.equal(estilo.temCor, true);
    assert.deepEqual(estilo.ponto, { backgroundColor: hex });
    assert.equal("color" in estilo.chip, false);
  }
});

test("hex curto é expandido; sem # e com espaços também é aceito", () => {
  assert.equal(normalizarCorNivel("#fd0"), "#ffdd00");
  assert.equal(normalizarCorNivel("ABC"), "#aabbcc");
  assert.equal(normalizarCorNivel("  #12AB9f "), "#12ab9f");
  assert.equal(normalizarCorNivel("12ab9f"), "#12ab9f");
});

test("hex inválido ou incompleto cai no visual neutro", () => {
  for (const entrada of ["#12", "#1234", "#12345", "#1234567", "#12345678", "#ggg", "#gggggg", "amarelo", "red", "rgb(0,0,0)", "#fff; background:url(x)", "##ffffff"]) {
    assert.equal(normalizarCorNivel(entrada), null, entrada);
    assert.deepEqual(estiloChipNivel(entrada), { chip: {}, ponto: {}, temCor: false }, entrada);
  }
});

test("sem cor (null, undefined, vazio) cai no visual neutro", () => {
  for (const entrada of [null, undefined, "", "   "]) {
    assert.equal(normalizarCorNivel(entrada), null);
    assert.deepEqual(estiloChipNivel(entrada), { chip: {}, ponto: {}, temCor: false });
  }
});
