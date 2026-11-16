// deno test -A --no-check --config scripts/testes-recibo-legal/deno.json scripts/testes-recibo-legal/
// Carregador de src/lib/origem/carregarImagensRecibo.ts com rede FALSA (fetchFn)
// e decodificação falsa (o canvas de verdade é provado na página teste.local).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { carregarImagemRecibo, carregarImagensRecibo } from "../../src/lib/origem/carregarImagensRecibo.ts";
import { GIF, HEIC, JPEG, PDF, TEXTO, WEBP, png } from "./fixtures.ts";

type Rota = { status?: number; corpo?: Uint8Array; tipo?: string; tamanhoDeclarado?: number; demoraMs?: number; erro?: boolean };

function redeFalsa(rotas: Record<string, Rota>) {
  const pedidos: string[] = [];
  const fetchFn = ((entrada: string, init?: RequestInit) => {
    const url = String(entrada);
    pedidos.push(url);
    const r = rotas[url];
    return new Promise<Response>((resolve, reject) => {
      const responder = () => {
        if (!r || r.erro) return reject(new TypeError("Failed to fetch"));
        const h = new Headers();
        if (r.tipo) h.set("content-type", r.tipo);
        if (r.tamanhoDeclarado !== undefined) h.set("content-length", String(r.tamanhoDeclarado));
        resolve(new Response(r.status && r.status >= 300 ? "erro" : (r.corpo ?? new Uint8Array()), { status: r.status ?? 200, headers: h }));
      };
      const t = setTimeout(responder, r?.demoraMs ?? 0);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      });
    });
  }) as unknown as typeof fetch;
  return { fetchFn, pedidos };
}

const decodificar = async (blob: Blob) => `data:image/jpeg;base64,DECOD-${blob.size}`;

const ROTAS: Record<string, Rota> = {
  "https://t/jpeg": { corpo: JPEG, tipo: "image/jpeg" },
  "https://t/png": { corpo: png(3, 2), tipo: "image/png" },
  "https://t/webp": { corpo: WEBP, tipo: "image/webp" },
  "https://t/404": { status: 404 },
  "https://t/400": { status: 400 },
  "https://t/heic-como-jpg": { corpo: HEIC, tipo: "image/jpeg" },
  "https://t/gif": { corpo: GIF, tipo: "image/gif" },
  "https://t/texto": { corpo: TEXTO, tipo: "image/jpeg" },
  "https://t/vazio": { corpo: new Uint8Array(), tipo: "image/jpeg" },
  "https://t/pdf-tipo": { corpo: PDF, tipo: "application/pdf" },
  "https://t/pdf-bytes": { corpo: PDF, tipo: "application/octet-stream" },
  "https://t/grande-declarado": { corpo: JPEG, tipo: "image/jpeg", tamanhoDeclarado: 9 * 1024 * 1024 },
  "https://t/grande-real": { corpo: new Uint8Array(64), tipo: "image/jpeg" },
  "https://t/lenta": { corpo: JPEG, demoraMs: 200 },
  "https://t/caiu": { erro: true },
};

const carregar = (url: string, extra: Parameters<typeof carregarImagemRecibo>[1] = {}) => {
  const rede = redeFalsa(ROTAS);
  return carregarImagemRecibo(url, { fetchFn: rede.fetchFn, decodificar, ...extra });
};

Deno.test("carrega JPEG, PNG e WebP e devolve data URL JPEG", async () => {
  for (const u of ["https://t/jpeg", "https://t/png", "https://t/webp"]) {
    const r = await carregar(u);
    assertEquals(r.motivo, null, u);
    assert(r.dataUrl?.startsWith("data:image/jpeg"), u);
  }
});

