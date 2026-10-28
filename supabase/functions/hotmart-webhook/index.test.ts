// deno test --allow-env --allow-run --allow-net --allow-read supabase/functions/hotmart-webhook/
// Sobe o index.ts real num subprocesso (std/http serve, porta 8000) com um
// Supabase falso em 127.0.0.1:54399 que só registra as chamadas. O
// subprocesso só tem rede para 127.0.0.1 (e escuta em 0.0.0.0:8000): nada
// sai da máquina.
// Os códigos de oferta são inventados para o teste.
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

const URL_WEBHOOK = "http://127.0.0.1:8000";
const PORTA_FALSO = 54399;
const TOKEN = "token-de-teste";
const USER_ID = "11111111-1111-1111-1111-111111111111";

type Chamada = { metodo: string; caminho: string; corpo: unknown };

// Supabase falso: profiles acha o usuário, assinaturas não existe ainda.
function subirSupabaseFalso(chamadas: Chamada[]) {
  return Deno.serve({ port: PORTA_FALSO, hostname: "127.0.0.1", onListen() {} }, async (req) => {
    const url = new URL(req.url);
    const texto = await req.text();
    chamadas.push({ metodo: req.method, caminho: url.pathname, corpo: texto ? JSON.parse(texto) : null });
    const json = (corpo: unknown, status = 200) =>
      new Response(corpo === null ? null : JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
    if (req.method === "GET" && url.pathname === "/rest/v1/profiles") return json({ user_id: USER_ID, nome: "Teste" });
    if (req.method === "GET" && url.pathname === "/rest/v1/assinaturas") return json(null, 200);
    if (url.pathname.startsWith("/functions/v1/")) return json({ ok: true });
    return json(null, 201);
  });
}

async function comWebhook(
  mapa: string | null,
  testar: (chamadas: Chamada[]) => Promise<void>,
): Promise<string> {
  const chamadas: Chamada[] = [];
  const falso = subirSupabaseFalso(chamadas);
  const env: Record<string, string> = {
    PATH: Deno.env.get("PATH") ?? "",
    HOME: Deno.env.get("HOME") ?? "",
    SUPABASE_URL: `http://127.0.0.1:${PORTA_FALSO}`,
    SUPABASE_SERVICE_ROLE_KEY: "teste",
    HOTMART_WEBHOOK_TOKEN: TOKEN,
  };
  const denoDir = Deno.env.get("DENO_DIR");
  if (denoDir) env.DENO_DIR = denoDir;
  if (mapa !== null) env.HOTMART_OFFER_MAP = mapa;

  const proc = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net=127.0.0.1,0.0.0.0:8000", "--allow-env", "--allow-read", "--no-lock", new URL("./index.ts", import.meta.url).pathname],
    env,
    clearEnv: true, // HOTMART_OFFER_MAP do ambiente não vaza para o teste
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
    await testar(chamadas);
  } finally {
    try {
      proc.kill("SIGTERM");
    } catch {
      // já encerrou sozinho: a saída abaixo mostra o porquê
    }
    await falso.shutdown();
  }
  const { stdout, stderr } = await proc.output();
  return new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
}

function evento(offerCode: string | null, event = "PURCHASE_APPROVED") {
  return JSON.stringify({
    event,
    data: {
      buyer: { email: "comprador@exemplo.com", name: "Comprador" },
      offer: offerCode === null ? {} : { code: offerCode },
      purchase: { transaction: "HP-TESTE-1", payment: { type: "CREDIT_CARD" }, price: { value: 10, currency_value: "USD" } },
    },
  });
}

async function post(body: string, token = TOKEN) {
  const r = await fetch(URL_WEBHOOK, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", "x-hotmart-hottok": token },
  });
  return { status: r.status, json: await r.json() };
}

const escritasEmAssinaturas = (c: Chamada[]) =>
  c.filter((x) => x.caminho === "/rest/v1/assinaturas" && x.metodo !== "GET");
const notificacoes = (c: Chamada[]) =>
  c.filter((x) => x.caminho === "/rest/v1/admin_notifications").map((x) => x.corpo as { tipo: string; mensagem: string });

const MAPA_OK = '{"oferta_teste_anual":"basico_anual"}';

Deno.test("sem HOTMART_OFFER_MAP: 500, nada em assinaturas, admin avisado", async () => {
  const log = await comWebhook(null, async (c) => {
    const r = await post(evento("oferta_teste_anual"));
    assertEquals(r.status, 500);
    assertEquals(escritasEmAssinaturas(c), []);
    assertEquals(notificacoes(c).map((n) => n.tipo), ["hotmart_config_invalida"]);
  });
  assertStringIncludes(log, "Mapa de ofertas inválido: evento NÃO processado");
  assertStringIncludes(log, "não configurado");
});

Deno.test("HOTMART_OFFER_MAP com JSON quebrado ou plano inválido: 500, nada em assinaturas", async () => {
  for (const mapa of ["{", '{"oferta_teste_anual":"premium"}', "[]"]) {
    await comWebhook(mapa, async (c) => {
      const r = await post(evento("oferta_teste_anual"));
      assertEquals(r.status, 500, mapa);
      assertEquals(escritasEmAssinaturas(c), [], mapa);
      assertEquals(notificacoes(c).map((n) => n.tipo), ["hotmart_config_invalida"], mapa);
    });
  }
});

Deno.test("oferta não mapeada: 200 sem processar, nada em assinaturas, admin avisado", async () => {
  const log = await comWebhook(MAPA_OK, async (c) => {
    for (const oferta of ["outra_oferta", "__proto__", "constructor", null]) {
      const r = await post(evento(oferta));
      assertEquals(r.status, 200, String(oferta));
      assertEquals(r.json.processed, false, String(oferta));
    }
    assertEquals(escritasEmAssinaturas(c), []);
    assertEquals(notificacoes(c).map((n) => n.tipo), Array(4).fill("hotmart_oferta_nao_mapeada"));
    assertStringIncludes(notificacoes(c)[0].mensagem, "HOTMART_OFFER_MAP");
  });
  assertStringIncludes(log, "offer_code não mapeado: evento NÃO processado");
});

Deno.test("cancelamento de oferta não mapeada também não toca assinaturas", async () => {
  await comWebhook(MAPA_OK, async (c) => {
    const r = await post(evento("outra_oferta", "SUBSCRIPTION_CANCELLATION"));
    assertEquals(r.status, 200);
    assertEquals(escritasEmAssinaturas(c), []);
  });
});

Deno.test("oferta mapeada: assinatura criada com o plano do mapa e a transação", async () => {
  await comWebhook(MAPA_OK, async (c) => {
    const r = await post(evento("oferta_teste_anual"));
    assertEquals(r.status, 200);
    assertEquals(r.json.processed, true);
    const escritas = escritasEmAssinaturas(c);
    assertEquals(escritas[0].metodo, "POST");
    const corpo = escritas[0].corpo as Record<string, unknown>;
    assertEquals(corpo.plano_tipo, "basico_anual");
    assertEquals(corpo.hotmart_transaction_id, "HP-TESTE-1");
    assertEquals(corpo.payment_provider, "hotmart");
    assertEquals(notificacoes(c).map((n) => n.tipo), ["nova_assinatura_hotmart"]);
  });
});

Deno.test("token errado: 401 antes de olhar o mapa (nenhuma notificação)", async () => {
  await comWebhook(null, async (c) => {
    const r = await post(evento("oferta_teste_anual"), "errado");
    assertEquals(r.status, 401);
    assertEquals(c, []);
  });
});
