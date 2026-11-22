// deno test --no-check --allow-read scripts/testes-crm-leads/
// Pesquisa de feedback com pagantes: ações pagantes_contato e
// contato_registrar da Edge Function crm-leads, com banco FALSO (sem rede).
// Prova validações, padrões (limite 15, pausa 120), o que vai para o banco,
// a defesa do telefone, o primeiro nome, o limite de lote, duplicados,
// índices das rejeições do banco, reenvio igual = mesma chamada e que o log
// nunca leva telefone nem nome. As regras de elegibilidade e a idempotência
// no banco são provadas no PGlite (scripts/crm-leads/teste-pglite-feedback.mjs).
// Dados fictícios.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { criarHandler, type RpcCliente } from "../../supabase/functions/crm-leads/handler.ts";
import {
  ehCelularBrasil, lerEnvelope, lerParamsPagantes, MAX_ITENS_REGISTRO, normalizarRegistro, primeiroNome,
} from "../../supabase/functions/crm-leads/contrato.ts";

const SEGREDO = "s".repeat(40);
const U = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const HEX = "abcdef00-0000-4000-8000-0000000000aa"; // id com letras (para o teste de maiúsculas)
const TEL = (n: number) => `+55119900000${String(n).padStart(2, "0")}`;

function montar(respostas: Record<string, unknown> = {}) {
  const chamadas: { fn: string; args?: Record<string, unknown> }[] = [];
  const logs: string[] = [];
  const db: RpcCliente = {
    rpc(fn, args) {
      chamadas.push({ fn, args });
      const r = respostas[fn];
      if (r instanceof Error) return Promise.resolve({ data: null, error: { code: "22023" } });
      return Promise.resolve({ data: typeof r === "function" ? r(args) : r ?? null, error: null });
    },
  };
  const handler = criarHandler({
    segredo: SEGREDO, db: () => db, hojeBrasilia: () => "2026-11-22",
    log: (m, d) => logs.push(m + " " + JSON.stringify(d)),
  });
  const pedir = async (corpo: unknown, headers: Record<string, string> = { "x-crm-secret": SEGREDO }) => {
    const r = await handler(new Request("http://local/crm-leads", { method: "POST", headers, body: JSON.stringify(corpo) }));
    return { status: r.status, corpo: await r.json() };
  };
  return { pedir, chamadas, logs };
}

const LISTA = {
  itens: [
    { user_id: U(1), primeira_palavra: "MARIA", telefone: TEL(1) },
    { user_id: U(2), primeira_palavra: "", telefone: TEL(2) },
    { user_id: U(3), primeira_palavra: "joão", telefone: "+551133334444" },   // fixo: o banco não manda, mas se mandar sai
    { user_id: U(4), primeira_palavra: "ana", telefone: "+351912345678" },    // estrangeiro: sai
    { user_id: "nao-uuid", primeira_palavra: "x", telefone: TEL(5) },          // id ruim: sai
    { user_id: U(6), primeira_palavra: "ângela", telefone: TEL(6) },
  ],
  total_elegiveis: 37,
  excluidos_por_pausa: 4,
};

// ---------------------------------------------------------------------------
// pagantes_contato
// ---------------------------------------------------------------------------

Deno.test("pagantes_contato: sem segredo = 401 e nada vai ao banco", async () => {
  const t = montar({ crm_pagantes_contato: LISTA });
  assertEquals((await t.pedir({ acao: "pagantes_contato", campanha: "feedback_nov" }, {})).status, 401);
  assertEquals(t.chamadas.length, 0);
});

Deno.test("pagantes_contato: padrões limite 15 e pausa 120; argumentos exatos para o banco", async () => {
  const t = montar({ crm_pagantes_contato: { itens: [], total_elegiveis: 0, excluidos_por_pausa: 0 } });
  const r = await t.pedir({ acao: "pagantes_contato", campanha: "feedback_nov" });
  assertEquals(r, { status: 200, corpo: { ok: true, itens: [], total_elegiveis: 0, excluidos_por_pausa: 0 } });
  assertEquals(t.chamadas, [{ fn: "crm_pagantes_contato", args: { p_campanha: "feedback_nov", p_limite: 15, p_pausa_dias: 120, p_user_ids: null } }]);
  await t.pedir({ acao: "pagantes_contato", campanha: "fb-2026_11", limite: 50, pausa_dias: 30 });
  assertEquals(t.chamadas[1].args, { p_campanha: "fb-2026_11", p_limite: 50, p_pausa_dias: 30, p_user_ids: null });
  await t.pedir({ acao: "pagantes_contato", campanha: "fb_teste", limite: 1, pausa_dias: 365, user_ids: [HEX.toUpperCase(), HEX, U(8)] });
  assertEquals(t.chamadas[2].args, { p_campanha: "fb_teste", p_limite: 1, p_pausa_dias: 365, p_user_ids: [HEX, U(8)] });
});

