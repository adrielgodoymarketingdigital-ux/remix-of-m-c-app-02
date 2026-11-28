// deno test --no-check --no-lock scripts/testes-cancelar-venda-estoque/
// Roda as funções reais de src/lib/vendas/estornoEstoqueVenda.core.ts contra um
// banco em memória (bancoMemoria.ts). Só dados fictícios; nada vai à rede.
import { assertEquals } from "jsr:@std/assert@1";
import { bancoMemoria } from "./bancoMemoria.ts";
import {
  carregarLinhasDaVendaCore,
  deveLiberarImei,
  excluirVendaDevolvendoEstoqueCore,
  liberarImeiDaLinhaCore,
  type LinhaDaVendaParaExcluir,
} from "../../src/lib/vendas/estornoEstoqueVenda.core.ts";
import { linhasParaCancelarVendaInteira } from "../../src/lib/vendas/trocaPDV.ts";

type Linha = Record<string, unknown>;
const U = "dono-teste";
const OUTRO = "outro-dono";
const G = "grupo-1";
const AGORA = "2026-11-28T12:00:00.000Z";
const MOTIVO = "Excluído pelo usuário via dispositivos vendidos";

const aparelho = (id: string, quantidade = 0, extra: Linha = {}): Linha =>
  ({ id, user_id: U, quantidade, vendido: quantidade === 0, deleted_at: null, ...extra });
const imei = (id: string, dispositivo_id: string, numero: string, venda_id: string | null, vendido = true): Linha =>
  ({ id, dispositivo_id, imei: numero, vendido, venda_id });
const venda = (id: string, extra: Linha): Linha => ({
  id, user_id: U, tipo: "dispositivo", grupo_venda: G, dispositivo_id: null, produto_id: null, peca_id: null,
  quantidade: 1, observacoes: null, cancelada: false, parcela_numero: null, imei_dispositivo: null,
  estorno_estoque: null, deleted_at: null, data: AGORA, ...extra,
});

async function excluir(tabelas: Record<string, Linha[]>, falhar?: Parameters<typeof bancoMemoria>[1], grupo: string | null = G, vendaId = "v1") {
  const b = bancoMemoria(tabelas, falhar);
  const linhas = await carregarLinhasDaVendaCore(b.client, { vendaId, grupoVenda: grupo, userId: U });
  const r = await excluirVendaDevolvendoEstoqueCore(b.client, { linhas, motivo: MOTIVO, agoraISO: AGORA });
  return { ...b, r };
}

const porId = (lista: Linha[], id: string) => lista.find((l) => l.id === id)!;
/** O que useDispositivos mostra como IMEI disponível. */
const imeisLivres = (t: Record<string, Linha[]>, disp: string) =>
  t.dispositivo_imeis.filter((i) => i.dispositivo_id === disp && !i.vendido).map((i) => i.imei);

Deno.test("venda com 3 aparelhos excluída devolve os 3 (quantidade somada, vendido=false, IMEIs livres)", async () => {
  const tabelas = {
    dispositivos: [aparelho("d1"), aparelho("d2"), aparelho("d3", 2, { vendido: false })],
    dispositivo_imeis: [imei("i1", "d1", "111", "v1"), imei("i2", "d2", "222", "v2"), imei("i3", "d3", "333", "v3"), imei("i3b", "d3", "334", null, false)],
    vendas: [
      venda("v1", { dispositivo_id: "d1", imei_dispositivo: "111" }),
      venda("v2", { dispositivo_id: "d2", imei_dispositivo: "222" }),
      venda("v3", { dispositivo_id: "d3", imei_dispositivo: "333" }),
    ],
  };
  const { r } = await excluir(tabelas);
  assertEquals(r.status, "ok");
  assertEquals([r.itensDevolvidos, r.unidadesDevolvidas, r.imeisLiberados], [3, 3, 3]);
  assertEquals(tabelas.dispositivos.map((d) => [d.quantidade, d.vendido]), [[1, false], [1, false], [3, false]]);
  assertEquals(tabelas.dispositivo_imeis.map((i) => [i.vendido, i.venda_id]), [[false, null], [false, null], [false, null], [false, null]]);
  assertEquals(imeisLivres(tabelas, "d3").sort(), ["333", "334"]);
  for (const v of tabelas.vendas) {
    assertEquals([v.cancelada, v.estorno_estoque, v.deleted_at, v.motivo_cancelamento], [true, true, AGORA, MOTIVO]);
  }
});

