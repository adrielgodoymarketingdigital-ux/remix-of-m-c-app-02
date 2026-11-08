// node --test src/lib/multiempresas/resolverLojaGravacao.test.ts
// Loja de gravação (venda, OS, contas…). Dados fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  empresaIdHerdado,
  papelDeGravacao,
  precisaDaMatriz,
  resolverLojaGravacao,
} from "./resolverLojaGravacao.ts";

const MATRIZ = "emp-matriz";
const FILIAL_A = "emp-filial-a";
const FILIAL_B = "emp-filial-b";

test("funcionário de filial grava na filial dele (não na matriz)", () => {
  const e = { papel: "funcionario" as const, funcionarioEmpresaId: FILIAL_A, matrizId: MATRIZ };
  assert.equal(resolverLojaGravacao(e), FILIAL_A);
  assert.equal(precisaDaMatriz(e), false);
});

test("funcionário sem loja grava na matriz do dono", () => {
  const e = { papel: "funcionario" as const, funcionarioEmpresaId: null, matrizId: MATRIZ };
  assert.equal(precisaDaMatriz(e), true);
  assert.equal(resolverLojaGravacao(e), MATRIZ);
});

test("funcionário: empresaAtiva e isProprietario não mudam a loja dele", () => {
  assert.equal(
    resolverLojaGravacao({ papel: "funcionario", funcionarioEmpresaId: FILIAL_A, isProprietario: true, empresaAtiva: FILIAL_B, matrizId: MATRIZ }),
    FILIAL_A,
  );
  assert.equal(
    resolverLojaGravacao({ papel: "funcionario", funcionarioEmpresaId: null, isProprietario: true, empresaAtiva: FILIAL_B, matrizId: MATRIZ }),
    MATRIZ,
  );
});

test("gerente grava na filial dele, mesmo com outra loja ativa", () => {
  const e = { papel: "gerente" as const, gerenteEmpresaId: FILIAL_B, isProprietario: true, empresaAtiva: FILIAL_A, matrizId: MATRIZ };
  assert.equal(resolverLojaGravacao(e), FILIAL_B);
  assert.equal(precisaDaMatriz(e), false);
});

test("gerente sem filial no vínculo cai na matriz", () => {
  assert.equal(resolverLojaGravacao({ papel: "gerente", gerenteEmpresaId: null, matrizId: MATRIZ }), MATRIZ);
});

test("dono com filial ativa grava na filial ativa", () => {
  const e = { papel: "dono" as const, isProprietario: true, empresaAtiva: FILIAL_A, matrizId: MATRIZ };
  assert.equal(resolverLojaGravacao(e), FILIAL_A);
  assert.equal(precisaDaMatriz(e), false);
});

test("dono sem seleção grava na matriz", () => {
  const e = { papel: "dono" as const, isProprietario: true, empresaAtiva: null, matrizId: MATRIZ };
  assert.equal(precisaDaMatriz(e), true);
  assert.equal(resolverLojaGravacao(e), MATRIZ);
});

test("dono sem multiempresa (sem matriz) continua sem loja", () => {
  assert.equal(resolverLojaGravacao({ papel: "dono", isProprietario: false, empresaAtiva: null, matrizId: null }), null);
  // empresaAtiva residual sem ser proprietário é ignorada (como antes)
  assert.equal(resolverLojaGravacao({ papel: "dono", isProprietario: false, empresaAtiva: FILIAL_A, matrizId: null }), null);
});

test("matriz desconhecida grava sem loja (nunca lança)", () => {
  for (const matrizId of [null, undefined, ""]) {
    assert.equal(resolverLojaGravacao({ papel: "funcionario", funcionarioEmpresaId: null, matrizId }), null);
    assert.equal(resolverLojaGravacao({ papel: "dono", isProprietario: true, empresaAtiva: null, matrizId }), null);
    assert.equal(resolverLojaGravacao({ papel: "gerente", gerenteEmpresaId: null, matrizId }), null);
  }
});

test("papel: gerente tem prioridade sobre funcionário", () => {
  assert.equal(papelDeGravacao({ ehGerente: true, ehFuncionario: true }), "gerente");
  assert.equal(papelDeGravacao({ ehGerente: false, ehFuncionario: true }), "funcionario");
  assert.equal(papelDeGravacao({ ehGerente: false, ehFuncionario: false }), "dono");
});

test("conta gerada herda o empresa_id do registro de origem", () => {
  assert.equal(empresaIdHerdado({ empresa_id: FILIAL_A }), FILIAL_A);
  assert.equal(empresaIdHerdado({ empresa_id: null }), null);
  assert.equal(empresaIdHerdado({}), null);
  assert.equal(empresaIdHerdado(null), null);
  assert.equal(empresaIdHerdado(undefined), null);
});
