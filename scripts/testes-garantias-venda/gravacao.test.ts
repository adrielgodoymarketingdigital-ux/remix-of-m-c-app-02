// node --test scripts/testes-garantias-venda/
// Fase B: gravação da venda com a garantia escolhida. Roda os trechos REAIS de
// src/pages/PDV.tsx (bloco do texto congelado + objeto vendaData) com o
// supabase-js de verdade falando com um PostgREST simulado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarBloco, avaliarObjeto, fonte, objetoLiteral, supabaseSimulado } from "./apoio.ts";
import { garantiasPadraoVirtuais } from "../../src/lib/garantias/garantias.ts";
import { textoPadraoGarantia } from "../../src/lib/garantias/textoPadrao.ts";
import * as venda from "../../src/lib/garantias/vendaGarantia.ts";
import { repositorioTextosSupabase } from "../../src/lib/garantias/textosVendaSupabase.ts";

const PDV = fonte("src/pages/PDV.tsx", "branch");
const INICIO_BLOCO = "let textosGarantia";
const FIM_BLOCO = "for (const [idxItem, item] of itensCarrinho.entries()) {";
const iBloco = PDV.indexOf(INICIO_BLOCO);
const BLOCO = PDV.slice(iBloco, PDV.indexOf(FIM_BLOCO, iBloco));
const LINHA = objetoLiteral(PDV, "const vendaData = {", PDV.indexOf("for (let parcIdx = 0; parcIdx < totalParcelas; parcIdx++)"));

const DONO = "00000000-0000-4000-8000-00000000d0n0";
const FUNC = "00000000-0000-4000-8000-0000000f0c00";

/** Escopo fixo do laço de vendas (valores fictícios de uma venda simples à vista). */
export function escopoLinha(extra: Record<string, unknown>) {
  return {
    tipoParaBanco: "dispositivo", clienteId: null, dispositivoId: "disp-1", produtoId: null, pecaId: null,
    duplo: false, totalBrutoItem: 3000, valorPorParcela: 3000, isParceladoReceber: false, totalParcelas: 1,
    formaBanco: "pix", userIdParaVenda: DONO, empresaIdPDV: null, dataPrevisao: null, forma: "pix",
    grupoVendaId: "grupo-1", descontoPorParcela: 0, funcionarioSelecionadoId: null, parcIdx: 0,
    sufixoForma: false, nomeForma: "Pix", segundaFormaPagamento: "", resolverFormaPagamentoBanco: (f: string) => f,
    valorSegundaPagamento: 0, segundaPorItem: null, idxItem: 0, trocaPorLinha: null,
    camposGarantiaVenda: venda.camposGarantiaVenda,
    ...extra,
  };
}

const aparelho = (garantia_escolhida?: venda.EscolhaGarantia, extra: Record<string, unknown> = {}) => ({
  id: "disp-1", tipo: "dispositivo", nome: "Aparelho Exemplo", preco: 3000, custo: 2000, quantidade: 1, estoque: 1,
  dispositivo_id: "disp-1", imei_dispositivo: "350000000000000", tempo_garantia: garantia_escolhida && garantia_escolhida.meses > 0 ? garantia_escolhida.meses : undefined,
  ...(garantia_escolhida ? { garantia_escolhida } : {}), ...extra,
});

/** Simula finalizarVenda: o bloco real do texto + o vendaData real, por item e parcela. */
async function simularVenda(itens: Record<string, unknown>[], op: Parameters<typeof supabaseSimulado>[0] = {}, quem = { user: { id: DONO }, userIdParaVenda: DONO }, parcelas = 1, sobrescrever: Record<string, unknown> = {}) {
  const sim = supabaseSimulado(op);
  const textosGarantia = await avaliarBloco(BLOCO, "textosGarantia", {
    itensCarrinho: itens, supabase: sim.cliente, user: quem.user, userIdParaVenda: quem.userIdParaVenda,
    congelarTextosDaVenda: venda.congelarTextosDaVenda, repositorioTextosSupabase, textoACongelar: venda.textoACongelar,
    console: { error: () => {} }, ...sobrescrever,
  }) as venda.ResultadoTextosVenda;
  const linhas = [];
  for (const [idxItem, item] of itens.entries()) {
    for (let parcIdx = 0; parcIdx < parcelas; parcIdx++) {
      linhas.push(avaliarObjeto(LINHA, escopoLinha({
        item, idxItem, parcIdx, textosGarantia, userIdParaVenda: quem.userIdParaVenda,
        tipoParaBanco: item.tipo === "dispositivo" ? "dispositivo" : "produto",
        isParceladoReceber: parcelas > 1, totalParcelas: parcelas, valorPorParcela: 3000 / parcelas, forma: parcelas > 1 ? "a_receber" : "pix",
      })));
    }
  }
  return { textosGarantia, linhas, log: sim.log, banco: sim.linhas };
}

