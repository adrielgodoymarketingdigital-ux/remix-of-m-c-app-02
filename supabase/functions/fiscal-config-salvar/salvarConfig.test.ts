// deno test supabase/functions/fiscal-config-salvar/
// Fluxo HTTP de fiscal-config-salvar com token, has_role e banco simulados
// (bancoFake): 401 sem token, 403 sem admin, 400 com campo extra, e toda
// gravação sai em homologação e desativada, com user_id do token.
import { assertEquals } from "jsr:@std/assert@1";
import { bancoFake } from "../_shared/testes/bancoFake.ts";
import { criarHandler, type Dependencias } from "./salvarConfig.ts";

const ADMIN = "11111111-1111-1111-1111-111111111111";
const LOJISTA = "22222222-2222-2222-2222-222222222222";
const OUTRO = "33333333-3333-3333-3333-333333333333";
const TOKENS: Record<string, string> = { "token-admin": ADMIN, "token-lojista": LOJISTA };

type Linha = Record<string, unknown>;

function montar(tabelas: Record<string, Linha[]> = { fiscal_config: [] }, extra: Partial<Dependencias> = {}) {
  let n = 0;
  const handler = criarHandler({
    usuarioDoToken: (t) => Promise.resolve(TOKENS[t] ?? null),
    ehAdmin: (id) => Promise.resolve(id === ADMIN),
    db: bancoFake(tabelas),
    novoId: () => `cfg-${++n}`,
    ...extra,
  });
  return { handler, tabelas };
}

const post = (corpo: unknown, token?: string, bruto?: string) =>
  new Request("http://local/fiscal-config-salvar", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: bruto ?? JSON.stringify(corpo),
  });

const CORPO = { regime_tributario: "mei", cnae: "9511-8/00", codigo_ibge_municipio: "3550308", serie_nfse: "1", serie_nfe: "1", serie_nfce: "1" };

Deno.test("sem token: 401 e nada gravado", async () => {
  const { handler, tabelas } = montar();
  assertEquals((await handler(post(CORPO))).status, 401);
  assertEquals((await handler(post(CORPO, "token-que-nao-vale"))).status, 401);
  assertEquals(tabelas.fiscal_config.length, 0);
});

Deno.test("usuário que não é admin: 403 e nada gravado", async () => {
  const { handler, tabelas } = montar();
  const r = await handler(post(CORPO, "token-lojista"));
  assertEquals(r.status, 403);
  assertEquals(await r.json(), { error: "Acesso negado" });
  assertEquals(tabelas.fiscal_config.length, 0);
});

Deno.test("corpo com campo extra: 400 e nada gravado (inclusive ambiente/ativo/user_id)", async () => {
  const { handler, tabelas } = montar();
  for (const extra of [{ ambiente: "producao" }, { ativo: true }, { user_id: OUTRO }, { empresa_id: "filial-1" }, { qualquer: 1 }]) {
    const r = await handler(post({ ...CORPO, ...extra }, "token-admin"));
    assertEquals(r.status, 400, JSON.stringify(extra));
  }
  assertEquals((await handler(post(null, "token-admin", "{nao e json"))).status, 400);
  assertEquals(tabelas.fiscal_config.length, 0);
});

Deno.test("admin, primeira vez: insere a matriz com user_id do token, homologação e ativo=false", async () => {
  const { handler, tabelas } = montar();
  const r = await handler(post(CORPO, "token-admin"));
  assertEquals(r.status, 200);
  const { config } = await r.json();
  assertEquals(tabelas.fiscal_config.length, 1);
  assertEquals(config, tabelas.fiscal_config[0]);
  assertEquals({ user_id: config.user_id, empresa_id: config.empresa_id, ambiente: config.ambiente, ativo: config.ativo, cnae: config.cnae },
    { user_id: ADMIN, empresa_id: null, ambiente: "homologacao", ativo: false, cnae: "9511800" });
});

Deno.test("linha existente em produção/ativa: volta para homologação e ativo=false, sem duplicar", async () => {
  const { handler, tabelas } = montar({
    fiscal_config: [
      { id: "cfg-matriz", user_id: ADMIN, empresa_id: null, ambiente: "producao", ativo: true, cnae: "1111111", serie_nfe: "9" },
      { id: "cfg-filial", user_id: ADMIN, empresa_id: "filial-1", ambiente: "producao", ativo: true },
      { id: "cfg-outro", user_id: OUTRO, empresa_id: null, ambiente: "producao", ativo: true },
    ],
  });
  const r = await handler(post({ cnae: "9511800" }, "token-admin"));
  assertEquals(r.status, 200);
  const { config } = await r.json();
  assertEquals(config.id, "cfg-matriz");
  assertEquals([config.ambiente, config.ativo, config.cnae, config.serie_nfe], ["homologacao", false, "9511800", "9"]);
  // Filial e outro usuário intactos.
  assertEquals(tabelas.fiscal_config.find((l) => l.id === "cfg-filial")!.ambiente, "producao");
  assertEquals(tabelas.fiscal_config.find((l) => l.id === "cfg-outro")!.ativo, true);
  assertEquals(tabelas.fiscal_config.length, 3);
});

Deno.test("campo vazio vira null na gravação", async () => {
  const { handler, tabelas } = montar({ fiscal_config: [{ id: "cfg-matriz", user_id: ADMIN, empresa_id: null, cnae: "9511800", ambiente: "homologacao", ativo: false }] });
  assertEquals((await handler(post({ cnae: "  " }, "token-admin"))).status, 200);
  assertEquals(tabelas.fiscal_config[0].cnae, null);
});

Deno.test("corrida (duas abas): insert barrado pelo índice único vira update da linha que entrou", async () => {
  const tabelas: Record<string, Linha[]> = { fiscal_config: [] };
  const base = bancoFake(tabelas);
  const db = {
    from: (t: string) => {
      const b = base.from(t);
      const insertOriginal = b.insert;
      b.insert = (p: Linha) => {
        // A outra aba gravou entre a leitura e o insert.
        tabelas.fiscal_config.push({ id: "cfg-outra-aba", user_id: ADMIN, empresa_id: null, ambiente: "homologacao", ativo: false });
        insertOriginal(p);
        return { then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } }).then(ok) };
      };
      return b;
    },
  };
  const { handler } = montar(tabelas, { db });
  const r = await handler(post({ cnae: "9511800" }, "token-admin"));
  assertEquals(r.status, 200);
  assertEquals((await r.json()).config.id, "cfg-outra-aba");
  assertEquals(tabelas.fiscal_config.filter((l) => l.user_id === ADMIN && l.empresa_id === null).length, 1);
});

Deno.test("erro do banco: 500 com mensagem genérica (sem detalhe interno)", async () => {
  const tabelas: Record<string, Linha[]> = { fiscal_config: [] };
  const { handler } = montar(tabelas, { db: bancoFake(tabelas, (_t, op) => (op === "insert" ? "falha simulada" : null)) });
  const r = await handler(post(CORPO, "token-admin"));
  assertEquals(r.status, 500);
  assertEquals(await r.json(), { error: "Não foi possível salvar a configuração fiscal." });
});

Deno.test("OPTIONS responde CORS; GET é 405", async () => {
  const { handler } = montar();
  const opt = await handler(new Request("http://local/x", { method: "OPTIONS" }));
  assertEquals([opt.status, opt.headers.get("Access-Control-Allow-Origin")], [200, "*"]);
  assertEquals((await handler(new Request("http://local/x", { method: "GET" }))).status, 405);
});