Deno.test("pagantes_contato: validações (400, sem chamar o banco)", async () => {
  const t = montar({ crm_pagantes_contato: LISTA });
  const casos: [Record<string, unknown>, string][] = [
    [{}, "campanha_invalida"],
    [{ campanha: "ab" }, "campanha_invalida"],
    [{ campanha: "a".repeat(41) }, "campanha_invalida"],
    [{ campanha: "Feedback" }, "campanha_invalida"],
    [{ campanha: "feed back" }, "campanha_invalida"],
    [{ campanha: 123 }, "campanha_invalida"],
    [{ campanha: "fb_ok", limite: 0 }, "limite_invalido"],
    [{ campanha: "fb_ok", limite: 51 }, "limite_invalido"],
    [{ campanha: "fb_ok", limite: 2.5 }, "limite_invalido"],
    [{ campanha: "fb_ok", limite: "10" }, "limite_invalido"],
    [{ campanha: "fb_ok", pausa_dias: 29 }, "pausa_dias_invalido"],
    [{ campanha: "fb_ok", pausa_dias: 366 }, "pausa_dias_invalido"],
    [{ campanha: "fb_ok", pausa_dias: 120.5 }, "pausa_dias_invalido"],
    [{ campanha: "fb_ok", pausa_dias: "120" }, "pausa_dias_invalido"],
    [{ campanha: "fb_ok", user_ids: [] }, "user_ids_invalido"],
    [{ campanha: "fb_ok", user_ids: ["x"] }, "user_ids_invalido"],
    [{ campanha: "fb_ok", user_ids: U(1) }, "user_ids_invalido"],
    [{ campanha: "fb_ok", user_ids: Array.from({ length: 11 }, (_, i) => U(i + 1)) }, "user_ids_invalido"],
  ];
  for (const [params, erro] of casos) {
    assertEquals(await t.pedir({ acao: "pagantes_contato", ...params }), { status: 400, corpo: { erro } }, JSON.stringify(params));
  }
  assertEquals(t.chamadas.length, 0);
  // bordas válidas
  for (const p of [{ limite: 1 }, { limite: 50 }, { pausa_dias: 30 }, { pausa_dias: 365 }, { campanha: "abc" }, { campanha: "a".repeat(40) }]) {
    assertEquals((await t.pedir({ acao: "pagantes_contato", campanha: "fb_ok", ...p })).status, 200, JSON.stringify(p));
  }
});

Deno.test("pagantes_contato: saída com primeiro_nome; telefone que não é celular BR e id ruim saem", async () => {
  const t = montar({ crm_pagantes_contato: LISTA });
  const r = await t.pedir({ acao: "pagantes_contato", campanha: "feedback_nov" });
  assertEquals(r.status, 200);
  assertEquals(r.corpo, {
    ok: true,
    itens: [
      { user_id: U(1), primeiro_nome: "Maria", telefone: TEL(1) },
      { user_id: U(2), primeiro_nome: "", telefone: TEL(2) },
      { user_id: U(6), primeiro_nome: "Ângela", telefone: TEL(6) },
    ],
    total_elegiveis: 37,
    excluidos_por_pausa: 4,
  });
  // nada além destes campos por item
  for (const it of r.corpo.itens) assertEquals(Object.keys(it).sort(), ["primeiro_nome", "telefone", "user_id"]);
});

Deno.test("pagantes_contato: nunca devolve mais que o limite, mesmo se o banco mandar mais", async () => {
  const t = montar({ crm_pagantes_contato: LISTA });
  const r = await t.pedir({ acao: "pagantes_contato", campanha: "feedback_nov", limite: 2 });
  assertEquals(r.corpo.itens.map((i: { user_id: string }) => i.user_id), [U(1), U(2)]);
});

Deno.test("pagantes_contato: resposta vazia/nula do banco = lista vazia com zeros", async () => {
  const t = montar({ crm_pagantes_contato: null });
  assertEquals((await t.pedir({ acao: "pagantes_contato", campanha: "feedback_nov" })).corpo,
    { ok: true, itens: [], total_elegiveis: 0, excluidos_por_pausa: 0 });
});

Deno.test("pagantes_contato: log só com contagens (sem telefone, nome ou id)", async () => {
  const t = montar({ crm_pagantes_contato: LISTA });
  await t.pedir({ acao: "pagantes_contato", campanha: "feedback_nov" });
  const tudo = t.logs.join("\n");
  assertEquals(t.logs.length, 1);
  assert(tudo.includes('"itens":3') && tudo.includes('"total_elegiveis":37') && tudo.includes('"excluidos_por_pausa":4') && tudo.includes('"descartados":3'), tudo);
  for (const proibido of ["+55", "9900000", "Maria", "MARIA", "ngela", "0000-0000-0000", "feedback_nov"]) {
    assert(!tudo.includes(proibido), `log contém ${proibido}: ${tudo}`);
  }
});

