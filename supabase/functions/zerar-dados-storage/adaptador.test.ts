// deno test supabase/functions/zerar-dados-storage/
// Confere as consultas que o adaptador manda ao Supabase (cliente falso que
// grava cada chamada): filtros por execução e situação, lotes de 100 ids,
// remoção pela API do Storage, contagem sem baixar linhas.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { type ClienteSupabase, criarDependencias } from "./adaptador.ts";

function clienteFalso(resposta: (tabela: string, passos: string[]) => unknown = () => ({ data: [], error: null, count: 7 })) {
  const registro: string[][] = [];
  const storage: { bucket: string; caminhos: string[] }[] = [];
  const rpcs: [string, Record<string, unknown>][] = [];
  let storageQuebra = false;
  const from = (tabela: string) => {
    const passos = [`from(${tabela})`];
    registro.push(passos);
    // deno-lint-ignore no-explicit-any
    const b: any = new Proxy({}, {
      get(_alvo, nome: string) {
        if (nome === "then") return (ok: (v: unknown) => unknown) => Promise.resolve(resposta(tabela, passos)).then(ok);
        if (nome === "maybeSingle") return () => Promise.resolve(resposta(tabela, passos));
        return (...args: unknown[]) => (passos.push(`${nome}(${JSON.stringify(args)})`), b);
      },
    });
    return b;
  };
  const sb: ClienteSupabase = {
    auth: { getUser: (t) => Promise.resolve(t === "bom" ? { data: { user: { id: "u1" } }, error: null } : { data: { user: null }, error: "x" }) },
    from,
    rpc: (fn, args) => (rpcs.push([fn, args]), Promise.resolve({ data: 4, error: null })),
    storage: {
      from: (bucket) => ({
        remove: (caminhos) => {
          if (storageQuebra) return Promise.reject(new Error("rede caiu"));
          storage.push({ bucket, caminhos });
          return Promise.resolve({ data: [], error: null });
        },
      }),
    },
  };
  return { sb, registro, storage, rpcs, quebrarStorage: () => (storageQuebra = true) };
}

Deno.test("usuário do token: válido devolve id; inválido devolve null", async () => {
  const d = criarDependencias(clienteFalso().sb);
  assertEquals(await d.usuarioDoToken("bom"), "u1");
  assertEquals(await d.usuarioDoToken("ruim"), null);
});

Deno.test("buscar execução filtra pelo id e lê só o necessário", async () => {
  const c = clienteFalso(() => ({ data: { id: "e1", user_id: "u1", storage_status: "pendente" }, error: null }));
  const e = await criarDependencias(c.sb).buscarExecucao("e1");
  assertEquals(e?.user_id, "u1");
  assertEquals(c.registro[0], ['from(zerar_dados_execucoes)', 'select(["id, user_id, storage_status"])', 'eq(["id","e1"])']);
});

Deno.test("pendentes: só desta execução, só 'pendente', ordem estável e limite", async () => {
  const c = clienteFalso();
  await criarDependencias(c.sb).listarPendentes("e1", 100);
  assertEquals(c.registro[0], ['from(zerar_dados_arquivos)', 'select(["id, bucket, caminho, tentativas"])',
    'eq(["execucao_id","e1"])', 'eq(["situacao","pendente"])', 'order(["id"])', 'limit([100])']);
});

Deno.test("marcar em uso chama a RPC com a execução", async () => {
  const c = clienteFalso();
  assertEquals(await criarDependencias(c.sb).marcarEmUso("e1"), 4);
  assertEquals(c.rpcs, [["zerar_dados_marcar_em_uso", { p_execucao_id: "e1" }]]);
});

Deno.test("remoção vai pela API do Storage; erro de rede vira falha (não exceção)", async () => {
  const c = clienteFalso();
  const d = criarDependencias(c.sb);
  assertEquals(await d.removerDoStorage("produtos-fotos", ["a.jpg", "b.jpg"]), { ok: true });
  assertEquals(c.storage, [{ bucket: "produtos-fotos", caminhos: ["a.jpg", "b.jpg"] }]);
  assert(!c.registro.some((p) => p[0] === "from(objects)"), "nunca consulta storage.objects");
  c.quebrarStorage();
  assertEquals(await d.removerDoStorage("produtos-fotos", ["c.jpg"]), { ok: false, erro: "rede" });
});

Deno.test("atualizar arquivos manda no máximo 100 ids por vez", async () => {
  const c = clienteFalso(() => ({ data: null, error: null }));
  const ids = Array.from({ length: 250 }, (_, i) => `id${i}`);
  await criarDependencias(c.sb).atualizarArquivos(ids, { situacao: "removido" });
  assertEquals(c.registro.length, 3);
  assertEquals(c.registro.map((p) => JSON.parse(p[2].slice(3, -1))[1].length), [100, 100, 50]);
  assert(c.registro.every((p) => p[1] === 'update([{"situacao":"removido"}])'));
});

Deno.test("contagem usa head (não baixa linhas) e filtra por execução e situação", async () => {
  const c = clienteFalso();
  const r = await criarDependencias(c.sb).contarPorSituacao("e1");
  assertEquals(r, { pendente: 7, removido: 7, mantido_em_uso: 7, ignorado: 7, falhou: 7 });
  assertEquals(c.registro[0], ['from(zerar_dados_arquivos)', 'select(["id",{"count":"exact","head":true}])',
    'eq(["execucao_id","e1"])', 'eq(["situacao","pendente"])']);
});

Deno.test("erro do banco vira exceção (o handler responde 500 genérico)", async () => {
  const c = clienteFalso(() => ({ data: null, error: { message: "boom" } }));
  let msg = "";
  try { await criarDependencias(c.sb).listarPendentes("e1", 100); } catch (e) { msg = (e as Error).message; }
  assertEquals(msg, "listar pendentes: boom");
});
