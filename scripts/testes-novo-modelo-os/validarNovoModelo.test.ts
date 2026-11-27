// deno test --no-check --allow-read=src --config scripts/testes-novo-modelo-os/deno.json scripts/testes-novo-modelo-os/
// "+ Adicionar novo modelo" no seletor de modelo da OS: validarNovoModelo
// contra o catálogo FIXO (src/data/catalogoDispositivos) + os da loja. Sem rede.
import { assertEquals } from "jsr:@std/assert@1";
import { validarNovoModelo, limparNomeModelo } from "../../src/lib/ordemServico/novoModeloCatalogo.ts";
import { getModelosPorMarca } from "../../src/data/catalogoDispositivos.ts";

const fixosApple = getModelosPorMarca("celular", "Apple");
const fixosIpad = getModelosPorMarca("tablet", "Apple");
const daLoja = ["Galaxy Ção Especial", "Moto Rápido"];
const existentes = [...fixosApple, ...daLoja];

Deno.test("catálogo fixo usado no teste existe (senão os testes de duplicado não provam nada)", () => {
  assertEquals(fixosApple.includes("iPhone 13 Pro Max"), true);
  assertEquals(fixosIpad.includes("iPad (7ª geração)"), true);
});

Deno.test("vazio e só espaços → vazio", () => {
  assertEquals(validarNovoModelo("", existentes), { ok: false, motivo: "vazio" });
  assertEquals(validarNovoModelo("   \t  ", existentes), { ok: false, motivo: "vazio" });
});

Deno.test("1 caractere → curto; 2 caracteres → ok", () => {
  assertEquals(validarNovoModelo("X", existentes), { ok: false, motivo: "curto" });
  assertEquals(validarNovoModelo("  X  ", existentes), { ok: false, motivo: "curto" });
  assertEquals(validarNovoModelo("X9", existentes), { ok: true, nome: "X9" });
});

Deno.test("61 caracteres → longo; 60 → ok (conta depois de limpar os espaços)", () => {
  assertEquals(validarNovoModelo("a".repeat(61), existentes), { ok: false, motivo: "longo" });
  assertEquals(validarNovoModelo("a".repeat(60), existentes), { ok: true, nome: "a".repeat(60) });
  // 60 letras + espaços nas pontas e um duplo no meio continuam válidas
  const comEspacos = `   ${"b".repeat(30)}  ${"c".repeat(29)}   `;
  assertEquals(validarNovoModelo(comEspacos, existentes), { ok: true, nome: `${"b".repeat(30)} ${"c".repeat(29)}` });
});

Deno.test("espaços extras: trim e espaços repetidos viram um", () => {
  assertEquals(limparNomeModelo("  iPhone   17   Air  "), "iPhone 17 Air");
  assertEquals(validarNovoModelo("  Galaxy   Z   Fold  ", existentes), { ok: true, nome: "Galaxy Z Fold" });
});

Deno.test("duplicado contra o catálogo FIXO, com maiúscula/espaço diferente → devolve o existente", () => {
  assertEquals(validarNovoModelo("iphone 13 pro max", existentes), { ok: false, motivo: "duplicado", existente: "iPhone 13 Pro Max" });
  assertEquals(validarNovoModelo("  IPHONE   13  PRO MAX ", existentes), { ok: false, motivo: "duplicado", existente: "iPhone 13 Pro Max" });
});

Deno.test("duplicado contra o catálogo FIXO com acento diferente", () => {
  assertEquals(validarNovoModelo("ipad (7a geracao)", fixosIpad).ok, true); // "ª" ≠ "a": não é o mesmo texto
  assertEquals(validarNovoModelo("IPAD (7ª GERAÇAO)", fixosIpad), { ok: false, motivo: "duplicado", existente: "iPad (7ª geração)" });
  assertEquals(validarNovoModelo("iPhóne 13", existentes), { ok: false, motivo: "duplicado", existente: "iPhone 13" });
});

Deno.test("duplicado contra o catálogo da LOJA, com maiúscula/acento diferente", () => {
  assertEquals(validarNovoModelo("galaxy cao especial", existentes), { ok: false, motivo: "duplicado", existente: "Galaxy Ção Especial" });
  assertEquals(validarNovoModelo("MOTO RAPIDO", existentes), { ok: false, motivo: "duplicado", existente: "Moto Rápido" });
});

Deno.test("nome novo válido não bate com parecido (prefixo não é duplicado)", () => {
  assertEquals(validarNovoModelo("iPhone 13 Pro Max 2", existentes), { ok: true, nome: "iPhone 13 Pro Max 2" });
  assertEquals(validarNovoModelo("Moto Rápido Plus", existentes), { ok: true, nome: "Moto Rápido Plus" });
  assertEquals(validarNovoModelo("Redmi Note 99", []), { ok: true, nome: "Redmi Note 99" });
});
