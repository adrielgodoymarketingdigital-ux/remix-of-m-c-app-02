// deno test --no-check --allow-read scripts/testes-crm-leads/
// Fase 2A: ação "gasto_meta" da Edge Function crm-leads com banco FALSO
// (sem rede, sem Supabase). Prova segredo, payload inválido, limites,
// duplicado no lote, mapeamento das rejeições do banco, idempotência do
// reenvio (o handler repassa igual) e que o log não leva o corpo nem o segredo.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { criarHandler, type RpcCliente } from "../../supabase/functions/crm-leads/handler.ts";
import { MAX_ITENS_GASTO, normalizarGastoMeta } from "../../supabase/functions/crm-leads/contrato.ts";

const SEGREDO = "g".repeat(40);
const HOJE = "2026-11-20";

function montar(banco?: (itens: unknown[]) => unknown) {
  const chamadas: { fn: string; args?: Record<string, unknown> }[] = [];
  const logs: string[] = [];
  const erros: string[] = [];
  // Banco falso com a mesma semântica de upsert por (ad_id, data).
  const linhas = new Map<string, Record<string, unknown>>();
  const db: RpcCliente = {
    rpc(fn, args) {
      chamadas.push({ fn, args });
      if (fn !== "crm_gravar_gasto_meta") return Promise.resolve({ data: null, error: { code: "42883" } });
      const itens = (args?.p_itens ?? []) as Record<string, unknown>[];
      if (banco) return Promise.resolve({ data: banco(itens), error: null });
      let inseridos = 0, atualizados = 0;
      for (const it of itens) {
        const k = `${it.ad_id}|${it.data}`;
        if (linhas.has(k)) atualizados++; else inseridos++;
        linhas.set(k, it);
      }
      return Promise.resolve({ data: { inseridos, atualizados, rejeitadas: [] }, error: null });
    },
  };
  const original = console.error;
  console.error = (...a: unknown[]) => { erros.push(a.map(String).join(" ")); };
  const handler = criarHandler({ segredo: SEGREDO, db: () => db, hojeBrasilia: () => HOJE, log: (m, d) => logs.push(m + " " + JSON.stringify(d)) });
  const pedir = async (corpo: unknown, segredo = SEGREDO) => {
    const r = await handler(new Request("http://local/crm-leads", {
      method: "POST", headers: { "x-crm-secret": segredo }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    }));
    return { status: r.status, corpo: await r.json() };
  };
  const fim = () => { console.error = original; };
  return { pedir, chamadas, logs, erros, linhas, fim };
}

const item = (over: Record<string, unknown> = {}) => ({
  ad_id: "120000000000001", data: "2026-11-19", gasto_centavos: 12345, impressoes: 1000, cliques: 30, conversas_meta: 4, ...over,
});

Deno.test("gasto_meta: segredo errado = 401 e o banco não é chamado", async () => {
  const t = montar();
  assertEquals((await t.pedir({ acao: "gasto_meta", itens: [item()] }, "errado")).status, 401);
  assertEquals((await t.pedir({ acao: "gasto_meta", itens: [item()] }, SEGREDO.slice(0, 39))).status, 401);
  assertEquals(t.chamadas.length, 0);
  t.fim();
});

Deno.test("gasto_meta: envelope — sem itens 400, 101 itens 413 com max 100, JSON quebrado 400", async () => {
  const t = montar();
  assertEquals(await t.pedir({ acao: "gasto_meta" }), { status: 400, corpo: { erro: "itens_vazios" } });
  const muitos = Array.from({ length: MAX_ITENS_GASTO + 1 }, (_, i) => item({ ad_id: `A${i}` }));
  assertEquals(await t.pedir({ acao: "gasto_meta", itens: muitos }), { status: 413, corpo: { erro: "lote_grande", max_itens: 100 } });
  assertEquals((await t.pedir("{nao json")).status, 400);
  assertEquals(t.chamadas.length, 0);
  // 100 itens passam
  assertEquals((await t.pedir({ acao: "gasto_meta", itens: muitos.slice(0, 100) })).status, 200);
  t.fim();
});

Deno.test("gasto_meta: cada item inválido é rejeitado com índice e motivo; os bons vão ao banco", async () => {
  const t = montar();
  const casos: [unknown, string][] = [
    [item({ ad_id: "abc def" }), "ad_id_invalido"],
    [item({ ad_id: "x".repeat(65) }), "ad_id_invalido"],
    [item({ ad_id: 120000000000001 }), "ad_id_invalido"],
    [item({ campaign_id: "camp anha" }), "campaign_id_invalido"],
    [item({ campaign_id: 123 }), "campaign_id_invalido"],
    [item({ data: "2026-02-30" }), "data_invalida"],
    [item({ data: "20/11/2026" }), "data_invalida"],
    [item({ data: "2026-11-22" }), "data_fora_da_janela"],      // hoje + 2
    [item({ data: "2025-10-15" }), "data_fora_da_janela"],      // > 400 dias
    [item({ gasto_centavos: -1 }), "gasto_invalido"],
    [item({ gasto_centavos: 1.5 }), "gasto_invalido"],
    [item({ gasto_centavos: "100" }), "gasto_invalido"],
    [item({ gasto_centavos: 100_000_001 }), "gasto_invalido"],
    [item({ gasto_centavos: undefined }), "gasto_invalido"],
    [item({ gasto_centavos: Number.NaN }), "gasto_invalido"],
    [item({ impressoes: -1 }), "impressoes_invalido"],
    [item({ cliques: 2.2 }), "cliques_invalido"],
    [item({ conversas_meta: 10_000_001 }), "conversas_meta_invalido"],
    [item({ moeda: "brl" }), "moeda_invalida"],
    ["solto", "nao_objeto"],
    [[1, 2], "nao_objeto"],
  ];
  const r = await t.pedir({ acao: "gasto_meta", itens: [item(), ...casos.map((c) => c[0]), item({ gasto_centavos: 1 })] });
  assertEquals(r.status, 200);
  assertEquals(r.corpo.rejeitadas, [
    ...casos.map((c, i) => ({ indice: i + 1, erro: c[1] })),
    { indice: casos.length + 1, erro: "duplicado_no_lote" },
  ]);
  assertEquals(r.corpo.inseridos, 1);
  assertEquals(t.chamadas.length, 1);
  assertEquals((t.chamadas[0].args!.p_itens as unknown[]).length, 1);
  t.fim();
});

