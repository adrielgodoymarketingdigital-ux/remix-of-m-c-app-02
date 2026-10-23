// deno test supabase/functions/zerar-dados-storage/
// Fluxo HTTP de zerar-dados-storage com token, fila, Storage (buckets falsos em
// memória) e relógio simulados: só a execução do próprio usuário, só buckets
// permitidos, nada que ainda está em uso, lotes de 100, continuação quando o
// tempo acaba e idempotência.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { criarHandler, type Dependencias, type Situacao, TAMANHO_LOTE } from "./processar.ts";

const DONO = "11111111-1111-1111-1111-111111111111";
const OUTRO = "22222222-2222-2222-2222-222222222222";
const EXEC = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const EXEC_OUTRO = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TOKENS: Record<string, string> = { "token-dono": DONO, "token-outro": OUTRO };

interface LinhaFila { id: string; execucao_id: string; bucket: string; caminho: string; tentativas: number; situacao: Situacao; removido_em?: string; erro?: string | null }

function mundo(opcoes: {
  fila?: Omit<LinhaFila, "id" | "execucao_id" | "tentativas" | "situacao">[];
  noStorage?: [string, string][];          // arquivos que existem no Storage
  emUso?: string[];                        // "bucket/caminho" ainda citados por dado que ficou
  falharStorage?: (bucket: string, chamada: number) => boolean;
  msPorRemocao?: number;
  orcamentoMs?: number;
  status?: string;
} = {}) {
  let n = 0;
  const fila: LinhaFila[] = (opcoes.fila ?? []).map((f) => ({
    id: `arq-${String(++n).padStart(5, "0")}`, execucao_id: EXEC, tentativas: 0, situacao: "pendente", ...f,
  }));
  fila.push({ id: "arq-outra-exec", execucao_id: EXEC_OUTRO, bucket: "produtos-fotos", caminho: "do-outro.jpg", tentativas: 0, situacao: "pendente" });
  const storage = new Set((opcoes.noStorage ?? []).map(([b, c]) => `${b}/${c}`));
  storage.add("produtos-fotos/do-outro.jpg");
  const execucoes = [
    { id: EXEC, user_id: DONO, storage_status: opcoes.status ?? "pendente" },
    { id: EXEC_OUTRO, user_id: OUTRO, storage_status: "pendente" },
  ];
  const chamadasStorage: { bucket: string; caminhos: string[] }[] = [];
  let relogio = 0;
  let chamadaStorage = 0;

  const deps: Dependencias = {
    usuarioDoToken: (t) => Promise.resolve(TOKENS[t] ?? null),
    buscarExecucao: (id) => Promise.resolve(execucoes.find((e) => e.id === id) ?? null),
    marcarEmUso: (id) => {
      let k = 0;
      for (const a of fila) {
        if (a.execucao_id === id && a.situacao === "pendente" && (opcoes.emUso ?? []).includes(`${a.bucket}/${a.caminho}`)) {
          a.situacao = "mantido_em_uso"; k++;
        }
      }
      return Promise.resolve(k);
    },
    listarPendentes: (id, limite) =>
      Promise.resolve(fila.filter((a) => a.execucao_id === id && a.situacao === "pendente")
        .sort((x, y) => x.id.localeCompare(y.id)).slice(0, limite).map((a) => ({ ...a }))),
    removerDoStorage: (bucket, caminhos) => {
      chamadaStorage++;
      chamadasStorage.push({ bucket, caminhos });
      relogio += opcoes.msPorRemocao ?? 10;
      if (caminhos.length > TAMANHO_LOTE) throw new Error("lote grande demais");
      if (opcoes.falharStorage?.(bucket, chamadaStorage)) return Promise.resolve({ ok: false, erro: "storage" });
      for (const c of caminhos) storage.delete(`${bucket}/${c}`); // inexistente: tudo bem
      return Promise.resolve({ ok: true });
    },
    atualizarArquivos: (ids, campos) => {
      for (const a of fila) if (ids.includes(a.id)) Object.assign(a, campos);
      return Promise.resolve();
    },
    contarPorSituacao: (id) => {
      const c = { pendente: 0, removido: 0, mantido_em_uso: 0, ignorado: 0, falhou: 0 } as Record<Situacao, number>;
      for (const a of fila) if (a.execucao_id === id) c[a.situacao]++;
      return Promise.resolve(c);
    },
    atualizarStatusExecucao: (id, status) => {
      execucoes.find((e) => e.id === id)!.storage_status = status;
      return Promise.resolve();
    },
    agora: () => relogio,
    orcamentoMs: opcoes.orcamentoMs ?? 25_000,
  };
  const logs: string[] = [];
  const handler = criarHandler({ ...deps, log: (p, d) => logs.push(`${p} ${JSON.stringify(d ?? "")}`) });
  return { handler, fila, storage, execucoes, chamadasStorage, logs };
}

const post = (corpo: unknown, token?: string, extra: RequestInit = {}) =>
  new Request("http://local/zerar-dados-storage", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    ...extra,
  });
