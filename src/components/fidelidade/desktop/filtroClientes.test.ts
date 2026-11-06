// node --test src/components/fidelidade/desktop/filtroClientes.test.ts
// Busca + filtro por nível do computador e escolha do estado vazio. Dados fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ClienteFidelidade, FidelidadeNivel } from "@/types/fidelidade";
import {
  estadoVazioFidelidade,
  filtrarClientesFidelidade,
  nivelFiltroEfetivo,
  TODOS_OS_NIVEIS,
} from "./filtroClientes.ts";

function nivel(id: string, nome: string): FidelidadeNivel {
  return { id, user_id: "u-teste", nome, pontos_minimos: 0, cor: "#123456", beneficio: null, ordem: 1 };
}

function cliente(id: string, nome: string, nv: FidelidadeNivel | null): ClienteFidelidade {
  return {
    cliente_id: id, nome, celular: null, email: null, total_pontos: 10, total_vendas: 0,
    total_os: 0, valor_total_gasto: 0, nivel: nv, ultima_compra: null,
  };
}

const n1 = nivel("nv-1", "Nível Um");
const n2 = nivel("nv-2", "Nível Dois");
const clientes = [
  cliente("c1", "Fulano Teste", n1),
  cliente("c2", "Beltrana Exemplo", n2),
  cliente("c3", "Ciclano TESTE", null),
];

test("busca igual à do celular: nome contém o texto, sem diferenciar maiúsculas", () => {
  assert.deepEqual(filtrarClientesFidelidade(clientes, "teste", TODOS_OS_NIVEIS).map(c => c.cliente_id), ["c1", "c3"]);
  assert.deepEqual(filtrarClientesFidelidade(clientes, "", TODOS_OS_NIVEIS).map(c => c.cliente_id), ["c1", "c2", "c3"]);
  assert.deepEqual(filtrarClientesFidelidade(clientes, "zzz", TODOS_OS_NIVEIS), []);
});

test("filtro por nível compara nivel.id; cliente sem nível só aparece em Todos", () => {
  assert.deepEqual(filtrarClientesFidelidade(clientes, "", "nv-2").map(c => c.cliente_id), ["c2"]);
  assert.deepEqual(filtrarClientesFidelidade(clientes, "teste", "nv-1").map(c => c.cliente_id), ["c1"]);
  assert.deepEqual(filtrarClientesFidelidade(clientes, "teste", "nv-2"), []);
});

test("nível excluído volta o filtro para Todos", () => {
  assert.equal(nivelFiltroEfetivo("nv-1", [n1, n2]), "nv-1");
  assert.equal(nivelFiltroEfetivo("nv-9", [n1, n2]), TODOS_OS_NIVEIS);
  assert.equal(nivelFiltroEfetivo(TODOS_OS_NIVEIS, []), TODOS_OS_NIVEIS);
});

test("estado vazio: sem-resultado só com clientes e busca/filtro ativo", () => {
  assert.equal(estadoVazioFidelidade(3, "x", TODOS_OS_NIVEIS), "sem-resultado");
  assert.equal(estadoVazioFidelidade(3, "", "nv-1"), "sem-resultado");
  assert.equal(estadoVazioFidelidade(3, "", TODOS_OS_NIVEIS), "sem-clientes");
  assert.equal(estadoVazioFidelidade(0, "x", "nv-1"), "sem-clientes");
  assert.equal(estadoVazioFidelidade(0, "", TODOS_OS_NIVEIS), "sem-clientes");
});