Deno.test("pagantes_contato: erro do banco = 500 só com o código", async () => {
  const t = montar({ crm_pagantes_contato: new Error("x") });
  assertEquals(await t.pedir({ acao: "pagantes_contato", campanha: "feedback_nov" }), { status: 500, corpo: { erro: "interno", codigo: "22023" } });
});

// ---------------------------------------------------------------------------
// contato_registrar
// ---------------------------------------------------------------------------

const BANCO_OK = { inseridos: 0, atualizados: 0, inalterados: 0, rejeitadas: [] };

Deno.test("contato_registrar: campanha inválida, itens vazios e 101 itens = 413 max 100", async () => {
  const t = montar({ crm_contato_registrar: BANCO_OK });
  const item = { user_id: U(1), resultado: "enviado" };
  assertEquals(await t.pedir({ acao: "contato_registrar", itens: [item] }), { status: 400, corpo: { erro: "campanha_invalida" } });
  assertEquals(await t.pedir({ acao: "contato_registrar", campanha: "X!", itens: [item] }), { status: 400, corpo: { erro: "campanha_invalida" } });
  assertEquals(await t.pedir({ acao: "contato_registrar", campanha: "fb_ok" }), { status: 400, corpo: { erro: "itens_vazios" } });
  assertEquals(await t.pedir({ acao: "contato_registrar", campanha: "fb_ok", itens: [] }), { status: 400, corpo: { erro: "itens_vazios" } });
  const muitos = Array.from({ length: MAX_ITENS_REGISTRO + 1 }, (_, i) => ({ user_id: U(i + 1), resultado: "enviado" }));
  assertEquals(await t.pedir({ acao: "contato_registrar", campanha: "fb_ok", itens: muitos }), { status: 413, corpo: { erro: "lote_grande", max_itens: 100 } });
  assertEquals(t.chamadas.length, 0);
  assertEquals(MAX_ITENS_REGISTRO, 100);
  const cem = muitos.slice(0, 100);
  assertEquals((await t.pedir({ acao: "contato_registrar", campanha: "fb_ok", itens: cem })).status, 200);
  assertEquals((t.chamadas[0].args!.p_itens as unknown[]).length, 100);
});

Deno.test("contato_registrar: rejeita por item (inclusive duplicado no lote) e só manda os bons, com índice original", async () => {
  const t = montar({ crm_contato_registrar: { inseridos: 1, atualizados: 1, inalterados: 0, rejeitadas: [{ indice: 2, erro: "usuario_inexistente" }] } });
  const r = await t.pedir({
    acao: "contato_registrar", campanha: "feedback_nov", itens: [
      "texto",                                         // 0 nao_objeto
      { user_id: HEX, resultado: "enviado" },           // 1 -> banco 0
      { user_id: "abc", resultado: "enviado" },         // 2 user_id_invalido
      { user_id: U(2), resultado: "lido" },             // 3 resultado_invalido
      { user_id: U(2), resultado: "falhou" },           // 4 -> banco 1
      { user_id: HEX.toUpperCase(), resultado: "falhou" }, // 5 duplicado (mesmo id em maiúsculas)
      { user_id: U(3), resultado: "enviado" },          // 6 -> banco 2 -> usuario_inexistente
      { user_id: U(4) },                                // 7 resultado_invalido
    ],
  });
  assertEquals(t.chamadas, [{ fn: "crm_contato_registrar", args: { p_campanha: "feedback_nov", p_itens: [
    { user_id: HEX, resultado: "enviado" }, { user_id: U(2), resultado: "falhou" }, { user_id: U(3), resultado: "enviado" },
  ] } }]);
  assertEquals(r, { status: 200, corpo: {
    ok: true, recebidos: 8, inseridos: 1, atualizados: 1, inalterados: 0, rejeitadas: [
      { indice: 0, erro: "nao_objeto" }, { indice: 2, erro: "user_id_invalido" }, { indice: 3, erro: "resultado_invalido" },
      { indice: 5, erro: "duplicado_no_lote" }, { indice: 6, erro: "usuario_inexistente" }, { indice: 7, erro: "resultado_invalido" },
    ],
  } });
});

Deno.test("contato_registrar: lote todo ruim não chama o banco", async () => {
  const t = montar({ crm_contato_registrar: BANCO_OK });
  const r = await t.pedir({ acao: "contato_registrar", campanha: "fb_ok", itens: [{ user_id: "x", resultado: "enviado" }] });
  assertEquals(r.corpo, { ok: true, recebidos: 1, inseridos: 0, atualizados: 0, inalterados: 0, rejeitadas: [{ indice: 0, erro: "user_id_invalido" }] });
  assertEquals(t.chamadas.length, 0);
});