Deno.test("2 aparelhos + 1 produto + 1 peça: devolve os 4, cada um na sua tabela", async () => {
  const tabelas = {
    dispositivos: [aparelho("d1"), aparelho("d2")],
    produtos: [{ id: "p1", user_id: U, quantidade: 5 }],
    pecas: [{ id: "pc1", user_id: U, quantidade: 0 }],
    dispositivo_imeis: [imei("i1", "d1", "111", "v1"), imei("i2", "d2", "222", "v2")],
    vendas: [
      venda("v1", { dispositivo_id: "d1", imei_dispositivo: "111" }),
      venda("v2", { dispositivo_id: "d2", imei_dispositivo: "222" }),
      venda("v3", { tipo: "produto", produto_id: "p1", quantidade: 3 }),
      venda("v4", { tipo: "produto", peca_id: "pc1", quantidade: 2 }),
    ],
  };
  const { r } = await excluir(tabelas);
  assertEquals(r.status, "ok");
  assertEquals([r.itensDevolvidos, r.unidadesDevolvidas, r.imeisLiberados], [4, 7, 2]);
  assertEquals(tabelas.dispositivos.map((d) => [d.quantidade, d.vendido]), [[1, false], [1, false]]);
  assertEquals(tabelas.produtos[0].quantidade, 8);
  assertEquals(tabelas.pecas[0].quantidade, 2);
  assertEquals("vendido" in tabelas.produtos[0], false);
});

Deno.test("pagamento duplo secundário não devolve em dobro (só cancela e apaga)", async () => {
  const tabelas = {
    dispositivos: [aparelho("d1"), aparelho("d2")],
    dispositivo_imeis: [imei("i1", "d1", "111", "v1"), imei("i2", "d2", "222", "v2")],
    vendas: [
      venda("v1", { dispositivo_id: "d1", imei_dispositivo: "111" }),
      venda("v2", { dispositivo_id: "d2", imei_dispositivo: "222" }),
      venda("s1", { dispositivo_id: "d1", observacoes: "pagamento_duplo_secundario", forma_pagamento: "pix" }),
      venda("s2", { dispositivo_id: "d2", observacoes: "pagamento_duplo_secundario", forma_pagamento: "pix" }),
    ],
  };
  const { r } = await excluir(tabelas);
  assertEquals(r.status, "ok");
  assertEquals([r.itensDevolvidos, r.unidadesDevolvidas], [2, 2]);
  assertEquals(tabelas.dispositivos.map((d) => d.quantidade), [1, 1]);
  const s1 = porId(tabelas.vendas, "s1");
  assertEquals([s1.cancelada, s1.deleted_at, s1.estorno_estoque], [true, AGORA, null]);
});

Deno.test("parcelado a receber: estoque volta 1× por item; IMEI preso na última parcela é liberado", async () => {
  // O PDV marca o IMEI em cada parcela: o venda_id final é o da parcela 3.
  const tabelas = {
    dispositivos: [aparelho("d1")],
    dispositivo_imeis: [imei("i1", "d1", "111", "v1-p3")],
    vendas: [1, 2, 3].map((n) => venda(`v1-p${n}`, { dispositivo_id: "d1", imei_dispositivo: "111", parcela_numero: n, total_parcelas: 3 })),
  };
  const { r } = await excluir(tabelas, undefined, G, "v1-p1");
  assertEquals(r.status, "ok");
  assertEquals([r.itensDevolvidos, r.unidadesDevolvidas, r.imeisLiberados], [1, 1, 1]);
  assertEquals(tabelas.dispositivos[0].quantidade, 1);
  assertEquals(tabelas.dispositivo_imeis[0].vendido, false);
  assertEquals(tabelas.vendas.map((v) => v.estorno_estoque), [true, true, true]);
});