const LOJA6 = { garantia_id: "g-6", nome: "Garantia 6 meses", meses: 6, texto: "TERMO 6 {{garantia_meses}} {{cliente}}", tipo: "loja" as const };
const garantiaDe = (l: Record<string, unknown>) => Object.fromEntries(Object.entries(l).filter(([k]) => k.startsWith("garantia") || k === "tempo_garantia"));
const semEscrita = (log: { metodo: string }[]) => log.every((r) => r.metodo === "GET" || r.metodo === "POST");

test("garantia da loja: 1 texto congelado em nome do dono, colunas na venda e tempo_garantia legado", async () => {
  const r = await simularVenda([aparelho(LOJA6)]);
  const posts = r.log.filter((x) => x.metodo === "POST");
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0].corpo, { user_id: DONO, texto: LOJA6.texto });
  assert.deepEqual(garantiaDe(r.linhas[0]), { tempo_garantia: 6, garantia_id: "g-6", garantia_nome: "Garantia 6 meses", garantia_meses: 6, garantia_texto_id: "texto-1" });
  assert.equal(r.textosGarantia.falhas, 0);
  assert.ok(semEscrita(r.log), "nunca PATCH/DELETE");
});

test("'Sem garantia' (0 meses): nenhum texto congelado, mesmo que a garantia tenha texto", async () => {
  const r = await simularVenda([aparelho({ garantia_id: "g-sem", nome: "Sem garantia", meses: 0, texto: "DECLARAÇÃO SEM GARANTIA", tipo: "loja" })]);
  assert.equal(r.log.length, 0, "nem consulta");
  assert.deepEqual(garantiaDe(r.linhas[0]), { tempo_garantia: null, garantia_id: "g-sem", garantia_nome: "Sem garantia", garantia_meses: 0, garantia_texto_id: null });
});

test("personalizada: texto padrão da lib para o prazo, sem garantia_id", async () => {
  const e = venda.escolhaPersonalizada(4)!;
  const r = await simularVenda([aparelho(e)]);
  assert.deepEqual(r.log.filter((x) => x.metodo === "POST").map((x) => x.corpo), [{ user_id: DONO, texto: textoPadraoGarantia(4) }]);
  assert.deepEqual(garantiaDe(r.linhas[0]), { tempo_garantia: 4, garantia_id: null, garantia_nome: "Personalizada (4 meses)", garantia_meses: 4, garantia_texto_id: "texto-1" });
});

test("padrão virtual (loja sem garantias): sem garantia_id, texto padrão congelado", async () => {
  const e = venda.escolhaDeGarantia(garantiasPadraoVirtuais()[3]); // 12 meses
  const r = await simularVenda([aparelho(e)]);
  assert.equal(r.log.filter((x) => x.metodo === "POST").length, 1);
  assert.deepEqual(garantiaDe(r.linhas[0]), { tempo_garantia: 12, garantia_id: null, garantia_nome: "Garantia 12 meses", garantia_meses: 12, garantia_texto_id: "texto-1" });
});

test("venda parcelada: várias linhas com o MESMO garantia_texto_id e UM insert de texto", async () => {
  const r = await simularVenda([aparelho(LOJA6)], {}, undefined, 4);
  assert.equal(r.linhas.length, 4);
  assert.equal(r.log.filter((x) => x.metodo === "POST").length, 1);
  assert.deepEqual(new Set(r.linhas.map((l) => l.garantia_texto_id)), new Set(["texto-1"]));
  assert.deepEqual(r.linhas.map((l) => l.parcela_numero), [1, 2, 3, 4]);
  assert.ok(r.linhas.every((l) => l.garantia_meses === 6 && l.tempo_garantia === 6));
});

test("dois aparelhos com o mesmo texto: 1 insert, mesmo id; textos diferentes: 1 cada", async () => {
  const outro = { ...LOJA6, garantia_id: "g-12", nome: "G12", meses: 12, texto: "TERMO 12" };
  const r = await simularVenda([aparelho(LOJA6), aparelho(LOJA6, { id: "disp-2" }), aparelho(outro, { id: "disp-3" })]);
  assert.equal(r.log.filter((x) => x.metodo === "POST").length, 2);
  assert.deepEqual(r.linhas.map((l) => l.garantia_texto_id), ["texto-1", "texto-1", "texto-2"]);
});

test("texto repetido do dono: reaproveita (nenhum insert, nunca atualiza)", async () => {
  const r = await simularVenda([aparelho(LOJA6)], { existentes: [{ id: "texto-antigo", user_id: DONO, texto: LOJA6.texto }] });
  assert.equal(r.log.filter((x) => x.metodo !== "GET").length, 0, "sem POST/PATCH/DELETE");
  assert.equal(r.linhas[0].garantia_texto_id, "texto-antigo");
  assert.equal(r.banco.length, 1);
});

