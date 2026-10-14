// deno test --no-check --allow-read scripts/testes-cadastro-cliente/
// Cadastro de cliente com os mesmos campos da aba Cliente da OS
// (src/lib/clientes/dadosCliente.ts): endereço em partes gravado na única coluna
// clientes.endereco, separação ao editar e o campo único "CPF / CNPJ".
import { assertEquals } from "jsr:@std/assert@1";
import {
  ENDERECO_VAZIO, documentoDoCliente, documentoParaColunas, mascararDocumento, montarEnderecoCliente, separarEnderecoCliente,
} from "../../src/lib/clientes/dadosCliente.ts";

const COMPLETO = { endereco: "Rua das Flores", numero: "123", bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01001-000" };

Deno.test("monta o endereço completo num texto legível", () => {
  assertEquals(montarEnderecoCliente(COMPLETO), "Rua das Flores, 123 - Centro - São Paulo/SP - CEP 01001-000");
});

Deno.test("partes vazias ficam de fora", () => {
  assertEquals(montarEnderecoCliente({ ...ENDERECO_VAZIO, endereco: "Rua A" }), "Rua A");
  assertEquals(montarEnderecoCliente({ ...ENDERECO_VAZIO, endereco: "Rua A", numero: "10" }), "Rua A, 10");
  assertEquals(montarEnderecoCliente({ ...ENDERECO_VAZIO, cidade: "Campinas", estado: "sp" }), "Campinas/SP");
  // Cidade sem UF leva a barra, para não ser confundida com o bairro ao editar.
  assertEquals(montarEnderecoCliente({ ...ENDERECO_VAZIO, endereco: "Rua A", cidade: "Campinas" }), "Rua A - Campinas/");
  assertEquals(separarEnderecoCliente("Rua A - Campinas/"), { ...ENDERECO_VAZIO, endereco: "Rua A", cidade: "Campinas" });
  assertEquals(montarEnderecoCliente({ ...ENDERECO_VAZIO, cep: "13010-000" }), "CEP 13010-000");
  assertEquals(montarEnderecoCliente(ENDERECO_VAZIO), "");
  assertEquals(montarEnderecoCliente({ ...COMPLETO, endereco: "  Rua X  ", bairro: "   " }), "Rua X, 123 - São Paulo/SP - CEP 01001-000");
});

Deno.test("separa de volta o que foi montado, em todas as combinações de partes", () => {
  const chaves = Object.keys(COMPLETO) as (keyof typeof COMPLETO)[];
  for (let mascara = 0; mascara < 1 << chaves.length; mascara++) {
    const partes = { ...ENDERECO_VAZIO };
    chaves.forEach((k, i) => { if (mascara & (1 << i)) partes[k] = COMPLETO[k]; });
    const texto = montarEnderecoCliente(partes);
    const volta = separarEnderecoCliente(texto);
    // Sempre remonta o mesmo texto (nunca altera o que está gravado)...
    assertEquals(montarEnderecoCliente(volta), texto);
    // ...e, quando há rua, recupera cada parte no lugar certo.
    if (partes.endereco) assertEquals(volta, partes);
  }
});

Deno.test("cidades e bairros com hífen e ruas com vírgula", () => {
  for (const partes of [
    { endereco: "Av. Brasil", numero: "1500A", bairro: "Jardim Bela-Vista", cidade: "Embu-Guaçu", estado: "SP", cep: "06900-000" },
    { endereco: "Rua 7 de Setembro, Bloco B", numero: "s/n", bairro: "Centro", cidade: "Rio de Janeiro", estado: "RJ", cep: "20000-000" },
  ]) {
    assertEquals(separarEnderecoCliente(montarEnderecoCliente(partes)), partes);
  }
});

Deno.test("endereço antigo digitado livre fica inteiro em Endereço (Rua) e não muda ao salvar", () => {
  for (const antigo of [
    "Rua A 123 casa 2", "Rua A, 123, apto 4 - fundos", "Travessa X - perto da padaria", "Rua Y, 45 - Centro - Campinas",
    "CEP 01001-000 Rua Z", "Av. Paulista, 1000 - Bela Vista - São Paulo - SP", "  Rua com espaço  ",
  ]) {
    const partes = separarEnderecoCliente(antigo);
    assertEquals(montarEnderecoCliente(partes), antigo.trim());
  }
  assertEquals(separarEnderecoCliente("Rua A 123 casa 2"), { ...ENDERECO_VAZIO, endereco: "Rua A 123 casa 2" });
});

Deno.test("endereço vazio ou nulo", () => {
  for (const v of [null, undefined, "", "   "]) assertEquals(separarEnderecoCliente(v), ENDERECO_VAZIO);
});

Deno.test("máscara do CPF / CNPJ é a mesma da OS (até 11 dígitos CPF, depois CNPJ)", () => {
  assertEquals(mascararDocumento("12345678901"), "123.456.789-01");
  assertEquals(mascararDocumento("123.456.789-01"), "123.456.789-01");
  assertEquals(mascararDocumento("12345678000195"), "12.345.678/0001-95");
  assertEquals(mascararDocumento("1234"), "123.4");
});

Deno.test("documento vai para a coluna do tipo dele; a outra coluna mantém o que já estava", () => {
  assertEquals(documentoParaColunas("123.456.789-01"), { cpf: "123.456.789-01", cnpj: "" });
  assertEquals(documentoParaColunas("12.345.678/0001-95"), { cpf: "", cnpj: "12.345.678/0001-95" });
  assertEquals(documentoParaColunas("12.345.678/0001-95", { cpf: "111.111.111-11", cnpj: null }), { cpf: "111.111.111-11", cnpj: "12.345.678/0001-95" });
  assertEquals(documentoParaColunas("123.456.789-01", { cpf: null, cnpj: "12.345.678/0001-95" }), { cpf: "123.456.789-01", cnpj: "12.345.678/0001-95" });
  assertEquals(documentoParaColunas("", { cpf: "111.111.111-11", cnpj: "12.345.678/0001-95" }), { cpf: "", cnpj: "12.345.678/0001-95" });
  assertEquals(documentoParaColunas("", { cpf: null, cnpj: "12.345.678/0001-95" }), { cpf: "", cnpj: "" });
});

Deno.test("ao editar, o campo mostra o CPF ou, sem CPF, o CNPJ", () => {
  assertEquals(documentoDoCliente({ cpf: "123.456.789-01", cnpj: "12.345.678/0001-95" }), "123.456.789-01");
  assertEquals(documentoDoCliente({ cpf: null, cnpj: "12.345.678/0001-95" }), "12.345.678/0001-95");
  assertEquals(documentoDoCliente(null), "");
});