Deno.test("quantidade vendida 2 soma 2 (não o 1 fixo de antes)", async () => {
  const tabelas = {
    dispositivos: [aparelho("d1", 1, { vendido: false })],
    dispositivo_imeis: [],
    vendas: [venda("v1", { dispositivo_id: "d1", quantidade: 2 })],
  };
  const { r } = await excluir(tabelas);
  assertEquals(r.unidadesDevolvidas, 2);
  assertEquals(tabelas.dispositivos[0].quantidade, 3);
});

Deno.test("venda sem imei_dispositivo e sem grupo_venda (antiga) não quebra", async () => {
  const tabelas = {
    dispositivos: [aparelho("d1")],
    dispositivo_imeis: [imei("i-outro", "d1", "999", "venda-de-outra")],
    vendas: [venda("v1", { dispositivo_id: "d1", grupo_venda: null }), venda("v-outra", { dispositivo_id: "d1", grupo_venda: null })],
  };
  const { r } = await excluir(tabelas, undefined, null, "v1");
  assertEquals(r.status, "ok");
  assertEquals([r.itensDevolvidos, r.imeisLiberados], [1, 0]);
  assertEquals(tabelas.dispositivos[0].quantidade, 1);
  // IMEI de outra venda fica como está; a outra venda nem é tocada.
  assertEquals(tabelas.dispositivo_imeis[0].vendido, true);
  assertEquals(porId(tabelas.vendas, "v-outra").cancelada, false);
});

Deno.test("só mexe no grupo e no dono certos; linha já cancelada antes não devolve de novo", async () => {
  const tabelas = {
    dispositivos: [aparelho("d1"), aparelho("d2", 1, { vendido: false })],
    dispositivo_imeis: [imei("i1", "d1", "111", "v1")],
    vendas: [
      venda("v1", { dispositivo_id: "d1", imei_dispositivo: "111" }),
      // cancelada antes com estorno (tela de Vendas): estoque já voltou
      venda("v2", { dispositivo_id: "d2", cancelada: true, estorno_estoque: true, data_cancelamento: "2026-11-01" }),
      venda("x1", { dispositivo_id: "d1", grupo_venda: "outro-grupo" }),
      venda("x2", { dispositivo_id: "d1", user_id: OUTRO }),
    ],
  };
  const { r } = await excluir(tabelas);
  assertEquals([r.status, r.itensDevolvidos], ["ok", 1]);
  assertEquals(tabelas.dispositivos.map((d) => d.quantidade), [1, 1]);
  assertEquals(porId(tabelas.vendas, "v2").data_cancelamento, "2026-11-01");
  assertEquals(porId(tabelas.vendas, "v2").deleted_at, AGORA);
  assertEquals([porId(tabelas.vendas, "x1").cancelada, porId(tabelas.vendas, "x1").deleted_at], [false, null]);
  assertEquals([porId(tabelas.vendas, "x2").cancelada, porId(tabelas.vendas, "x2").deleted_at], [false, null]);
});

Deno.test("excluir duas vezes (duplo clique) não devolve em dobro", async () => {
  const tabelas = {
    dispositivos: [aparelho("d1")],
    dispositivo_imeis: [imei("i1", "d1", "111", "v1")],
    vendas: [venda("v1", { dispositivo_id: "d1", imei_dispositivo: "111" })],
  };
  const b = bancoMemoria(tabelas);
  const linhas = await carregarLinhasDaVendaCore(b.client, { vendaId: "v1", grupoVenda: G, userId: U });
  const [r1, r2] = await Promise.all([
    excluirVendaDevolvendoEstoqueCore(b.client, { linhas, motivo: MOTIVO, agoraISO: AGORA }),
    excluirVendaDevolvendoEstoqueCore(b.client, { linhas: linhas.map((l) => ({ ...l })), motivo: MOTIVO, agoraISO: AGORA }),
  ]);
  assertEquals(r1.itensDevolvidos + r2.itensDevolvidos, 1);
  assertEquals(tabelas.dispositivos[0].quantidade, 1);
});