const chamar = async (h: (r: Request) => Promise<Response>, corpo: unknown = { execucao_id: EXEC }, token = "token-dono") => {
  const r = await h(post(corpo, token));
  return { status: r.status, corpo: await r.json() };
};

Deno.test("remove só o que é permitido e não está em uso; marca e conclui", async () => {
  const m = mundo({
    fila: [
      { bucket: "produtos-fotos", caminho: "raiz-1.jpg" },
      { bucket: "dispositivos-fotos", caminho: "dono/v2-a.jpg" },
      { bucket: "dispositivos-fotos", caminho: "dono/em-uso.jpg" },
      { bucket: "loja-logos", caminho: "logo.png" },
      { bucket: "catalogo-assets", caminho: "banner.png" },
      { bucket: "termos-compra", caminho: "nao-existe-mais.pdf" },
    ],
    noStorage: [["produtos-fotos", "raiz-1.jpg"], ["dispositivos-fotos", "dono/v2-a.jpg"], ["dispositivos-fotos", "dono/em-uso.jpg"],
      ["loja-logos", "logo.png"], ["catalogo-assets", "banner.png"]],
    emUso: ["dispositivos-fotos/dono/em-uso.jpg"],
  });
  const r = await chamar(m.handler);
  assertEquals(r.status, 200);
  assertEquals(r.corpo, { execucao_id: EXEC, removidos: 3, mantidos_em_uso: 1, ignorados: 2, falharam: 0, restantes: 0, concluido: true });
  // continuam no Storage: o que está em uso, logo, catálogo e o arquivo da outra execução
  assertEquals([...m.storage].sort(), ["catalogo-assets/banner.png", "dispositivos-fotos/dono/em-uso.jpg", "loja-logos/logo.png", "produtos-fotos/do-outro.jpg"]);
  assert(!m.chamadasStorage.some((c) => c.bucket === "loja-logos" || c.bucket === "catalogo-assets"), "nunca chama o Storage de bucket proibido");
  assertEquals(m.fila.find((a) => a.caminho === "logo.png")?.erro, "bucket_nao_permitido");
  assert(m.fila.filter((a) => a.situacao === "removido").every((a) => a.removido_em), "removido_em preenchido");
  assertEquals(m.execucoes[0].storage_status, "concluido");
  assertEquals(m.fila.find((a) => a.id === "arq-outra-exec")?.situacao, "pendente", "não toca na fila de outra execução");
  // log sem caminho de arquivo
  assert(!m.logs.join("\n").match(/raiz-1|v2-a|em-uso|logo\.png/), m.logs.join("\n"));
});

Deno.test("arquivo que já não existe conta como removido", async () => {
  const m = mundo({ fila: [{ bucket: "compras-fotos", caminho: "sumiu.jpg" }] });
  const r = await chamar(m.handler);
  assertEquals([r.corpo.removidos, r.corpo.restantes, r.corpo.concluido], [1, 0, true]);
});

Deno.test("lote maior que 100: nenhuma chamada ao Storage passa de 100", async () => {
  const fila = Array.from({ length: 250 }, (_, i) => ({ bucket: i % 2 ? "produtos-fotos" : "dispositivos-fotos", caminho: `f-${i}.jpg` }));
  const m = mundo({ fila, noStorage: fila.map((f) => [f.bucket, f.caminho] as [string, string]) });
  const r = await chamar(m.handler);
  assertEquals([r.corpo.removidos, r.corpo.restantes, r.corpo.concluido], [250, 0, true]);
  assert(m.chamadasStorage.every((c) => c.caminhos.length <= 100));
  assertEquals(m.chamadasStorage.reduce((s, c) => s + c.caminhos.length, 0), 250);
  assertEquals(m.storage.size, 1); // só o da outra execução
});

Deno.test("tempo acaba: devolve restantes e continua na próxima chamada até acabar", async () => {
  const fila = Array.from({ length: 5000 }, (_, i) => ({ bucket: "produtos-fotos", caminho: `p-${i}.jpg` }));
  const m = mundo({ fila, msPorRemocao: 1000, orcamentoMs: 3000 }); // ~3 lotes por chamada
  const r1 = await chamar(m.handler);
  assertEquals(r1.corpo.concluido, false);
  assertEquals(r1.corpo.removidos, 300);
  assertEquals(r1.corpo.restantes, 4700);
  assertEquals(m.execucoes[0].storage_status, "pendente");
  let r = r1, chamadas = 1;
  while (!r.corpo.concluido && chamadas < 100) { r = await chamar(m.handler); chamadas++; }
  assertEquals([r.corpo.removidos, r.corpo.restantes, r.corpo.concluido], [5000, 0, true]);
  assertEquals(chamadas, 17);
  assertEquals(m.execucoes[0].storage_status, "concluido");
  const todas = m.chamadasStorage.flatMap((c) => c.caminhos);
  assertEquals(new Set(todas).size, todas.length, "nenhum arquivo pedido duas vezes");
});