test("md5 igual com texto DIFERENTE (colisão): não reaproveita o texto errado; a venda segue sem texto", async () => {
  const { createHash } = await import("node:crypto");
  const md5 = createHash("md5").update(LOJA6.texto, "utf8").digest("hex");
  const r = await simularVenda([aparelho(LOJA6)], { existentes: [{ id: "texto-errado", user_id: DONO, texto: "OUTRO CONTEÚDO", texto_md5: md5 }] });
  assert.equal(r.linhas[0].garantia_texto_id, null);
  assert.equal(r.textosGarantia.falhas, 1);
  assert.equal(r.log.filter((x) => x.metodo !== "GET").length, 0);
});

test("mesmo texto, mas de OUTRO dono: não reaproveita; grava um do dono", async () => {
  const r = await simularVenda([aparelho(LOJA6)], { existentes: [{ id: "texto-de-outro", user_id: "outro-dono", texto: LOJA6.texto }] });
  assert.equal(r.linhas[0].garantia_texto_id, "texto-1");
});

test("corrida (outra venda gravou o mesmo texto entre a busca e o insert): reaproveita o dela", async () => {
  const r = await simularVenda([aparelho(LOJA6)], { falhaInsert: "corrida" });
  assert.equal(r.linhas[0].garantia_texto_id, "texto-da-outra-venda");
  assert.equal(r.textosGarantia.falhas, 0);
  assert.deepEqual(r.log.map((x) => x.metodo), ["GET", "POST", "GET"]);
});

test("erro no insert do texto: a venda segue (nome/prazo gravados, texto nulo) e conta a falha; o outro item não é afetado", async () => {
  const outro = { ...LOJA6, texto: "OUTRO TEXTO" };
  const r = await simularVenda([aparelho(LOJA6), aparelho(outro, { id: "disp-2" })], { existentes: [{ id: "texto-ok", user_id: DONO, texto: "OUTRO TEXTO" }], falhaInsert: "erro500" });
  assert.equal(r.textosGarantia.falhas, 1);
  assert.deepEqual(garantiaDe(r.linhas[0]), { tempo_garantia: 6, garantia_id: "g-6", garantia_nome: "Garantia 6 meses", garantia_meses: 6, garantia_texto_id: null });
  assert.equal(r.linhas[1].garantia_texto_id, "texto-ok");
});

test("erro na leitura do texto: a venda segue com aviso", async () => {
  const r = await simularVenda([aparelho(LOJA6)], { falhaBusca: true });
  assert.equal(r.textosGarantia.falhas, 1);
  assert.equal(r.linhas[0].garantia_texto_id, null);
  assert.equal(r.linhas[0].garantia_meses, 6);
});

test("se a gravação do texto lançar (qualquer erro inesperado), o PDV segue: falhas = itens com texto", async () => {
  const r = await simularVenda([aparelho(LOJA6), aparelho(), { tipo: "produto", id: "p1", nome: "Capinha" }], {}, undefined, 1, {
    congelarTextosDaVenda: async () => { throw new Error("falha inesperada"); },
  });
  assert.equal(r.textosGarantia.falhas, 1);
  assert.equal(r.linhas[0].garantia_texto_id, null);
});

test("funcionário vendendo: o texto é gravado e procurado em nome do DONO", async () => {
  const r = await simularVenda([aparelho(LOJA6)], {}, { user: { id: FUNC }, userIdParaVenda: DONO });
  const post = r.log.find((x) => x.metodo === "POST");
  assert.equal((post?.corpo as { user_id: string }).user_id, DONO);
  assert.ok(r.log.filter((x) => x.metodo === "GET").every((x) => x.busca.includes(`user_id=eq.${DONO}`)));
  assert.equal(r.linhas[0].user_id, DONO);
});

test("produto/peça com 'garantia_escolhida' (não deveria existir): nada de texto nem de colunas novas", async () => {
  const r = await simularVenda([{ tipo: "produto", id: "p1", nome: "Capinha", preco: 50, quantidade: 1, garantia_escolhida: LOJA6 }]);
  assert.equal(r.log.length, 0);
  assert.equal(Object.keys(r.linhas[0]).some((k) => k.startsWith("garantia")), false);
  assert.equal(r.linhas[0].tempo_garantia, null);
});

test("fluxo antigo (nenhum item com escolha nova): nenhuma consulta e nenhuma coluna nova", async () => {
  const r = await simularVenda([aparelho(undefined, { tempo_garantia: 3 }), { tipo: "produto", id: "p1", nome: "Capinha", preco: 50, quantidade: 1 }]);
  assert.equal(r.log.length, 0);
  assert.ok(r.linhas.every((l) => !Object.keys(l).some((k) => k.startsWith("garantia"))));
  assert.equal(r.linhas[0].tempo_garantia, 3);
});