Deno.test("falha ao devolver o estoque: desfaz o cancelamento da linha e para (repetir é seguro)", async () => {
  const tabelas = {
    dispositivos: [aparelho("d1"), aparelho("d2")],
    dispositivo_imeis: [imei("i1", "d1", "111", "v1"), imei("i2", "d2", "222", "v2")],
    vendas: [venda("v1", { dispositivo_id: "d1", imei_dispositivo: "111" }), venda("v2", { dispositivo_id: "d2", imei_dispositivo: "222" })],
  };
  let updates = 0; // a 2ª gravação em dispositivos (aparelho d2) falha
  const falhar = (t: string, op: string) => (t === "dispositivos" && op === "update" && ++updates === 2 ? "rede caiu" : null);
  const { r } = await excluir(tabelas, falhar);
  assertEquals([r.status, r.itensDevolvidos], ["erro", 1]);
  if (r.status === "erro") assertEquals(r.etapa, "devolver ao estoque");
  const v2 = porId(tabelas.vendas, "v2");
  assertEquals([v2.cancelada, v2.estorno_estoque, v2.deleted_at], [false, null, null]);
  assertEquals(porId(tabelas.vendas, "v1").deleted_at, null); // soft delete é o último passo

  // Repetir: v1 já cancelada é pulada (não devolve de novo); v2 vai agora.
  const { r: r2 } = await excluir(tabelas);
  assertEquals([r2.status, r2.itensDevolvidos], ["ok", 1]);
  assertEquals(tabelas.dispositivos.map((d) => d.quantidade), [1, 1]);
  assertEquals(tabelas.vendas.map((v) => v.deleted_at), [AGORA, AGORA]);
});

Deno.test("falha ao liberar IMEI: estoque e venda seguem; erro volta para o aviso", async () => {
  const tabelas = {
    dispositivos: [aparelho("d1")],
    dispositivo_imeis: [imei("i1", "d1", "111", "v1")],
    vendas: [venda("v1", { dispositivo_id: "d1", imei_dispositivo: "111" })],
  };
  const { r } = await excluir(tabelas, (t, op) => (t === "dispositivo_imeis" && op === "update" ? "permission denied" : null));
  assertEquals(r.status, "ok");
  assertEquals([r.itensDevolvidos, r.imeisLiberados, r.errosImei], [1, 0, ["permission denied"]]);
  assertEquals(tabelas.dispositivos[0].quantidade, 1);
});

Deno.test("item que não existe mais no estoque: linha cancelada sem devolver, contado no aviso", async () => {
  const tabelas = {
    dispositivos: [],
    dispositivo_imeis: [],
    vendas: [venda("v1", { dispositivo_id: "d-apagado" })],
  };
  const { r } = await excluir(tabelas);
  assertEquals([r.status, r.itensDevolvidos, r.itensNaoEncontrados], ["ok", 0, 1]);
  assertEquals([tabelas.vendas[0].cancelada, tabelas.vendas[0].estorno_estoque], [true, false]);
});

Deno.test("depois de liberado, vender o mesmo IMEI de novo funciona (e cancelar de novo libera de novo)", async () => {
  const tabelas: Record<string, Linha[]> = {
    dispositivos: [aparelho("d1")],
    dispositivo_imeis: [imei("i1", "d1", "111", "v1")],
    vendas: [venda("v1", { dispositivo_id: "d1", imei_dispositivo: "111" })],
  };
  await excluir(tabelas);
  assertEquals(imeisLivres(tabelas, "d1"), ["111"]);

  // Nova venda pelo PDV (mesmas gravações do PDV.tsx).
  const b = bancoMemoria(tabelas);
  tabelas.vendas.push(venda("v9", { grupo_venda: "grupo-2", dispositivo_id: "d1", imei_dispositivo: "111" }));
  await b.client.from("dispositivo_imeis").update({ vendido: true, venda_id: "v9" }).eq("dispositivo_id", "d1").eq("imei", "111");
  await b.client.from("dispositivos").update({ quantidade: 0, vendido: true }).eq("id", "d1");
  assertEquals(imeisLivres(tabelas, "d1"), []);

  const { r } = await excluir(tabelas, undefined, "grupo-2", "v9");
  assertEquals([r.itensDevolvidos, r.imeisLiberados], [1, 1]);
  assertEquals(imeisLivres(tabelas, "d1"), ["111"]);
  assertEquals(tabelas.dispositivos[0].quantidade, 1);
});

