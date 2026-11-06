// deno test --no-check scripts/testes-fornecedores-layout/
// Nomes totalmente fictícios.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  avatarFornecedor,
  CORES_AVATAR_FORNECEDOR,
  iniciaisFornecedor,
  indiceCorAvatar,
} from "../../src/components/fornecedores/avatarFornecedor.ts";

Deno.test("nome vazio, só espaços ou ausente vira ?", () => {
  assertEquals(iniciaisFornecedor(""), "?");
  assertEquals(iniciaisFornecedor("   "), "?");
  assertEquals(iniciaisFornecedor(null), "?");
  assertEquals(iniciaisFornecedor(undefined), "?");
});

Deno.test("uma palavra usa as duas primeiras letras", () => {
  assertEquals(iniciaisFornecedor("zelotron"), "ZE");
  assertEquals(iniciaisFornecedor("Q"), "Q");
});

Deno.test("várias palavras usam a primeira e a última, ignorando conectivos", () => {
  assertEquals(iniciaisFornecedor("Peças Fictícias do Norte"), "PN");
  assertEquals(iniciaisFornecedor("ALFA BETA DE GAMA"), "AG");
  assertEquals(iniciaisFornecedor("  loja   xis  "), "LX");
  assertEquals(iniciaisFornecedor("de da do"), "DD");
});

Deno.test("acentos são mantidos e ficam maiúsculos", () => {
  assertEquals(iniciaisFornecedor("élio ômega"), "ÉÔ");
  assertEquals(iniciaisFornecedor("ágata"), "ÁG");
});

Deno.test("emoji e símbolos são ignorados", () => {
  assertEquals(iniciaisFornecedor("🔧 Oficina Teste"), "OT");
  assertEquals(iniciaisFornecedor("Teste🚀Peças"), "TE");
  assertEquals(iniciaisFornecedor("🔧🚀"), "?");
  assertEquals(iniciaisFornecedor("--- & ---"), "?");
});

Deno.test("números contam como inicial", () => {
  assertEquals(iniciaisFornecedor("3 Irmãos Ficção"), "3F");
});

Deno.test("cor é determinística e dentro da paleta", () => {
  const chaves = ["", "a", "11111111-1111-4111-8111-111111111111", "😀", "Fornecedor Fictício"];
  for (const k of chaves) {
    const i = indiceCorAvatar(k);
    assertEquals(i, indiceCorAvatar(k));
    assert(i >= 0 && i < CORES_AVATAR_FORNECEDOR.length);
  }
  assertEquals(indiceCorAvatar(null), indiceCorAvatar(""));
});

Deno.test("chaves diferentes espalham pela paleta", () => {
  const usadas = new Set(Array.from({ length: 64 }, (_, i) => indiceCorAvatar(`id-${i}`)));
  assert(usadas.size >= 5);
});

Deno.test("avatarFornecedor usa o ID para a cor e o nome como reserva", () => {
  const a = avatarFornecedor("id-1", "Nome Um");
  const b = avatarFornecedor("id-1", "Outro Nome");
  assertEquals(a.classes, b.classes);
  assertEquals(a.iniciais, "NU");
  assertEquals(avatarFornecedor("", "Nome Um").classes, CORES_AVATAR_FORNECEDOR[indiceCorAvatar("Nome Um")]);
});
