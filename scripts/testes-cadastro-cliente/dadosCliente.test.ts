// deno test --no-check --allow-read scripts/testes-cadastro-cliente/
// Cadastro de cliente com os mesmos campos da aba Cliente da OS
// (src/lib/clientes/dadosCliente.ts): campo único "CPF / CNPJ" e a gravação do
// cliente pela OS, com cada parte do endereço na sua coluna.
import { assertEquals } from "jsr:@std/assert@1";
import {
  CAMPOS_ENDERECO_CLIENTE, clienteAlterado, documentoDoCliente, documentoParaColunas, mascararDocumento, payloadClienteOS,
} from "../../src/lib/clientes/dadosCliente.ts";

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

const BASE = { nome: "Maria", telefone: "11999990000", cpf: "123.456.789-01", endereco: "Rua das Flores", dataNascimento: "1990-05-20" };

Deno.test("OS completa: cada parte do endereço vai para a sua coluna (vazio vira null)", () => {
  assertEquals(CAMPOS_ENDERECO_CLIENTE, ["numero", "bairro", "cidade", "estado", "cep"]);
  assertEquals(payloadClienteOS({ ...BASE, numero: "123", bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01001-000" }), {
    nome: "Maria", telefone: "11999990000", cpf: "123.456.789-01", endereco: "Rua das Flores", data_nascimento: "1990-05-20",
    numero: "123", bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01001-000",
  });
  assertEquals(payloadClienteOS({ ...BASE, dataNascimento: "", numero: "", bairro: " ", cidade: "", estado: "", cep: "" }), {
    nome: "Maria", telefone: "11999990000", cpf: "123.456.789-01", endereco: "Rua das Flores", data_nascimento: null,
    numero: null, bairro: null, cidade: null, estado: null, cep: null,
  });
});

Deno.test("OS simplificada (sem os campos de endereço): as colunas novas não entram e não são apagadas", () => {
  const payload = payloadClienteOS(BASE);
  assertEquals(Object.keys(payload).sort(), ["cpf", "data_nascimento", "endereco", "nome", "telefone"]);
  // Cliente com bairro gravado, OS simplificada salva os mesmos dados: nada muda.
  const atual = { nome: "Maria", telefone: "11999990000", cpf: "123.456.789-01", endereco: "Rua das Flores", data_nascimento: "1990-05-20", bairro: "Centro", cep: "01001-000" };
  assertEquals(clienteAlterado(atual, payload), false);
});

Deno.test("cliente selecionado na OS sem mexer em nada: não regrava (null e vazio contam como iguais)", () => {
  const atual = { nome: "Maria", telefone: "11999990000", cpf: "123.456.789-01", endereco: "Rua das Flores", data_nascimento: "1990-05-20", numero: null, bairro: null, cidade: null, estado: null, cep: null };
  assertEquals(clienteAlterado(atual, payloadClienteOS({ ...BASE, numero: "", bairro: "", cidade: "", estado: "", cep: "" })), false);
  // Antes da migration a linha não tem as colunas novas: vazio na tela também conta como igual.
  const semColunas = { nome: "Maria", telefone: "11999990000", cpf: "123.456.789-01", endereco: "Rua das Flores", data_nascimento: "1990-05-20" };
  assertEquals(clienteAlterado(semColunas, payloadClienteOS({ ...BASE, numero: "", bairro: "", cidade: "", estado: "", cep: "" })), false);
});

Deno.test("mudou alguma parte do endereço (ou outro dado): regrava", () => {
  const atual = { nome: "Maria", telefone: "11999990000", cpf: "123.456.789-01", endereco: "Rua das Flores", data_nascimento: "1990-05-20", numero: "123", bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01001-000" };
  const igual = { ...BASE, numero: "123", bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01001-000" };
  assertEquals(clienteAlterado(atual, payloadClienteOS(igual)), false);
  assertEquals(clienteAlterado(atual, payloadClienteOS({ ...igual, numero: "456" })), true);
  assertEquals(clienteAlterado(atual, payloadClienteOS({ ...igual, cep: "" })), true);
  assertEquals(clienteAlterado(atual, payloadClienteOS({ ...igual, dataNascimento: "" })), true);
  assertEquals(clienteAlterado(atual, payloadClienteOS({ ...igual, nome: "Maria S." })), true);
});
