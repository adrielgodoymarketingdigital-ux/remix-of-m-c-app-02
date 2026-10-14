// TZ=UTC deno test --no-check scripts/testes-compra-multi-dispositivo/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-compra-multi-dispositivo/
// Roda as funções reais de src/lib/origem/buscaCompras.ts (busca da lista de
// compras em todos os aparelhos ligados, não só no principal).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buscarNaCompra, descreverAparelhoEncontrado, type CompraBuscavel } from "../../src/lib/origem/buscaCompras.ts";

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

const iphone = (n: number) => ({
  id: `d${n}`,
  marca: "Apple",
  modelo: "iPhone 15",
  imei: `35000000000${1000 + n}`,
  imei2: `86000000000${1000 + n}`,
  numero_serie: `F2LX${n}`,
});

// Compra de 5 iPhones: o principal (d1) vem no join e todos em `aparelhos`.
const compra5: CompraBuscavel = {
  dispositivo_id: "d1",
  fornecedores: { nome: "Distribuidora Alfa" },
  dispositivos: { id: "d1", marca: "Apple", modelo: "iPhone 15", imei: iphone(1).imei, numero_serie: "F2LX1" },
  aparelhos: [1, 2, 3, 4, 5].map(iphone),
};

// Compra antiga de 1 aparelho (sem `aparelhos`, como vinha antes).
const compraAntiga: CompraBuscavel = {
  dispositivo_id: "x1",
  origem_pessoas: { nome: "Maria Souza", cpf_cnpj: "123.456.789-00" },
  dispositivos: { marca: "Samsung", modelo: "Galaxy A55", imei: "490154203237518" },
};

Deno.test("IMEI completo do 3º aparelho acha a compra e diz qual aparelho bateu", () => {
  const r = buscarNaCompra(compra5, "350000000001003");
  assert(r.encontrou);
  assertEquals(r.aparelhoSecundario, { id: "d3", rotulo: "Apple iPhone 15", campo: "IMEI", valor: "350000000001003" });
  assertEquals(descreverAparelhoEncontrado(r.aparelhoSecundario!), "Encontrado: Apple iPhone 15 · IMEI …1003");
});

Deno.test("IMEI parcial (últimos dígitos) do 5º aparelho", () => {
  const r = buscarNaCompra(compra5, "1005");
  assert(r.encontrou);
  assertEquals(r.aparelhoSecundario?.id, "d5");
});

Deno.test("IMEI com espaços e traços", () => {
  const r = buscarNaCompra(compra5, "35 0000-0000 01004");
  assert(r.encontrou);
  assertEquals(r.aparelhoSecundario?.id, "d4");
});

Deno.test("IMEI 2 e nº de série de aparelho secundário, sem diferença de maiúsculas", () => {
  const r2 = buscarNaCompra(compra5, "860000000001002");
  assert(r2.encontrou);
  assertEquals(r2.aparelhoSecundario?.campo, "IMEI 2");
  const s = buscarNaCompra(compra5, "f2lx4");
  assert(s.encontrou);
  assertEquals(s.aparelhoSecundario?.campo, "Série");
  assertEquals(s.aparelhoSecundario?.id, "d4");
});

Deno.test("bater no aparelho principal não mostra indicação", () => {
  const r = buscarNaCompra(compra5, "350000000001001");
  assertEquals(r, { encontrou: true, aparelhoSecundario: null });
  // Modelo/marca bate no principal: também sem indicação.
  assertEquals(buscarNaCompra(compra5, "IPHONE"), { encontrou: true, aparelhoSecundario: null });
  assertEquals(buscarNaCompra(compra5, "apple iphone 15"), { encontrou: true, aparelhoSecundario: null });
});

Deno.test("modelo diferente só num aparelho secundário", () => {
  const mista: CompraBuscavel = {
    ...compra5,
    aparelhos: [iphone(1), { id: "s1", marca: "Samsung", modelo: "Galaxy S24", imei: "111" }],
  };
  const r = buscarNaCompra(mista, "galaxy");
  assert(r.encontrou);
  assertEquals(descreverAparelhoEncontrado(r.aparelhoSecundario!), "Encontrado: Samsung Galaxy S24");
});

Deno.test("dados da compra continuam: fornecedor, pessoa, CPF e data", () => {
  assertEquals(buscarNaCompra(compra5, "alfa"), { encontrou: true, aparelhoSecundario: null });
  assert(buscarNaCompra(compraAntiga, "maria").encontrou);
  assert(buscarNaCompra(compraAntiga, "456.789").encontrou);
  assert(buscarNaCompra(compraAntiga, "14/10", "14/10/2026").encontrou);
});

Deno.test("compra antiga de 1 aparelho: IMEI, parcial e modelo como antes", () => {
  assertEquals(buscarNaCompra(compraAntiga, "490154203237518"), { encontrou: true, aparelhoSecundario: null });
  assertEquals(buscarNaCompra(compraAntiga, "7518"), { encontrou: true, aparelhoSecundario: null });
  assertEquals(buscarNaCompra(compraAntiga, "a55"), { encontrou: true, aparelhoSecundario: null });
});

Deno.test("sem resultado", () => {
  assertEquals(buscarNaCompra(compra5, "999999999999999"), { encontrou: false });
  assertEquals(buscarNaCompra(compraAntiga, "iphone"), { encontrou: false });
});

Deno.test("busca vazia mostra tudo", () => {
  assertEquals(buscarNaCompra(compra5, "   "), { encontrou: true, aparelhoSecundario: null });
});
