// TZ=UTC deno test --no-check scripts/testes-busca-compra/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-busca-compra/
// Roda as funções reais de src/lib/busca/normalizarBusca.ts (busca nos
// seletores de Pessoa e Dispositivo do registro de compra) e a regra de empresa
// de src/lib/origem/comprasDispositivos.ts aplicada às pessoas de origem.
import { assertEquals } from "jsr:@std/assert@1";
import {
  apenasDigitos,
  dispositivosDisponiveisParaCompra,
  filtrarDispositivos,
  filtrarPessoas,
  normalizarCodigo,
  normalizarTexto,
} from "../../src/lib/busca/normalizarBusca.ts";
import { compraPassaNoFiltroEmpresa, filtroEmpresaCompras } from "../../src/lib/origem/comprasDispositivos.ts";

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

const PESSOAS = [
  { id: "p1", nome: "João Conceição", nome_fantasia: null, cpf_cnpj: "123.456.789-00", telefone: "(11) 98765-4321" },
  { id: "p2", nome: "MARIA JOSÉ da Silva", nome_fantasia: "Zé Celulares", cpf_cnpj: "52998224725", telefone: "21 3333-4444" },
  { id: "p3", nome: "Ana Souza", nome_fantasia: null, cpf_cnpj: "12.345.678/0001-90", telefone: null },
];
const ids = (l: { id: string }[]) => l.map((x) => x.id);

Deno.test("normalização: acento, maiúscula, espaços; dígitos; códigos", () => {
  assertEquals(normalizarTexto("  JOÃO   Conceição "), "joao conceicao");
  assertEquals(apenasDigitos("123.456.789-00"), "12345678900");
  assertEquals(normalizarCodigo(" sn-12 34/ab "), "SN1234AB");
  assertEquals(normalizarTexto(null), "");
});

Deno.test("pessoa: acento e maiúscula nos dois lados", () => {
  assertEquals(ids(filtrarPessoas(PESSOAS, "joao")), ["p1"]);
  assertEquals(ids(filtrarPessoas(PESSOAS, "CONCEIÇÃO")), ["p1"]);
  assertEquals(ids(filtrarPessoas(PESSOAS, "jose")), ["p2"]);
  assertEquals(ids(filtrarPessoas(PESSOAS, "ze celulares")), ["p2"], "nome fantasia");
});

Deno.test("pessoa: vários termos combinados com E", () => {
  assertEquals(ids(filtrarPessoas(PESSOAS, "maria silva")), ["p2"]);
  assertEquals(ids(filtrarPessoas(PESSOAS, "maria souza")), []);
  assertEquals(ids(filtrarPessoas(PESSOAS, "ana 0001")), ["p3"], "texto + dígitos do CNPJ");
});

Deno.test("pessoa: CPF/CNPJ com e sem máscara, a partir de 3 dígitos", () => {
  assertEquals(ids(filtrarPessoas(PESSOAS, "12345678900")), ["p1"]);
  assertEquals(ids(filtrarPessoas(PESSOAS, "123.456.789-00")), ["p1"]);
  assertEquals(ids(filtrarPessoas(PESSOAS, "529.982.247-25")), ["p2"], "CPF salvo sem máscara, digitado com");
  assertEquals(ids(filtrarPessoas(PESSOAS, "12.345.678/0001-90")), ["p3"]);
  assertEquals(ids(filtrarPessoas(PESSOAS, "78900")), ["p1"], "parte do CPF");
  assertEquals(ids(filtrarPessoas(PESSOAS, "456")), ["p1", "p3"], "3 dígitos no CPF de p1 e no CNPJ de p3");
  assertEquals(ids(filtrarPessoas(PESSOAS, "12")), [], "menos de 3 dígitos não busca documento");
});

Deno.test("pessoa: telefone com e sem máscara", () => {
  assertEquals(ids(filtrarPessoas(PESSOAS, "98765-4321")), ["p1"]);
  assertEquals(ids(filtrarPessoas(PESSOAS, "(11) 98765")), ["p1"]);
  assertEquals(ids(filtrarPessoas(PESSOAS, "33334444")), ["p2"]);
});

Deno.test("pessoa: termo vazio devolve a lista inteira na mesma ordem", () => {
  assertEquals(filtrarPessoas(PESSOAS, ""), PESSOAS);
  assertEquals(filtrarPessoas(PESSOAS, "   "), PESSOAS);
});

