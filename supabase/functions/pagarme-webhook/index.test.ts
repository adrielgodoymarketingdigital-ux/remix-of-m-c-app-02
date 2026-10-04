// deno test --allow-env --allow-run --allow-net --allow-read supabase/functions/pagarme-webhook/
// Sobe o index.ts real num subprocesso (std/http serve, porta 8000) e manda
// requisições de verdade. O evento usado é ignorado pelo webhook: nada toca banco.
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

const URL_WEBHOOK = "http://127.0.0.1:8000";
const EVENTO = JSON.stringify({ type: "teste.ignorado", id: "evt_teste" });

async function comWebhook(
  segredo: string | null,
  testar: () => Promise<void>,
): Promise<string> {
  const env: Record<string, string> = {
    PATH: Deno.env.get("PATH") ?? "",
    HOME: Deno.env.get("HOME") ?? "",
    SUPABASE_URL: "http://127.0.0.1:9",
    SUPABASE_SERVICE_ROLE_KEY: "teste",
  };
  const denoDir = Deno.env.get("DENO_DIR");
  if (denoDir) env.DENO_DIR = denoDir;
  if (segredo) env.PAGARME_WEBHOOK_SECRET = segredo;

  const proc = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "--allow-env", "--allow-read", "--no-lock", new URL("./index.ts", import.meta.url).pathname],
    env,
    clearEnv: true, // garante que o "sem segredo" não herda um segredo do ambiente
    stdout: "piped",
    stderr: "piped",
  }).spawn();

  try {
    for (let i = 0; ; i++) {
      try {
        const r = await fetch(URL_WEBHOOK);
        await r.body?.cancel();
        break;
      } catch {
        if (i > 150) throw new Error("webhook não subiu");
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    await testar();
  } finally {
    proc.kill("SIGTERM");
  }
  const { stdout, stderr } = await proc.output();
  return new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
}

async function post(body: string, headers: Record<string, string> = {}) {
  const r = await fetch(URL_WEBHOOK, { method: "POST", body, headers: { "Content-Type": "application/json", ...headers } });
  return { status: r.status, json: await r.json() };
}

async function assinar(segredo: string, corpo: string) {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpo));
  return "sha256=" + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("sem PAGARME_WEBHOOK_SECRET: processa normalmente e avisa no log", async () => {
  const saida = await comWebhook(null, async () => {
    const r = await post(EVENTO); // sem header de assinatura
    assertEquals(r, { status: 200, json: { received: true, ignored: true } });
  });
  assertStringIncludes(saida, "PAGARME_WEBHOOK_SECRET ausente: webhook sem validação de assinatura");
});

Deno.test("com PAGARME_WEBHOOK_SECRET: assinatura inválida ou ausente → 401, válida → processa", async () => {
  const segredo = "segredo_de_teste";
  await comWebhook(segredo, async () => {
    assertEquals(await post(EVENTO, { "X-Hub-Signature": "sha256=" + "0".repeat(64) }), {
      status: 401,
      json: { error: "Invalid signature" },
    });
    assertEquals((await post(EVENTO)).status, 401);
    assertEquals(await post(EVENTO, { "X-Hub-Signature": await assinar(segredo, EVENTO) }), {
      status: 200,
      json: { received: true, ignored: true },
    });
  });
});
