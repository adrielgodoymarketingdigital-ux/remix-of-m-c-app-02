// deno test --allow-env --allow-run --allow-net --allow-read supabase/functions/webhook-n8n-cadastro/
// Sobe o index.ts real num subprocesso (Deno.serve, porta 8000) com um
// Supabase falso em 127.0.0.1:54398. O subprocesso só tem rede para
// 127.0.0.1 (e escuta em 0.0.0.0:8000): o envio ao n8n é barrado pela
// permissão e nada sai da máquina. O telefone que iria ao n8n é lido do log
// "Sending to n8n", que vem logo antes do envio.
//
// Comparação com a versão da main: INDEX_MAIN=<caminho do index.ts da main>
// roda os mesmos casos nas duas e exige telefone igual nos casos BR.
// Números inventados para o teste.
import { assertEquals } from "jsr:@std/assert@1";

const URL_FUNCAO = "http://127.0.0.1:8000";
const PORTA_FALSO = 54398;
const USER_ID = "22222222-2222-2222-2222-222222222222";

type Perfil = { mercado: string; pais: string } | "erro" | "sem_perfil";

function subirSupabaseFalso(perfil: Perfil, pedidos: string[]) {
  return Deno.serve({ port: PORTA_FALSO, hostname: "127.0.0.1", onListen() {} }, (req) => {
    const url = new URL(req.url);
    pedidos.push(`${req.method} ${url.pathname}`);
    const json = (corpo: unknown, status = 200) =>
      new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
    if (url.pathname === "/auth/v1/user") return json({ id: USER_ID, aud: "authenticated", email: "t@exemplo.com" });
    if (url.pathname === "/rest/v1/profiles") {
      if (perfil === "erro") return json({ code: "42703", message: "column profiles.mercado does not exist" }, 400);
      if (perfil === "sem_perfil") return json({ code: "PGRST116", message: "0 rows" }, 406);
      return json(perfil);
    }
    return json({ erro: "inesperado" }, 500);
  });
}

async function telefoneEnviado(indexTs: string, perfil: Perfil, telefone: string) {
  const pedidos: string[] = [];
  const falso = subirSupabaseFalso(perfil, pedidos);
  const env: Record<string, string> = {
    PATH: Deno.env.get("PATH") ?? "",
    HOME: Deno.env.get("HOME") ?? "",
    SUPABASE_URL: `http://127.0.0.1:${PORTA_FALSO}`,
    SUPABASE_ANON_KEY: "teste",
  };
  const denoDir = Deno.env.get("DENO_DIR");
  if (denoDir) env.DENO_DIR = denoDir;

  const proc = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net=127.0.0.1,0.0.0.0:8000", "--allow-env", "--allow-read", "--no-lock", indexTs],
    env,
    clearEnv: true,
    stdout: "piped",
    stderr: "piped",
  }).spawn();

  let status = 0;
  try {
    for (let i = 0; ; i++) {
      try {
        const r = await fetch(URL_FUNCAO, { method: "OPTIONS" });
        await r.body?.cancel();
        break;
      } catch {
        if (i > 150) throw new Error("função não subiu");
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    const r = await fetch(URL_FUNCAO, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer jwt-de-teste" },
      body: JSON.stringify({ nome: "Loja Teste", telefone, user_id: "ignorado" }),
    });
    status = r.status;
    await r.body?.cancel();
  } finally {
    try {
      proc.kill("SIGTERM");
    } catch {
      // já encerrou
    }
    await falso.shutdown();
  }
  const { stdout, stderr } = await proc.output();
  const log = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
  const m = log.match(/Sending to n8n:.*?telefone: "([^"]*)"/s);
  if (!m) throw new Error(`log sem "Sending to n8n" (status ${status}):\n${log}`);
  // o envio ao n8n tem de ter sido barrado pela permissão de rede
  if (!/NotCapable|Requires net access|PermissionDenied/.test(log)) {
    throw new Error(`o envio ao n8n não foi barrado:\n${log}`);
  }
  return { telefone: m[1], pedidos };
}

const BRANCH = new URL("./index.ts", import.meta.url).pathname;
const MAIN = Deno.env.get("INDEX_MAIN");

const CASOS_BR: Array<[Perfil, string, string]> = [
  [{ mercado: "BR", pais: "BR" }, "11987654321", "5511987654321"],
  [{ mercado: "BR", pais: "BR" }, "5511987654321", "5511987654321"],
  [{ mercado: "BR", pais: "BR" }, "(11) 98765-4321", "5511987654321"],
  [{ mercado: "BR", pais: "BR" }, "55 (21) 3456-7890", "552134567890"],
  [{ mercado: "BR", pais: "BR" }, "+55 11 98765-4321", "5511987654321"],
  ["erro", "11987654321", "5511987654321"],
  ["sem_perfil", "(11) 98765-4321", "5511987654321"],
];
const CASOS_FORA: Array<[Perfil, string, string]> = [
  [{ mercado: "BR", pais: "BR" }, "+52 55 1234 5678", "525512345678"],
  [{ mercado: "ES_LATAM", pais: "BR" }, "+57 300 123 4567", "573001234567"],
  [{ mercado: "ES_LATAM", pais: "BR" }, "54 9 11 2345 6789", "5491123456789"],
  [{ mercado: "ES_LATAM", pais: "BR" }, "56 9 8765 4321", "56987654321"],
  ["erro", "+51 987 654 321", "51987654321"],
];

Deno.test("index.ts: casos BR mandam o mesmo telefone de sempre", async () => {
  for (const [perfil, tel, esperado] of CASOS_BR) {
    const b = await telefoneEnviado(BRANCH, perfil, tel);
    assertEquals(b.telefone, esperado, `${JSON.stringify(perfil)} "${tel}"`);
    assertEquals(b.pedidos, ["GET /auth/v1/user", "GET /rest/v1/profiles"]);
    if (MAIN) {
      const a = await telefoneEnviado(MAIN, perfil, tel);
      assertEquals(b.telefone, a.telefone, `main × branch: ${JSON.stringify(perfil)} "${tel}"`);
    }
  }
});

Deno.test("index.ts: número com + de outro país ou conta fora do BR vão sem o 55", async () => {
  for (const [perfil, tel, esperado] of CASOS_FORA) {
    const b = await telefoneEnviado(BRANCH, perfil, tel);
    assertEquals(b.telefone, esperado, `${JSON.stringify(perfil)} "${tel}"`);
    if (MAIN) {
      const a = await telefoneEnviado(MAIN, perfil, tel);
      assertEquals(a.telefone, "55" + esperado, `main prefixava 55: "${tel}"`);
    }
  }
});
