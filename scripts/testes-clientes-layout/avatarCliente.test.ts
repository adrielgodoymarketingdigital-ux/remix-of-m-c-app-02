// deno test --no-check scripts/testes-clientes-layout/
// Nomes totalmente fictícios.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  avatarCliente,
  CORES_AVATAR_CLIENTE,
  iniciaisCliente,
  indiceCorAvatarCliente,
} from "../../src/components/clientes/avatarCliente.ts";

Deno.test("nome vazio, só espaços ou ausente vira ?", () => {
  assertEquals(iniciaisCliente(""), "?");
  assertEquals(iniciaisCliente("   "), "?");
  assertEquals(iniciaisCliente(null), "?");
  assertEquals(iniciaisCliente(undefined), "?");
});

Deno.test("uma palavra usa as duas primeiras letras", () => {
  assertEquals(iniciaisCliente("cliente"), "CL");
  assertEquals(iniciaisCliente("Q"), "Q");
});

Deno.test("várias palavras usam a primeira e a última, ignorando conectivos", () => {
  assertEquals(iniciaisCliente("Cliente Teste 01"), "C0");
  assertEquals(iniciaisCliente("Cliente da Silva Teste"), "CT");
  assertEquals(iniciaisCliente("  cliente   ficticio  "), "CF");
  assertEquals(iniciaisCliente("de da do"), "DD");
});

Deno.test("acentos são mantidos e ficam maiúsculos", () => {
  assertEquals(iniciaisCliente("ângela útil"), "ÂÚ");
  assertEquals(iniciaisCliente("Érica"), "ÉR");
});

Deno.test("emoji e pontuação são ignorados", () => {
  assertEquals(iniciaisCliente("🔧 Cliente Teste"), "CT");
  assertEquals(iniciaisCliente("🎉🎉"), "?");
  assertEquals(iniciaisCliente("(Cliente) - Teste!"), "CT");
});

Deno.test("cor é fixa para o mesmo ID e sempre está na paleta", () => {
  const id = "c0ffee00-0000-4000-8000-000000000001";
  assertEquals(indiceCorAvatarCliente(id), indiceCorAvatarCliente(id));
  for (let i = 0; i < 200; i++) {
    const idx = indiceCorAvatarCliente(`id-ficticio-${i}`);
    assert(idx >= 0 && idx < CORES_AVATAR_CLIENTE.length);
  }
  const usadas = new Set(Array.from({ length: 200 }, (_, i) => indiceCorAvatarCliente(`id-ficticio-${i}`)));
  assertEquals(usadas.size, CORES_AVATAR_CLIENTE.length);
});

Deno.test("a cor vem do ID, não do nome; sem ID usa o nome", () => {
  const a = avatarCliente("id-a", "Cliente Teste 01");
  const b = avatarCliente("id-a", "Outro Nome Fictício");
  assertEquals(a.classes, b.classes);
  assertEquals(avatarCliente(null, "Cliente Teste 01").classes, CORES_AVATAR_CLIENTE[indiceCorAvatarCliente("Cliente Teste 01")]);
  assertEquals(avatarCliente("", "").iniciais, "?");
});
