// node --test src/lib/multiempresas/filtroLeituraLoja.test.ts
// Filtro de leitura por loja (o que cada pessoa enxerga). Dados fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decidirFiltroLeitura,
  decidirFiltroLeituraAnterior,
  filtroLeituraPrecisaDaMatriz,
  modoFiltroLeitura,
  registroVisivel,
  type EntradaFiltroLeitura,
} from "./filtroLeituraLoja.ts";

const MATRIZ = "emp-matriz";
const FILIAL_A = "emp-filial-a";
const FILIAL_B = "emp-filial-b";

// Registros fictícios: um de cada loja e um sem loja.
const REGISTROS = [
  { id: "r-matriz", empresa_id: MATRIZ },
  { id: "r-sem-loja", empresa_id: null },
  { id: "r-filial-a", empresa_id: FILIAL_A },
  { id: "r-filial-b", empresa_id: FILIAL_B },
];
const visiveis = (e: EntradaFiltroLeitura) =>
  REGISTROS.filter((r) => registroVisivel(r.empresa_id, decidirFiltroLeitura(e))).map((r) => r.id);

test("dono na matriz: matriz + sem loja (igual a antes)", () => {
  const e: EntradaFiltroLeitura = { papel: "dono", isProprietario: true, empresaAtiva: null, matrizId: MATRIZ };
  assert.deepEqual(decidirFiltroLeitura(e), { empresaId: MATRIZ, isFilial: false });
  assert.deepEqual(visiveis(e), ["r-matriz", "r-sem-loja"]);
});

test("dono com filial escolhida: só a filial, sem os registros sem loja", () => {
  const e: EntradaFiltroLeitura = { papel: "dono", isProprietario: true, empresaAtiva: FILIAL_A, matrizId: MATRIZ };
  assert.deepEqual(decidirFiltroLeitura(e), { empresaId: FILIAL_A, isFilial: true });
  assert.deepEqual(visiveis(e), ["r-filial-a"]);
});

test("gerente: só a filial dele", () => {
  const e: EntradaFiltroLeitura = { papel: "gerente", gerenteEmpresaId: FILIAL_B };
  assert.deepEqual(decidirFiltroLeitura(e), { empresaId: FILIAL_B, isFilial: true });
  assert.deepEqual(visiveis(e), ["r-filial-b"]);
});

test("funcionário de filial: só a loja dele (antes: loja + sem loja)", () => {
  const e: EntradaFiltroLeitura = { papel: "funcionario", funcionarioEmpresaId: FILIAL_A, matrizId: MATRIZ };
  assert.deepEqual(decidirFiltroLeitura(e), { empresaId: FILIAL_A, isFilial: true });
  assert.deepEqual(decidirFiltroLeituraAnterior(e), { empresaId: FILIAL_A, isFilial: false });
  assert.deepEqual(visiveis(e), ["r-filial-a"]);
  assert.equal(filtroLeituraPrecisaDaMatriz(e), false);
});

test("funcionário da matriz: matriz + sem loja (antes: sem filtro de loja)", () => {
  const e: EntradaFiltroLeitura = { papel: "funcionario", funcionarioEmpresaId: null, matrizId: MATRIZ };
  assert.equal(filtroLeituraPrecisaDaMatriz(e), true);
  assert.deepEqual(decidirFiltroLeitura(e), { empresaId: MATRIZ, isFilial: false });
  assert.deepEqual(decidirFiltroLeituraAnterior(e), { empresaId: null, isFilial: false });
  assert.deepEqual(visiveis(e), ["r-matriz", "r-sem-loja"]);
});

test("matriz desconhecida: cai no comportamento de antes (sem contexto), nunca vazio", () => {
  for (const matrizId of [null, undefined, ""]) {
    const func: EntradaFiltroLeitura = { papel: "funcionario", funcionarioEmpresaId: null, matrizId };
    assert.deepEqual(decidirFiltroLeitura(func), decidirFiltroLeituraAnterior(func));
    assert.equal(modoFiltroLeitura(decidirFiltroLeitura(func)), "sem_contexto");
    const dono: EntradaFiltroLeitura = { papel: "dono", isProprietario: true, empresaAtiva: null, matrizId };
    assert.deepEqual(decidirFiltroLeitura(dono), { empresaId: null, isFilial: false });
  }
});

test("PROVA: dono comum sem filiais vê exatamente o mesmo de antes", () => {
  const casos: EntradaFiltroLeitura[] = [
    { papel: "dono", isProprietario: false, empresaAtiva: null, matrizId: null },
    { papel: "dono", isProprietario: false, empresaAtiva: null },
    // empresaAtiva residual sem ser proprietário é ignorada, como antes
    { papel: "dono", isProprietario: false, empresaAtiva: FILIAL_A, matrizId: null },
  ];
  for (const e of casos) {
    assert.deepEqual(decidirFiltroLeitura(e), decidirFiltroLeituraAnterior(e));
    assert.deepEqual(decidirFiltroLeitura(e), { empresaId: null, isFilial: false });
  }
});

test("PROVA: dono multiempresa e gerente: mesmo filtro de antes em todos os casos", () => {
  const casos: EntradaFiltroLeitura[] = [
    { papel: "dono", isProprietario: true, empresaAtiva: null, matrizId: MATRIZ },
    { papel: "dono", isProprietario: true, empresaAtiva: FILIAL_A, matrizId: MATRIZ },
    { papel: "dono", isProprietario: true, empresaAtiva: FILIAL_B, matrizId: MATRIZ },
    { papel: "gerente", gerenteEmpresaId: FILIAL_A },
    { papel: "gerente", gerenteEmpresaId: null },
  ];
  for (const e of casos) assert.deepEqual(decidirFiltroLeitura(e), decidirFiltroLeituraAnterior(e), JSON.stringify(e));
});

test("modo do filtro", () => {
  assert.equal(modoFiltroLeitura({ empresaId: FILIAL_A, isFilial: true }), "so_loja");
  assert.equal(modoFiltroLeitura({ empresaId: MATRIZ, isFilial: false }), "matriz_e_sem_loja");
  assert.equal(modoFiltroLeitura({ empresaId: null, isFilial: false }), "sem_contexto");
  assert.equal(modoFiltroLeitura({ empresaId: null, isFilial: true }), "sem_contexto");
});
