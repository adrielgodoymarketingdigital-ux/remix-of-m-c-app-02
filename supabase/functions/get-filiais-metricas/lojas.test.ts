// deno test supabase/functions/get-filiais-metricas/lojas.test.ts
// Regra de loja da tela Multi Empresas (só leitura). Dados fictícios.
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  agruparRegistrosPorLoja,
  filtrarRegistrosDaLoja,
  filtroLeituraLoja,
  registroDaLoja,
  type LojaLeitura,
} from "./lojas.ts";

const MATRIZ: LojaLeitura = { id: "emp-matriz", tipo: "matriz" };
const FILIAL_A: LojaLeitura = { id: "emp-filial-a", tipo: "filial" };
const FILIAL_B: LojaLeitura = { id: "emp-filial-b", tipo: "filial" };
const LOJAS = [MATRIZ, FILIAL_A, FILIAL_B];

const registros = [
  { id: "v1", empresa_id: "emp-matriz", total: 100 },
  { id: "v2", empresa_id: null, total: 50 },          // sem loja → matriz
  { id: "v3", empresa_id: undefined, total: 5 },      // sem loja → matriz
  { id: "v4", empresa_id: "emp-filial-a", total: 200 },
  { id: "v5", empresa_id: "emp-filial-a", total: 20 },
  { id: "v6", empresa_id: "emp-filial-b", total: 300 },
  { id: "v7", empresa_id: "emp-desativada", total: 999 }, // loja fora da lista
];

const soma = (lista: { total: number }[]) => lista.reduce((s, r) => s + r.total, 0);

Deno.test("registro sem loja conta na matriz e em nenhuma filial", () => {
  for (const vazio of [null, undefined, ""]) {
    assertEquals(registroDaLoja(vazio, MATRIZ), true);
    assertEquals(registroDaLoja(vazio, FILIAL_A), false);
    assertEquals(registroDaLoja(vazio, FILIAL_B), false);
  }
});

Deno.test("matriz não inclui registros das filiais", () => {
  const daMatriz = filtrarRegistrosDaLoja(registros, MATRIZ).map((r) => r.id);
  assertEquals(daMatriz, ["v1", "v2", "v3"]);
});

Deno.test("filial lê só os próprios registros, sem os sem-loja", () => {
  assertEquals(filtrarRegistrosDaLoja(registros, FILIAL_A).map((r) => r.id), ["v4", "v5"]);
  assertEquals(filtrarRegistrosDaLoja(registros, FILIAL_B).map((r) => r.id), ["v6"]);
});

Deno.test("cada registro cai em no máximo uma loja (filial não soma duas vezes)", () => {
  const grupos = agruparRegistrosPorLoja(registros, LOJAS);
  const contagem: Record<string, number> = {};
  for (const lista of Object.values(grupos)) {
    for (const r of lista) contagem[r.id] = (contagem[r.id] ?? 0) + 1;
  }
  for (const r of registros) {
    const esperado = r.id === "v7" ? undefined : 1;
    assertEquals(contagem[r.id], esperado, `registro ${r.id}`);
  }
});

Deno.test("soma dos grupos confere com o total das lojas ativas", () => {
  const grupos = agruparRegistrosPorLoja(registros, LOJAS);
  assertEquals(soma(grupos[MATRIZ.id]), 155);
  assertEquals(soma(grupos[FILIAL_A.id]), 220);
  assertEquals(soma(grupos[FILIAL_B.id]), 300);
  const totalDosCards = Object.values(grupos).reduce((s, lista) => s + soma(lista), 0);
  const totalEsperado = soma(registros.filter((r) => r.id !== "v7"));
  assertEquals(totalDosCards, totalEsperado);
  assertEquals(totalDosCards, 675);
});

Deno.test("filtro da consulta segue a mesma regra", () => {
  assertEquals(filtroLeituraLoja(MATRIZ), { empresaId: "emp-matriz", incluirSemLoja: true });
  assertEquals(filtroLeituraLoja(FILIAL_A), { empresaId: "emp-filial-a", incluirSemLoja: false });
});