Deno.test("rodar de novo depois de concluído não repete nem erra", async () => {
  const m = mundo({ fila: [{ bucket: "produtos-fotos", caminho: "a.jpg" }], noStorage: [["produtos-fotos", "a.jpg"]] });
  const r1 = await chamar(m.handler);
  const chamadasAntes = m.chamadasStorage.length;
  const r2 = await chamar(m.handler);
  assertEquals(r2.status, 200);
  assertEquals(r2.corpo, r1.corpo);
  assertEquals(m.chamadasStorage.length, chamadasAntes, "nenhuma remoção na 2ª chamada");
});

Deno.test("falha do Storage: tenta de novo nas próximas chamadas; após 3 vira 'falhou' e status 'erro'", async () => {
  const m = mundo({
    fila: [{ bucket: "produtos-fotos", caminho: "ok.jpg" }, { bucket: "termos-compra", caminho: "teimoso.pdf" }],
    falharStorage: (bucket) => bucket === "termos-compra",
  });
  const r1 = await chamar(m.handler);
  assertEquals([r1.corpo.removidos, r1.corpo.restantes, r1.corpo.concluido], [1, 1, false]);
  assertEquals(m.fila.find((a) => a.caminho === "teimoso.pdf")?.tentativas, 1);
  await chamar(m.handler);
  const r3 = await chamar(m.handler);
  assertEquals([r3.corpo.falharam, r3.corpo.restantes, r3.corpo.concluido], [1, 0, true]);
  assertEquals(m.execucoes[0].storage_status, "erro");
  const r4 = await chamar(m.handler);
  assertEquals(r4.corpo.falharam, 1, "não tenta mais o que já falhou 3 vezes");
  assertEquals(m.chamadasStorage.filter((c) => c.bucket === "termos-compra").length, 3);
  assertEquals(m.fila.find((a) => a.caminho === "teimoso.pdf")?.erro, "falha_remocao_storage");
});

Deno.test("falha temporária: na chamada seguinte remove e conclui", async () => {
  const m = mundo({ fila: [{ bucket: "produtos-fotos", caminho: "x.jpg" }], falharStorage: (_b, n) => n === 1 });
  assertEquals((await chamar(m.handler)).corpo.concluido, false);
  const r = await chamar(m.handler);
  assertEquals([r.corpo.removidos, r.corpo.concluido], [1, true]);
  assertEquals(m.execucoes[0].storage_status, "concluido");
});

Deno.test("execução de outro usuário responde igual a inexistente, e nada é tocado", async () => {
  const m = mundo({ fila: [{ bucket: "produtos-fotos", caminho: "a.jpg" }] });
  const deOutro = await chamar(m.handler, { execucao_id: EXEC_OUTRO });
  const inexistente = await chamar(m.handler, { execucao_id: "cccccccc-cccc-cccc-cccc-cccccccccccc" });
  assertEquals(deOutro, { status: 404, corpo: { error: "Execução não encontrada" } });
  assertEquals(inexistente, deOutro);
  const comOutroToken = await chamar(m.handler, { execucao_id: EXEC }, "token-outro");
  assertEquals(comOutroToken, deOutro);
  assertEquals(m.chamadasStorage.length, 0);
  assert(m.fila.every((a) => a.situacao === "pendente"));
});

Deno.test("sem login ou token inválido: 401 e nada é tocado", async () => {
  const m = mundo({ fila: [{ bucket: "produtos-fotos", caminho: "a.jpg" }] });
  assertEquals((await m.handler(post({ execucao_id: EXEC }))).status, 401);
  assertEquals((await m.handler(post({ execucao_id: EXEC }, "token-falso"))).status, 401);
  assertEquals(m.chamadasStorage.length, 0);
});

Deno.test("corpo: só { execucao_id } uuid; user_id no corpo é recusado; limite de tamanho", async () => {
  const m = mundo();
  for (const corpo of [{}, { execucao_id: "1" }, { execucao_id: EXEC, user_id: OTHER() }, "não é json", [EXEC], { execucao_id: 5 }]) {
    assertEquals((await m.handler(post(corpo, "token-dono"))).status, 400, JSON.stringify(corpo));
  }
  const grande = JSON.stringify({ execucao_id: EXEC, x: "y".repeat(5000) });
  assertEquals((await m.handler(post(grande, "token-dono"))).status, 400);
});
function OTHER() { return OUTRO; }

Deno.test("método: só POST (OPTIONS responde CORS)", async () => {
  const m = mundo();
  const get = await m.handler(new Request("http://local/x", { method: "GET", headers: { Authorization: "Bearer token-dono" } }));
  assertEquals(get.status, 405);
  await get.body?.cancel();
  const opt = await m.handler(new Request("http://local/x", { method: "OPTIONS" }));
  assertEquals(opt.headers.get("Access-Control-Allow-Origin"), "*");
  await opt.body?.cancel();
});

Deno.test("execução sem arquivos: responde concluído e mantém 'sem_arquivos'", async () => {
  const m = mundo({ status: "sem_arquivos" });
  const r = await chamar(m.handler);
  assertEquals([r.corpo.restantes, r.corpo.concluido], [0, true]);
  assertEquals(m.execucoes[0].storage_status, "sem_arquivos");
});