// ── cancelarVenda (useVendas.ts) ─────────────────────────────────────────────

Deno.test("cancelarVenda: só libera IMEI com o estorno marcado, em aparelho, na linha que estorna", () => {
  assertEquals(deveLiberarImei({ estornarEstoque: true, estornar: true, tipo: "dispositivo" }), true);
  assertEquals(deveLiberarImei({ estornarEstoque: false, estornar: true, tipo: "dispositivo" }), false);
  assertEquals(deveLiberarImei({ estornarEstoque: true, estornar: false, tipo: "dispositivo" }), false);
  assertEquals(deveLiberarImei({ estornarEstoque: true, estornar: true, tipo: "produto" }), false);
});

/** Mesmo laço do cancelarVenda (só a parte do IMEI). */
async function laçoCancelarVenda(tabelas: Record<string, Linha[]>, linhas: { linha: Linha; estornar: boolean }[], estornarEstoque: boolean) {
  const b = bancoMemoria(tabelas);
  let liberados = 0;
  for (const { linha, estornar } of linhas) {
    if (deveLiberarImei({ estornarEstoque, estornar, tipo: String(linha.tipo) })) {
      liberados += await liberarImeiDaLinhaCore(b.client, { id: String(linha.id), tipo: String(linha.tipo), user_id: U });
    }
  }
  return liberados;
}

Deno.test("cancelarVenda com estornar=false não libera IMEI", async () => {
  const tabelas = {
    dispositivo_imeis: [imei("i1", "d1", "111", "v1")],
    vendas: [venda("v1", { dispositivo_id: "d1", imei_dispositivo: "111" })],
  };
  assertEquals(await laçoCancelarVenda(tabelas, [{ linha: tabelas.vendas[0], estornar: true }], false), 0);
  assertEquals([tabelas.dispositivo_imeis[0].vendido, tabelas.dispositivo_imeis[0].venda_id], [true, "v1"]);
  assertEquals(await laçoCancelarVenda(tabelas, [{ linha: tabelas.vendas[0], estornar: true }], true), 1);
  assertEquals([tabelas.dispositivo_imeis[0].vendido, tabelas.dispositivo_imeis[0].venda_id], [false, null]);
});

Deno.test("venda com troca (cancelada inteira): cada linha libera seu IMEI uma vez só", async () => {
  const vendas = [
    ...[1, 2].map((n) => venda(`a-p${n}`, { dispositivo_id: "d1", imei_dispositivo: "111", parcela_numero: n, total_parcelas: 2 })),
    venda("b", { dispositivo_id: "d2", imei_dispositivo: "222" }),
    venda("s", { dispositivo_id: "d2", observacoes: "pagamento_duplo_secundario" }),
  ];
  const tabelas = {
    dispositivo_imeis: [imei("i1", "d1", "111", "a-p2"), imei("i2", "d2", "222", "b")],
    vendas,
  };
  const linhas = linhasParaCancelarVendaInteira(vendas as unknown as LinhaDaVendaParaExcluir[]) as unknown as { linha: Linha; estornar: boolean }[];
  assertEquals(await laçoCancelarVenda(tabelas, linhas, true), 2);
  assertEquals(tabelas.dispositivo_imeis.map((i) => i.vendido), [false, false]);
  // Repetir não libera nada a mais.
  assertEquals(await laçoCancelarVenda(tabelas, linhas, true), 0);
});

Deno.test("liberar IMEI não toca IMEI do mesmo aparelho preso em OUTRA venda", async () => {
  const tabelas = {
    dispositivo_imeis: [imei("i1", "d1", "111", "v1"), imei("i2", "d1", "111", "venda-x")],
    vendas: [venda("v1", { dispositivo_id: "d1", imei_dispositivo: "111" })],
  };
  assertEquals(await laçoCancelarVenda(tabelas, [{ linha: tabelas.vendas[0], estornar: true }], true), 1);
  assertEquals(tabelas.dispositivo_imeis.map((i) => i.vendido), [false, true]);
});
