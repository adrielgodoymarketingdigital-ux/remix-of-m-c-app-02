// TZ=UTC deno test --no-check --no-lock --config scripts/testes-troca-pdv-gravacao/deno.json scripts/testes-troca-pdv-gravacao/
// Recibo REABERTO de uma venda com troca: carregarTrocaRecibo (recibo de sempre:
// Vendas e Dispositivos) e carregarReciboVenda (recibo novo) contra o banco
// falso, que só devolve as colunas pedidas no select. Dados fictícios; sem rede.
import { assertEquals } from "jsr:@std/assert@1";
import { carregarTrocaRecibo } from "../../src/lib/vendas/carregarTrocaRecibo.ts";
import { carregarReciboVenda } from "../../src/lib/vendas/carregarReciboVenda.ts";
import { montarBlocoTrocaRecibo, textoBlocoTrocaRecibo } from "../../src/lib/vendas/reciboTroca.ts";
import { entradaDasLinhas, montarReciboVenda } from "../../src/lib/vendas/reciboVendaModelo.ts";
import * as antes from "../testes-troca-pdv/referencia/reciboTrocaAntesF2b.ts";
import { reiniciarBanco, selects } from "./supabaseFalso.ts";

const GRUPO = "grupo-teste";
const aparelhoRecebido = (imei2: string | null) => ({
  id: "disp-troca", marca: "Marca Teste", modelo: "Modelo Teste", capacidade_gb: 128, cor: "Preto",
  imei: "111111111111111", imei2, condicao: "usado", fotos: [], foto_url: null,
});
const tabelas = (imei2: string | null) => ({
  vendas_trocas: [{ grupo_venda: GRUPO, valor_entrada: 500, cancelada: false, dispositivo_entrada_id: "disp-troca", valor_devolvido: 0, forma_devolucao: null }],
  dispositivos: [aparelhoRecebido(imei2)],
  vendas: [{
    id: "v1", grupo_venda: GRUPO, tipo: "produto", produto_id: "p1", quantidade: 1, total: 800, forma_pagamento: "pix",
    data: "2026-11-08T15:00:00.000Z", numero_venda: "VD-000001", valor_troca: 500, deleted_at: null,
  }],
  produtos: [{ id: "p1", nome: "Produto Teste", sku: null, fotos: [] }],
});
const ctx = { loja: { nome_loja: "Loja Teste" }, origemApp: "http://localhost" };

Deno.test("carregarTrocaRecibo: com IMEI 2 → recibo mostra a linha IMEI 2", async () => {
  reiniciarBanco({ tabelas: tabelas("222222222222222") });
  const troca = await carregarTrocaRecibo(GRUPO);
  assertEquals(troca?.aparelho?.imei2, "222222222222222");
  const linhas = textoBlocoTrocaRecibo(montarBlocoTrocaRecibo({ troca, totalVenda: 800, formaPagamentoLabel: "PIX" })!);
  assertEquals(linhas.slice(2, 4), ["IMEI: 111111111111111", "IMEI 2: 222222222222222"]);
  assertEquals(selects.find((s) => s.tabela === "dispositivos")!.colunas.includes("imei2"), true);
});

Deno.test("carregarTrocaRecibo: troca antiga sem IMEI 2 → recibo idêntico ao de antes", async () => {
  reiniciarBanco({ tabelas: tabelas(null) });
  const troca = await carregarTrocaRecibo(GRUPO);
  const p = { troca, totalVenda: 800, formaPagamentoLabel: "PIX" };
  assertEquals(montarBlocoTrocaRecibo(p), antes.montarBlocoTrocaRecibo(p));
  assertEquals(textoBlocoTrocaRecibo(montarBlocoTrocaRecibo(p)!), antes.textoBlocoTrocaRecibo(antes.montarBlocoTrocaRecibo(p)!));
});

Deno.test("carregarReciboVenda (recibo novo reaberto): com IMEI 2 → troca.imei2 no modelo", async () => {
  reiniciarBanco({ tabelas: tabelas("222222222222222") });
  const carregados = await carregarReciboVenda({ vendaId: "v1", grupoVenda: GRUPO });
  assertEquals(carregados?.troca?.aparelho?.imei2, "222222222222222");
  const modelo = montarReciboVenda(entradaDasLinhas(carregados!, ctx));
  assertEquals([modelo.troca?.imei, modelo.troca?.imei2], ["111111111111111", "222222222222222"]);
  assertEquals(modelo.troca?.condicao != null, true);
});

Deno.test("carregarReciboVenda: troca antiga sem IMEI 2 → modelo sem a chave imei2", async () => {
  for (const imei2 of [null, "", "  "]) {
    reiniciarBanco({ tabelas: tabelas(imei2) });
    const carregados = await carregarReciboVenda({ vendaId: "v1", grupoVenda: GRUPO });
    const modelo = montarReciboVenda(entradaDasLinhas(carregados!, ctx));
    assertEquals(modelo.troca?.imei, "111111111111111");
    assertEquals("imei2" in modelo.troca!, false);
  }
});
