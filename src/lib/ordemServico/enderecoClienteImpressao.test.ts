// deno test -A --no-check src/lib/ordemServico/enderecoClienteImpressao.test.ts
// Endereço do cliente na impressão da OS: texto inteiro (sem corte) e linhas do cupom.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as modulo from "./enderecoClienteImpressao.ts";
import {
  linhasEnderecoCupom,
  partesEnderecoCliente,
  textoEnderecoCliente,
} from "./enderecoClienteImpressao.ts";

test("sem cliente ou sem nenhum campo = vazio", () => {
  assert.equal(textoEnderecoCliente(null), "");
  assert.equal(textoEnderecoCliente(undefined), "");
  assert.equal(textoEnderecoCliente({}), "");
  assert.equal(textoEnderecoCliente({ endereco: null, numero: null, bairro: null, cidade: null, estado: null, cep: null }), "");
  assert.deepEqual(linhasEnderecoCupom({}), []);
});

test("campos só com espaços contam como vazios", () => {
  assert.equal(textoEnderecoCliente({ endereco: "   ", numero: " ", bairro: "\t", cidade: "  ", estado: " ", cep: "" }), "");
});

test("só a rua (cliente antigo com o texto inteiro)", () => {
  assert.equal(textoEnderecoCliente({ endereco: "Rua das Flores, 120 - Centro" }), "Rua das Flores, 120 - Centro");
});

test("rua + número", () => {
  assert.equal(textoEnderecoCliente({ endereco: "Rua das Flores", numero: "120" }), "Rua das Flores, 120");
});

test("completo: rua, número – bairro, cidade/UF – CEP", () => {
  assert.equal(
    textoEnderecoCliente({ endereco: "Rua das Flores", numero: "120", bairro: "Centro", cidade: "Campinas", estado: "sp", cep: "13010000" }),
    "Rua das Flores, 120 – Centro, Campinas/SP – CEP 13010-000",
  );
});

test("espaços repetidos e nas pontas são limpos", () => {
  assert.equal(
    textoEnderecoCliente({ endereco: "  Rua   das  Flores ", numero: " 120 ", bairro: " Centro ", cidade: " Campinas", estado: "SP " }),
    "Rua das Flores, 120 – Centro, Campinas/SP",
  );
});

test("cliente antigo: número, bairro, cidade e UF já no texto não se repetem", () => {
  assert.equal(
    textoEnderecoCliente({ endereco: "Rua das Flores, 120 - Centro, Campinas/SP", numero: "120", bairro: "centro", cidade: "Campinas", estado: "SP" }),
    "Rua das Flores, 120 - Centro, Campinas/SP",
  );
});

test("comparação ignora acento e caixa", () => {
  // Bairro e cidade já no texto não se repetem; a UF, que não estava, entra.
  assert.equal(
    textoEnderecoCliente({ endereco: "Av. Paulista 1000, Bela Vista, Sao Paulo", bairro: "Bela Vista", cidade: "São Paulo", estado: "SP" }),
    "Av. Paulista 1000, Bela Vista, Sao Paulo – SP",
  );
});

test("número dentro de outro número não conta como repetido", () => {
  assert.equal(textoEnderecoCliente({ endereco: "Rua 12 de Outubro", numero: "1" }), "Rua 12 de Outubro, 1");
  assert.equal(textoEnderecoCliente({ endereco: "Rua 12 de Outubro", numero: "12" }), "Rua 12 de Outubro");
});

test("UF solta no texto não some se a cidade é nova", () => {
  assert.equal(
    textoEnderecoCliente({ endereco: "Rodovia SP 340, km 10", cidade: "Mogi Mirim", estado: "SP" }),
    "Rodovia SP 340, km 10 – Mogi Mirim/SP",
  );
});

test("CEP já no texto não se repete; com ou sem traço", () => {
  assert.equal(textoEnderecoCliente({ endereco: "Rua A, 1 - CEP 13010-000", cep: "13010000" }), "Rua A, 1 - CEP 13010-000");
  assert.equal(textoEnderecoCliente({ endereco: "Rua A, 1 - 13010000", cep: "13010-000" }), "Rua A, 1 - 13010000");
});

test("partes soltas sem rua", () => {
  assert.equal(textoEnderecoCliente({ numero: "45" }), "nº 45");
  assert.equal(textoEnderecoCliente({ bairro: "Centro" }), "Centro");
  assert.equal(textoEnderecoCliente({ cidade: "Campinas" }), "Campinas");
  assert.equal(textoEnderecoCliente({ estado: "sp" }), "SP");
  assert.equal(textoEnderecoCliente({ cidade: "Campinas", estado: "SP" }), "Campinas/SP");
  assert.equal(textoEnderecoCliente({ cep: "13010000" }), "CEP 13010-000");
  assert.equal(textoEnderecoCliente({ cep: "1301" }), "CEP 1301");
});

test("cupom: uma parte por linha, inteira", () => {
  assert.deepEqual(
    linhasEnderecoCupom({ endereco: "Rua das Flores", numero: "120", bairro: "Centro", cidade: "Campinas", estado: "SP", cep: "13010000" }),
    ["Rua das Flores, 120", "Centro, Campinas/SP", "CEP 13010-000"],
  );
  const rua = "Avenida ".repeat(20).trim();
  const longo = linhasEnderecoCupom({ endereco: rua, bairro: "B" });
  assert.deepEqual(longo, [rua, "B"]);
  assert.ok(!longo.some((linha) => linha.includes("…")));
  assert.deepEqual(partesEnderecoCliente({ endereco: "x" }), ["x"]);
});

test("endereço longo sai inteiro, sem reticências", () => {
  const cliente = {
    endereco: "Avenida Presidente Juscelino Kubitschek de Oliveira (antiga Estrada Municipal do Jardim das Palmeiras)",
    numero: "12345-A, bloco C, apto 1201",
    bairro: "Jardim Residencial Parque das Flores e Colinas do Sul",
    cidade: "São José do Rio Preto",
    estado: "SP",
    cep: "15091450",
  };
  const texto = textoEnderecoCliente(cliente);
  assert.equal(
    texto,
    "Avenida Presidente Juscelino Kubitschek de Oliveira (antiga Estrada Municipal do Jardim das Palmeiras), 12345-A, bloco C, apto 1201" +
      " – Jardim Residencial Parque das Flores e Colinas do Sul, São José do Rio Preto/SP – CEP 15091-450",
  );
  assert.ok(!texto.includes("…"));
});

test("não existe mais corte de endereço (cortarComReticencias / cortarAteCaber / MAX_CARACTERES_LINHA_CUPOM)", () => {
  const exportados = Object.keys(modulo);
  for (const nome of ["cortarComReticencias", "cortarAteCaber", "MAX_CARACTERES_LINHA_CUPOM"]) {
    assert.ok(!exportados.includes(nome), nome);
  }
});