const DISPOSITIVOS = [
  { id: "d1", marca: "Apple", modelo: "iPhone 13 Pro", cor: "Azul-sierra", imei: "356789012345678", imei2: "356789012345686", numero_serie: "F2LX-9KQ1 ABC", codigo_barras: null, vendido: false, deleted_at: null, compra_id: null },
  { id: "d2", marca: "Samsung", modelo: "Galaxy A15", cor: "Preto", imei: "352222222220123", imei2: null, numero_serie: "R58T12", codigo_barras: "7890000011112", vendido: false, deleted_at: null, compra_id: null, imeis: ["352222222220999"] },
  { id: "d3", marca: "Motorola", modelo: "Moto G54", cor: null, imei: null, imei2: null, numero_serie: null, codigo_barras: null, vendido: true, deleted_at: null, compra_id: null },
  { id: "d4", marca: "Xiaomi", modelo: "Redmi Note 13", cor: "Verde", imei: "860000000000001", imei2: null, numero_serie: null, codigo_barras: null, vendido: false, deleted_at: "2026-10-01T10:00:00Z", compra_id: null },
  { id: "d5", marca: "Apple", modelo: "iPhone 11", cor: "Branco", imei: "353000000000002", imei2: null, numero_serie: null, codigo_barras: null, vendido: false, deleted_at: null, compra_id: "compra-1" },
];

Deno.test("dispositivo: marca/modelo/cor por texto, vários termos", () => {
  assertEquals(ids(filtrarDispositivos(DISPOSITIVOS, "iphone")), ["d1", "d5"]);
  assertEquals(ids(filtrarDispositivos(DISPOSITIVOS, "APPLE 13")), ["d1"]);
  assertEquals(ids(filtrarDispositivos(DISPOSITIVOS, "galaxy preto")), ["d2"]);
  assertEquals(ids(filtrarDispositivos(DISPOSITIVOS, "azul sierra")), ["d1"], "hífen na cor");
});

Deno.test("dispositivo: IMEI parcial (últimos dígitos), IMEI 2 e IMEIs das unidades", () => {
  assertEquals(ids(filtrarDispositivos(DISPOSITIVOS, "5678")), ["d1"]);
  assertEquals(ids(filtrarDispositivos(DISPOSITIVOS, "345686")), ["d1"], "IMEI 2");
  assertEquals(ids(filtrarDispositivos(DISPOSITIVOS, "220999")), ["d2"], "dispositivo_imeis");
  assertEquals(ids(filtrarDispositivos(DISPOSITIVOS, "356789012345678")), ["d1"]);
});

Deno.test("dispositivo: série com hífen/espaço e código de barras", () => {
  assertEquals(ids(filtrarDispositivos(DISPOSITIVOS, "f2lx9kq1")), ["d1"]);
  assertEquals(ids(filtrarDispositivos(DISPOSITIVOS, "F2LX-9KQ1-ABC")), ["d1"]);
  assertEquals(ids(filtrarDispositivos(DISPOSITIVOS, "r58t")), ["d2"]);
  assertEquals(ids(filtrarDispositivos(DISPOSITIVOS, "78900000")), ["d2"]);
});

Deno.test("dispositivo: termo vazio devolve a lista inteira na mesma ordem", () => {
  assertEquals(filtrarDispositivos(DISPOSITIVOS, ""), DISPOSITIVOS);
});

Deno.test("disponíveis para compra: tira vendidos, excluídos e com compra", () => {
  assertEquals(ids(dispositivosDisponiveisParaCompra(DISPOSITIVOS)), ["d1", "d2"]);
  assertEquals(ids(dispositivosDisponiveisParaCompra(DISPOSITIVOS, null)), ["d1", "d2"]);
});

Deno.test("disponíveis para compra: o pré-selecionado entra mesmo com compra_id (?dispositivo=)", () => {
  assertEquals(ids(dispositivosDisponiveisParaCompra(DISPOSITIVOS, "d5")), ["d1", "d2", "d5"]);
  assertEquals(ids(dispositivosDisponiveisParaCompra(DISPOSITIVOS, "nao-existe")), ["d1", "d2"]);
});

Deno.test("pessoas por empresa: nulo aparece na matriz, não na filial; sem empresa vê todas", () => {
  const MATRIZ = "11111111-1111-1111-1111-111111111111";
  const FILIAL = "22222222-2222-2222-2222-222222222222";
  const OUTRA = "33333333-3333-3333-3333-333333333333";
  const pessoas = [
    { id: "nula", empresa_id: null },
    { id: "matriz", empresa_id: MATRIZ },
    { id: "filial", empresa_id: FILIAL },
    { id: "outra", empresa_id: OUTRA },
  ];
  const visiveis = (empresaId: string | null, isFilial: boolean) =>
    ids(pessoas.filter((p) => compraPassaNoFiltroEmpresa(p.empresa_id, filtroEmpresaCompras(empresaId, isFilial))));
  assertEquals(visiveis(MATRIZ, false), ["nula", "matriz"]);
  assertEquals(visiveis(FILIAL, true), ["filial"]);
  assertEquals(visiveis(null, false), ["nula", "matriz", "filial", "outra"]);
});