Deno.test("contato_registrar: reenviar o mesmo lote = mesma chamada; a resposta é a do banco (inalterados)", async () => {
  // banco falso com o estado mínimo para a idempotência: 1ª vez insere, 2ª fica inalterado
  const estado = new Map<string, string>();
  const t = montar({
    crm_contato_registrar: (args: { p_campanha: string; p_itens: { user_id: string; resultado: string }[] }) => {
      const r = { inseridos: 0, atualizados: 0, inalterados: 0, rejeitadas: [] };
      for (const it of args.p_itens) {
        const k = `${args.p_campanha}|${it.user_id}`;
        const atual = estado.get(k);
        if (!atual) { estado.set(k, it.resultado); r.inseridos++; }
        else if (atual === "falhou") { estado.set(k, it.resultado); r.atualizados++; }
        else r.inalterados++;
      }
      return r;
    },
  });
  const lote = { acao: "contato_registrar", campanha: "fb_ok", itens: [{ user_id: U(1), resultado: "enviado" }, { user_id: U(2), resultado: "falhou" }] };
  assertEquals((await t.pedir(lote)).corpo, { ok: true, recebidos: 2, inseridos: 2, atualizados: 0, inalterados: 0, rejeitadas: [] });
  assertEquals((await t.pedir(lote)).corpo, { ok: true, recebidos: 2, inseridos: 0, atualizados: 1, inalterados: 1, rejeitadas: [] });
  assertEquals(t.chamadas[0], t.chamadas[1]);
});

Deno.test("contato_registrar: log só com contagens", async () => {
  const t = montar({ crm_contato_registrar: { inseridos: 1, atualizados: 0, inalterados: 0, rejeitadas: [] } });
  await t.pedir({ acao: "contato_registrar", campanha: "feedback_nov", itens: [{ user_id: U(1), resultado: "enviado" }] });
  const tudo = t.logs.join("\n");
  assert(tudo.includes("contato_registrar") && tudo.includes('"inseridos":1'), tudo);
  assert(!tudo.includes("0000-0000") && !tudo.includes("feedback_nov"), tudo);
});

// ---------------------------------------------------------------------------
// funções puras
// ---------------------------------------------------------------------------

Deno.test("primeiroNome: 1ª palavra, 1ª letra maiúscula, resto minúsculo; sem letra = vazio", () => {
  const casos: [unknown, string][] = [
    ["MARIA", "Maria"], ["joão", "João"], ["ângela", "Ângela"], ["érica silva", "Érica"], ["  ana  ", "Ana"],
    ["", ""], ["   ", ""], [null, ""], [undefined, ""], [42, ""], ["123", ""], ["-", ""], ["😀", ""],
    ["d'ávila", "D'ávila"], ["Ñandu", "Ñandu"],
  ];
  for (const [ent, esp] of casos) assertEquals(primeiroNome(ent), esp, String(ent));
  assertEquals(primeiroNome("a".repeat(80)).length, 40);
});

Deno.test("ehCelularBrasil: só +55 DDD 9XXXXXXXX já normalizado", () => {
  assert(ehCelularBrasil("+5511990000001"));
  assert(ehCelularBrasil("+5521987654321"));
  for (const x of ["+551133334444", "+351912345678", "5511990000001", "+5511990000001 ", "+5501990000001", "+55119900000011", "+5511890000001"]) {
    assert(!ehCelularBrasil(x), x);
  }
});

Deno.test("lerParamsPagantes / normalizarRegistro / envelope", () => {
  assertEquals(lerParamsPagantes({ campanha: "abc" }), { ok: true, valor: { campanha: "abc", limite: 15, pausa_dias: 120, user_ids: null } });
  assertEquals(lerParamsPagantes({ campanha: "abc", limite: null, pausa_dias: null, user_ids: null }).ok, true);
  assertEquals(normalizarRegistro({ user_id: HEX.toUpperCase(), resultado: "falhou" }), { ok: true, valor: { user_id: HEX, resultado: "falhou" } });
  assertEquals(normalizarRegistro([]), { ok: false, erro: "nao_objeto" });
  const env = lerEnvelope({ acao: "pagantes_contato", campanha: "abc", limite: 3 });
  assertEquals(env, { ok: true, acao: "pagantes_contato", itens: [], params: { campanha: "abc", limite: 3 } });
  assertEquals(lerEnvelope({ acao: "contato_registrar", campanha: "abc", item: { user_id: U(1), resultado: "enviado" } }).ok, true);
});
