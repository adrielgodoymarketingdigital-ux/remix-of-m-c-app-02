// deno test --no-check --allow-read scripts/testes-crm-leads/
// Edge Function crm-leads (handler.ts + contrato.ts) com banco FALSO: sem
// rede, sem Supabase. Prova segredo, limites, deduplicação reportada,
// rejeições por item e que o log nunca leva telefone/nome/texto.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { criarHandler, type RpcCliente } from "../../supabase/functions/crm-leads/handler.ts";
import { lerEnvelope, normalizarMensagem, segredoConfere } from "../../supabase/functions/crm-leads/contrato.ts";

const SEGREDO = "s".repeat(40);
const AGORA = new Date();
const iso = (minAtras: number) => new Date(AGORA.getTime() - minAtras * 60_000).toISOString();

function montar(respostas: Record<string, unknown> = {}, segredo: string | undefined = SEGREDO) {
  const chamadas: { fn: string; args?: Record<string, unknown> }[] = [];
  const logs: string[] = [];
  const db: RpcCliente = {
    rpc(fn, args) {
      chamadas.push({ fn, args });
      const r = respostas[fn];
      if (r instanceof Error) return Promise.resolve({ data: null, error: { code: "XX000" } });
      return Promise.resolve({ data: r ?? null, error: null });
    },
  };
  const handler = criarHandler({
    segredo, db: () => db, hojeBrasilia: () => "2026-11-20",
    log: (m, d) => logs.push(m + " " + JSON.stringify(d)),
  });
  const pedir = (corpo: unknown, headers: Record<string, string> = { "x-crm-secret": SEGREDO }, metodo = "POST") =>
    handler(new Request("http://local/crm-leads", {
      method: metodo, headers, body: metodo === "POST" ? (typeof corpo === "string" ? corpo : JSON.stringify(corpo)) : undefined,
    }));
  return { pedir, chamadas, logs };
}

const msg = (over: Record<string, unknown> = {}) => ({
  telefone: "5511990000001", wa_message_id: "m1", direcao: "entrada", texto: "oi", enviada_em: iso(5), ...over,
});

Deno.test("segredo: ausente/curto = 503; errado/sem header = 401; GET = 405", async () => {
  assertEquals((await montar({}, "").pedir({ acao: "retencao" })).status, 503);
  assertEquals((await montar({}, "curto").pedir({ acao: "retencao" })).status, 503);
  const t = montar();
  assertEquals((await t.pedir({ acao: "retencao" }, { "x-crm-secret": "errado" })).status, 401);
  assertEquals((await t.pedir({ acao: "retencao" }, {})).status, 401);
  assertEquals((await t.pedir(null, { "x-crm-secret": SEGREDO }, "GET")).status, 405);
  assertEquals(t.chamadas.length, 0);
});

Deno.test("segredoConfere em tempo constante, sem aceitar prefixo", async () => {
  assertEquals(await segredoConfere(SEGREDO, SEGREDO), true);
  assertEquals(await segredoConfere(SEGREDO.slice(0, 39), SEGREDO), false);
  assertEquals(await segredoConfere(SEGREDO + "x", SEGREDO), false);
  assertEquals(await segredoConfere(null, SEGREDO), false);
});

Deno.test("envelope: json inválido, ação inválida, itens vazios, 200 ok e 201 = 413", async () => {
  const t = montar({ crm_ingerir_mensagens: { inseridas: 200, duplicadas: 0, opt_outs: 0, rejeitadas: [] } });
  assertEquals((await t.pedir("{nao json")).status, 400);
  assertEquals(await (await t.pedir({ acao: "apagar_tudo" })).json(), { erro: "acao_invalida" });
  assertEquals(await (await t.pedir({ acao: "esfriados" })).json(), { erro: "acao_invalida" }); // fase 3 não existe aqui
  assertEquals(await (await t.pedir({ acao: "mensagens", itens: [] })).json(), { erro: "itens_vazios" });
  const r413 = await t.pedir({ acao: "mensagens", itens: Array.from({ length: 201 }, (_, i) => msg({ wa_message_id: `m${i}` })) });
  assertEquals(r413.status, 413);
  assertEquals(await r413.json(), { erro: "lote_grande", max_itens: 200 });
  const r200 = await t.pedir({ acao: "mensagens", itens: Array.from({ length: 200 }, (_, i) => msg({ wa_message_id: `m${i}` })) });
  assertEquals(r200.status, 200);
  assertEquals(t.chamadas.length, 1);
  assertEquals(lerEnvelope({ acao: "mensagens", item: msg() }).ok, true); // item solto = lote de 1
});

Deno.test("corpo acima de 512 KB = 413 antes de ler o JSON", async () => {
  const t = montar();
  const r = await t.pedir(JSON.stringify({ acao: "mensagens", itens: [msg({ texto: "x".repeat(600 * 1024) })] }));
  assertEquals(r.status, 413);
  assertEquals(t.chamadas.length, 0);
});