Deno.test("gasto_meta: só itens inválidos = 200 sem chamar o banco", async () => {
  const t = montar();
  const r = await t.pedir({ acao: "gasto_meta", itens: [item({ ad_id: "" })] });
  assertEquals(r, { status: 200, corpo: { ok: true, recebidos: 1, inseridos: 0, atualizados: 0, rejeitadas: [{ indice: 0, erro: "ad_id_invalido" }] } });
  assertEquals(t.chamadas.length, 0);
  t.fim();
});

Deno.test("gasto_meta: reenvio do mesmo dia é idempotente (atualiza, não duplica)", async () => {
  const t = montar();
  const a = await t.pedir({ acao: "gasto_meta", itens: [item(), item({ data: "2026-11-18", gasto_centavos: 0 })] });
  assertEquals([a.corpo.inseridos, a.corpo.atualizados], [2, 0]);
  const b = await t.pedir({ acao: "gasto_meta", itens: [item({ gasto_centavos: 20000 }), item({ data: "2026-11-18", gasto_centavos: 0 })] });
  assertEquals([b.corpo.inseridos, b.corpo.atualizados], [0, 2]);
  assertEquals(t.linhas.size, 2);
  assertEquals(t.linhas.get("120000000000001|2026-11-19")!.gasto_centavos, 20000);
  t.fim();
});

Deno.test("gasto_meta: o que vai ao banco é normalizado (padrões e campaign_id opcional)", async () => {
  const t = montar();
  await t.pedir({ acao: "gasto_meta", item: { ad_id: "AD_1.x-2", data: "2026-11-21", gasto_centavos: 0 } }); // hoje + 1 aceita
  assertEquals(t.chamadas[0].args!.p_itens, [{
    ad_id: "AD_1.x-2", campaign_id: null, data: "2026-11-21", gasto_centavos: 0, impressoes: 0, cliques: 0, conversas_meta: 0, moeda: "BRL",
  }]);
  await t.pedir({ acao: "gasto_meta", itens: [item({ campaign_id: "120000000000900", moeda: "USD", extra: "ignorado" })] });
  const enviado = (t.chamadas[1].args!.p_itens as Record<string, unknown>[])[0];
  assertEquals(enviado.campaign_id, "120000000000900");
  assertEquals(enviado.moeda, "USD");
  assert(!("extra" in enviado));
  t.fim();
});

Deno.test("gasto_meta: rejeição do banco volta com o índice ORIGINAL do lote", async () => {
  const t = montar(() => ({ inseridos: 1, atualizados: 0, rejeitadas: [{ indice: 1, erro: "data_fora_da_janela" }] }));
  const r = await t.pedir({ acao: "gasto_meta", itens: [item({ ad_id: "" }), item(), item({ ad_id: "B" })] });
  assertEquals(r.corpo.rejeitadas, [{ indice: 0, erro: "ad_id_invalido" }, { indice: 2, erro: "data_fora_da_janela" }]);
  t.fim();
});

Deno.test("gasto_meta: log só com contagens; erro do banco = 500 só com o código", async () => {
  const t = montar();
  await t.pedir({ acao: "gasto_meta", itens: [item({ ad_id: "AD-SECRETO-9", campaign_id: "CAMP-777" })] });
  assertEquals(t.logs, ['[crm-leads] gasto_meta {"recebidos":1,"inseridos":1,"atualizados":0,"rejeitados":0}']);
  const tudo = t.logs.join(" ");
  assert(!tudo.includes("AD-SECRETO-9") && !tudo.includes("CAMP-777") && !tudo.includes(SEGREDO) && !tudo.includes("12345"));
  t.fim();

  const db: RpcCliente = { rpc: () => Promise.resolve({ data: null, error: { code: "23514" } }) };
  const erros: string[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => { erros.push(a.map(String).join(" ")); };
  const h = criarHandler({ segredo: SEGREDO, db: () => db, hojeBrasilia: () => HOJE, log: () => {} });
  const r = await h(new Request("http://x", { method: "POST", headers: { "x-crm-secret": SEGREDO }, body: JSON.stringify({ acao: "gasto_meta", itens: [item({ ad_id: "AD-SECRETO-9" })] }) }));
  console.error = original;
  assertEquals(r.status, 500);
  assertEquals(await r.json(), { erro: "interno", codigo: "23514" });
  assertEquals(erros, ["[crm-leads] erro gasto_meta 23514"]);
});

Deno.test("normalizarGastoMeta: limites exatos aceitos", () => {
  const r = normalizarGastoMeta(item({ gasto_centavos: 100_000_000, impressoes: 1_000_000_000, cliques: 0, conversas_meta: 10_000_000, data: "2025-10-16" }), HOJE);
  assert(r.ok);
  assertEquals(normalizarGastoMeta(item({ data: "2025-10-15" }), HOJE), { ok: false, erro: "data_fora_da_janela" });
});