Deno.test("falhas com motivo: http, heic, gif, texto, vazio, pdf, rede", async () => {
  assertEquals(await carregar("https://t/404"), { dataUrl: null, motivo: "http", status: 404 });
  assertEquals(await carregar("https://t/400"), { dataUrl: null, motivo: "http", status: 400 });
  assertEquals(await carregar("https://t/heic-como-jpg"), { dataUrl: null, motivo: "heic" });
  assertEquals(await carregar("https://t/gif"), { dataUrl: null, motivo: "gif" });
  assertEquals(await carregar("https://t/texto"), { dataUrl: null, motivo: "desconhecido" });
  assertEquals(await carregar("https://t/vazio"), { dataUrl: null, motivo: "vazio" });
  assertEquals(await carregar("https://t/pdf-tipo"), { dataUrl: null, motivo: "pdf" });
  assertEquals(await carregar("https://t/pdf-bytes"), { dataUrl: null, motivo: "pdf" });
  assertEquals(await carregar("https://t/caiu"), { dataUrl: null, motivo: "rede" });
  assertEquals(await carregar(""), { dataUrl: null, motivo: "vazio" });
});

Deno.test("URL assinada de PDF nem é baixada", async () => {
  const rede = redeFalsa(ROTAS);
  const r = await carregarImagemRecibo("https://t/sign/doc.pdf?token=abc", { fetchFn: rede.fetchFn, decodificar });
  assertEquals(r, { dataUrl: null, motivo: "pdf" });
  assertEquals(rede.pedidos.length, 0);
});

Deno.test("limite de tamanho: pelo cabeçalho e pelo corpo", async () => {
  assertEquals(await carregar("https://t/grande-declarado"), { dataUrl: null, motivo: "muito_grande" });
  assertEquals(await carregar("https://t/grande-real", { limiteBytes: 32 }), { dataUrl: null, motivo: "muito_grande" });
});

Deno.test("tempo máximo por imagem aborta o fetch", async () => {
  const t0 = Date.now();
  assertEquals(await carregar("https://t/lenta", { tempoMaximoMs: 30 }), { dataUrl: null, motivo: "tempo_esgotado" });
  assert(Date.now() - t0 < 180, "não esperou a resposta lenta");
});

Deno.test("decodificação que falha vira motivo, não exceção", async () => {
  const r = await carregar("https://t/jpeg", { decodificar: async () => null });
  assertEquals(r, { dataUrl: null, motivo: "decodificacao" });
  const r2 = await carregar("https://t/jpeg", { decodificar: () => Promise.reject(new Error("canvas")) });
  assertEquals(r2, { dataUrl: null, motivo: "decodificacao" });
});

Deno.test("lote: falhas não afetam as outras, cada imagem baixada uma vez, ordem mantida", async () => {
  const rede = redeFalsa(ROTAS);
  const r = await carregarImagensRecibo(
    {
      fotos: ["https://t/jpeg", "https://t/404", "https://t/png", "https://t/heic-como-jpg", "https://t/webp", "https://t/png"],
      documentoFrente: "https://t/sign/rg.pdf?token=x",
      documentoVerso: "https://t/caiu",
    },
    { fetchFn: rede.fetchFn, decodificar },
  );
  assertEquals(r.fotos.map((f) => f.motivo), [null, "http", null, "heic", null]);
  assertEquals(r.fotosIgnoradas, 1);
  assertEquals(r.resumoFotos, { total: 5, falhas: 2, porMotivo: { http: 1, heic: 1 } });
  assertEquals(r.documentoFrente, { dataUrl: null, motivo: "pdf" });
  assertEquals(r.documentoVerso, { dataUrl: null, motivo: "rede" });
  assertEquals(r.resumoDocumentos, { total: 1, falhas: 1, porMotivo: { rede: 1 } });
  // 5 fotos + 1 documento (o PDF não é baixado); nenhuma URL repetida
  assertEquals(rede.pedidos, ["https://t/jpeg", "https://t/404", "https://t/png", "https://t/heic-como-jpg", "https://t/webp", "https://t/caiu"]);
});

Deno.test("lote: só verso, sem frente, cai na posição certa", async () => {
  const rede = redeFalsa(ROTAS);
  const r = await carregarImagensRecibo({ fotos: [], documentoVerso: "https://t/jpeg" }, { fetchFn: rede.fetchFn, decodificar });
  assertEquals(r.documentoFrente, null);
  assertEquals(r.documentoVerso?.motivo, null);
  assertEquals(r.fotos, []);
  assertEquals(r.resumoFotos.total, 0);
});
