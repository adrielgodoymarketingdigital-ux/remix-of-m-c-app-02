// deno test -A --no-check src/lib/catalogo/iconeCategoria.test.ts
// Ícone das categorias do Catálogo: lista fechada + escolha pelo nome (pasta como reserva).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ehIconeValido,
  ICONE_RESERVA,
  ICONES_CATEGORIA,
  iconeDaCategoria,
  sugerirIconePorNome,
} from "./iconeCategoria.ts";

test("lista fechada sem repetidos, com a pasta como reserva", () => {
  assert.equal(new Set(ICONES_CATEGORIA).size, ICONES_CATEGORIA.length);
  assert.equal(ICONE_RESERVA, "folder");
  assert.equal(ICONES_CATEGORIA.includes(ICONE_RESERVA), true);
});

test("ehIconeValido aceita só nomes da lista", () => {
  assert.equal(ehIconeValido("cable"), true);
  assert.equal(ehIconeValido("Cable"), false);
  assert.equal(ehIconeValido("skull"), false);
  assert.equal(ehIconeValido(""), false);
  assert.equal(ehIconeValido(null), false);
  assert.equal(ehIconeValido(42), false);
});

test("categorias do desenho recebem o ícone esperado", () => {
  assert.equal(sugerirIconePorNome("Acessórios"), "headphones");
  assert.equal(sugerirIconePorNome("Cabos"), "cable");
  assert.equal(sugerirIconePorNome("Carregadores"), "battery-charging");
  assert.equal(sugerirIconePorNome("Capas"), "smartphone");
  assert.equal(sugerirIconePorNome("Películas"), "shield");
  assert.equal(sugerirIconePorNome("Eletrônicos"), "monitor");
});

test("acento, caixa e plural não atrapalham", () => {
  assert.equal(sugerirIconePorNome("PELÍCULA 3D"), "shield");
  assert.equal(sugerirIconePorNome("capinhas"), "smartphone");
  assert.equal(sugerirIconePorNome("Relógios"), "watch");
  assert.equal(sugerirIconePorNome("Peças"), "wrench");
  assert.equal(sugerirIconePorNome("  fones de ouvido "), "headphones");
});

test("espanhol", () => {
  assert.equal(sugerirIconePorNome("Fundas"), "smartphone");
  assert.equal(sugerirIconePorNome("Cargadores"), "battery-charging");
  assert.equal(sugerirIconePorNome("Auriculares"), "headphones");
  assert.equal(sugerirIconePorNome("Repuestos"), "wrench");
  assert.equal(sugerirIconePorNome("Protectores de pantalla"), "shield");
  assert.equal(sugerirIconePorNome("Relojes"), "watch");
});

test("a primeira palavra que combina decide", () => {
  assert.equal(sugerirIconePorNome("Cabo de carregador"), "cable");
  assert.equal(sugerirIconePorNome("Carregadores e cabos"), "battery-charging");
  assert.equal(sugerirIconePorNome("Kit película + capa"), "gift");
});

test("palavras curtas só valem inteiras", () => {
  assert.equal(sugerirIconePorNome("Case"), "smartphone");
  assert.equal(sugerirIconePorNome("Caixa de som"), "speaker");
  assert.equal(sugerirIconePorNome("TV Box"), "monitor");
  assert.equal(sugerirIconePorNome("Casemiro"), ICONE_RESERVA); // não é "case"
  assert.equal(sugerirIconePorNome("Sombra"), ICONE_RESERVA); // não é "som"
});

test("sem combinação, vazio ou nulo → pasta", () => {
  assert.equal(sugerirIconePorNome("Diversos"), ICONE_RESERVA);
  assert.equal(sugerirIconePorNome(""), ICONE_RESERVA);
  assert.equal(sugerirIconePorNome(null), ICONE_RESERVA);
  assert.equal(sugerirIconePorNome(undefined), ICONE_RESERVA);
  assert.equal(sugerirIconePorNome("!!! ???"), ICONE_RESERVA);
});

test("iconeDaCategoria: salvo e válido vence o nome", () => {
  assert.equal(iconeDaCategoria({ nome: "Cabos", icone: "gift" }), "gift");
});

test("iconeDaCategoria: categoria antiga sem ícone ou com valor inválido usa o nome", () => {
  assert.equal(iconeDaCategoria({ nome: "Cabos" }), "cable");
  assert.equal(iconeDaCategoria({ nome: "Cabos", icone: null }), "cable");
  assert.equal(iconeDaCategoria({ nome: "Cabos", icone: "nao-existe" }), "cable");
  assert.equal(iconeDaCategoria({ nome: "Diversos", icone: "" }), ICONE_RESERVA);
  assert.equal(iconeDaCategoria({}), ICONE_RESERVA);
});

test("toda sugestão está na lista fechada", () => {
  const nomes = ["Acessórios", "Cabos", "Games", "Câmeras", "Placas", "Promoções", "Novidades", "Notebooks", "Tablets", "Tomadas", "x"];
  for (const n of nomes) assert.equal(ehIconeValido(sugerirIconePorNome(n)), true, n);
});
