// deno test -A --no-check src/lib/ordemServico/enderecoClienteImpressao.test.ts
// Endereço do cliente na impressão da OS: texto de uma linha e linhas do cupom.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cortarAteCaber,
  cortarComReticencias,
  linhasEnderecoCupom,
  MAX_CARACTERES_LINHA_CUPOM,
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

test("cupom: uma parte por linha, cada uma curta", () => {
  assert.deepEqual(
    linhasEnderecoCupom({ endereco: "Rua das Flores", numero: "120", bairro: "Centro", cidade: "Campinas", estado: "SP", cep: "13010000" }),
    ["Rua das Flores, 120", "Centro, Campinas/SP", "CEP 13010-000"],
  );
  const longo = linhasEnderecoCupom({ endereco: "Avenida ".repeat(20), bairro: "B" });
  assert.equal(longo.length, 2);
  assert.equal(longo[0].length, MAX_CARACTERES_LINHA_CUPOM);
  assert.ok(longo[0].endsWith("…"));
  assert.deepEqual(partesEnderecoCliente({ endereco: "x" }), ["x"]);
});

test("cortarComReticencias", () => {
  assert.equal(cortarComReticencias("abc", 3), "abc");
  assert.equal(cortarComReticencias("abcd", 3), "ab…");
  assert.equal(cortarComReticencias("ab   cd", 4), "ab…");
  assert.equal(cortarComReticencias("abcd", 1), "…");
});

test("cortarAteCaber pega o maior prefixo que cabe", () => {
  const cabe = (s: string) => s.length <= 10;
  assert.equal(cortarAteCaber("curto", cabe), "curto");
  const r = cortarAteCaber("um texto bem comprido mesmo", cabe);
  assert.ok(r.length <= 10 && r.endsWith("…"), r);
  assert.equal(r, "um texto…");
  assert.equal(cortarAteCaber("abcdef", () => false), "…");
});