Deno.test("mensagens: rejeições por item com índice ORIGINAL, banco só recebe as válidas normalizadas", async () => {
  const t = montar({
    crm_ingerir_mensagens: { inseridas: 1, duplicadas: 1, opt_outs: 0, rejeitadas: [{ indice: 1, erro: "campo_invalido" }] },
  });
  const r = await t.pedir({
    acao: "mensagens",
    itens: [
      msg({ telefone: "123" }),                              // 0: telefone
      msg({ wa_message_id: "a" }),                           // 1 -> banco 0
      msg({ direcao: "saida", autor: "lead" }),              // 2: autor
      msg({ wa_message_id: "b", enviada_em: iso(-60) }),     // 3: futuro
      msg({ wa_message_id: "c", telefone: "11990000001@lid" }), // 4: @lid recusado
      msg({ wa_message_id: "d" }),                           // 5 -> banco 1 (rejeitada no banco)
    ],
  });
  const corpo = await r.json();
  assertEquals(corpo.rejeitadas, [
    { indice: 0, erro: "telefone_invalido" },
    { indice: 2, erro: "autor_invalido" },
    { indice: 3, erro: "data_invalida" },
    { indice: 4, erro: "telefone_invalido" },
    { indice: 5, erro: "campo_invalido" },
  ]);
  assertEquals([corpo.inseridas, corpo.duplicadas, corpo.recebidas], [1, 1, 6]);
  const enviados = t.chamadas[0].args!.p_itens as { telefone: string; wa_message_id: string }[];
  assertEquals(enviados.map((e) => [e.telefone, e.wa_message_id]), [["+5511990000001", "a"], ["+5511990000001", "d"]]);
});

Deno.test("log nunca leva telefone, nome ou texto", async () => {
  const t = montar({ crm_ingerir_mensagens: { inseridas: 1, duplicadas: 0, opt_outs: 0, rejeitadas: [] }, crm_registrar_opt_out: true });
  await t.pedir({ acao: "mensagens", itens: [msg({ nome: "Nome Ficticio", texto: "texto secreto" })] });
  await t.pedir({ acao: "opt_out", itens: [{ telefone: "5511990000001" }] });
  const tudo = t.logs.join("\n");
  for (const proibido of ["99000", "0000001", "Nome Ficticio", "texto secreto"]) assert(!tudo.includes(proibido), proibido);
});

Deno.test("erro do banco = 500 só com o código", async () => {
  const t = montar({ crm_aplicar_retencao: new Error("x") });
  const r = await t.pedir({ acao: "retencao" });
  assertEquals(r.status, 500);
  assertEquals(await r.json(), { erro: "interno", codigo: "XX000" });
});

Deno.test("vincular exige uuid válido e telefone válido", async () => {
  const t = montar({ crm_vincular_usuario: "vinculado" });
  const r = await (await t.pedir({ acao: "vincular", itens: [
    { telefone: "5511990000001", user_id: "00000000-0000-0000-0000-000000000001" },
    { telefone: "5511990000001", user_id: "nao-e-uuid" },
    { telefone: "1", user_id: "00000000-0000-0000-0000-000000000001" },
  ] })).json();
  assertEquals(r.resultados, ["vinculado", "invalido", "invalido"]);
  assertEquals(t.chamadas.length, 1);
  assertEquals(t.chamadas[0].args, { p_telefone: "+5511990000001", p_user_id: "00000000-0000-0000-0000-000000000001" });
});

Deno.test("vincular_lote, relatorio e resumo validam parâmetros", async () => {
  const t = montar({ crm_vincular_cadastros: { vinculados: 0, ambiguos_novos: 0 }, crm_relatorio_diario: {}, crm_atualizar_resumo: { atualizados: 1, nao_encontrados: 0 } });
  assertEquals((await t.pedir({ acao: "vincular_lote", dias: 0 })).status, 400);
  assertEquals((await t.pedir({ acao: "vincular_lote", dias: 401 })).status, 400);
  assertEquals((await t.pedir({ acao: "vincular_lote" })).status, 200);
  assertEquals(t.chamadas.at(-1)!.args, { p_dias: 120 });
  assertEquals((await t.pedir({ acao: "relatorio", dia: "ontem" })).status, 400);
  await t.pedir({ acao: "relatorio" });
  assertEquals(t.chamadas.at(-1)!.args, { p_dia: "2026-11-20" });
  const r = await (await t.pedir({ acao: "resumo", itens: [{ telefone: "x" }, { telefone: "(11) 99000-0001", resumo: "r".repeat(2000) }] })).json();
  assertEquals(r.rejeitadas, [{ indice: 0, erro: "telefone_invalido" }]);
  const enviado = (t.chamadas.at(-1)!.args!.p_itens as { telefone: string; resumo: string }[])[0];
  assertEquals([enviado.telefone, enviado.resumo.length], ["+5511990000001", 1500]);
});

Deno.test("normalizarMensagem: tipos, autor, datas em epoch e referral", () => {
  const ok = normalizarMensagem({ ...msg(), enviada_em: Math.floor(AGORA.getTime() / 1000) - 60,
    referral: { ad_id: "120000000000001", titulo: "  Anúncio  ", ctwa_clid: "c" } }, AGORA);
  assert(ok.ok);
  if (ok.ok) {
    assertEquals(ok.valor.autor, "lead");
    assertEquals(ok.valor.referral, { ad_id: "120000000000001", titulo: "Anúncio", tipo: null, ctwa_clid: "c", url: null });
  }
  assertEquals(normalizarMensagem({ ...msg(), tipo: "sticker" }, AGORA), { ok: false, erro: "tipo_invalido" });
  assertEquals(normalizarMensagem({ ...msg(), referral: { ad_id: "x y" } }, AGORA), { ok: false, erro: "ad_id_invalido" });
  assertEquals(normalizarMensagem({ ...msg(), direcao: "saida" }, AGORA).ok, true); // autor padrão humano
  assertEquals(normalizarMensagem({ ...msg(), enviada_em: iso(401 * 24 * 60) }, AGORA), { ok: false, erro: "data_invalida" });
  const vazio = normalizarMensagem({ ...msg(), referral: {} }, AGORA);
  assert(vazio.ok && vazio.valor.referral === null);
});
