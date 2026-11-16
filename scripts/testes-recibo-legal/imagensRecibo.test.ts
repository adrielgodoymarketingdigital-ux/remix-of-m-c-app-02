// deno test -A --no-check --config scripts/testes-recibo-legal/deno.json scripts/testes-recibo-legal/
// Regras puras de src/lib/origem/imagensRecibo.ts (imagens do Recibo Legal).
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  LADO_MAXIMO_PX,
  LIMITE_BYTES_IMAGEM,
  MAX_DOCUMENTOS_RECIBO,
  MAX_FOTOS_RECIBO,
  detectarFormatoImagem,
  dimensaoReduzida,
  ehTipoPdf,
  ehUrlPdf,
  limitarQuantidade,
  prepararEmSequencia,
  resumirFalhas,
  tamanhoDentroDoLimite,
  textoResumoFalhas,
  type ImagemPreparada,
} from "../../src/lib/origem/imagensRecibo.ts";
import { GIF, HEIC, HEIF_MIF1, JPEG, PDF, TEXTO, WEBP, png } from "./fixtures.ts";

Deno.test("formato: JPEG, PNG e WebP aceitos pelos primeiros bytes", () => {
  assertEquals(detectarFormatoImagem(JPEG), { aceito: true, formato: "jpeg" });
  assertEquals(detectarFormatoImagem(png(2, 2)), { aceito: true, formato: "png" });
  assertEquals(detectarFormatoImagem(WEBP), { aceito: true, formato: "webp" });
});

Deno.test("formato: HEIC/HEIF, PDF, GIF, vazio e texto recusados com motivo", () => {
  assertEquals(detectarFormatoImagem(HEIC), { aceito: false, motivo: "heic" });
  assertEquals(detectarFormatoImagem(HEIF_MIF1), { aceito: false, motivo: "heic" });
  assertEquals(detectarFormatoImagem(PDF), { aceito: false, motivo: "pdf" });
  assertEquals(detectarFormatoImagem(GIF), { aceito: false, motivo: "gif" });
  assertEquals(detectarFormatoImagem(new Uint8Array()), { aceito: false, motivo: "vazio" });
  assertEquals(detectarFormatoImagem(TEXTO), { aceito: false, motivo: "desconhecido" });
});

Deno.test("formato: bytes truncados não passam por JPEG/PNG/WebP", () => {
  assertEquals(detectarFormatoImagem(new Uint8Array([0xff, 0xd8])), { aceito: false, motivo: "desconhecido" });
  assertEquals(detectarFormatoImagem(png(1, 1).slice(0, 7)), { aceito: false, motivo: "desconhecido" });
  // RIFF que não é WEBP (ex.: WAV)
  const wav = new TextEncoder().encode("RIFF\0\0\0\0WAVEfmt ");
  assertEquals(detectarFormatoImagem(wav), { aceito: false, motivo: "desconhecido" });
});

Deno.test("PDF por URL: URL assinada com ?token terminando em .pdf", () => {
  const assinada = "https://x.supabase.co/storage/v1/object/sign/compras-documentos/u/doc.pdf?token=eyJhbGciOi.abc.def";
  assert(!assinada.toLowerCase().endsWith(".pdf"), "a regra antiga erra este caso");
  assert(ehUrlPdf(assinada));
  assert(ehUrlPdf("https://x/doc.PDF#pagina=2"));
  assert(ehUrlPdf("https://x/meu%20doc.pdf?token=1"));
  assert(ehUrlPdf("data:application/pdf;base64,JVBERi0="));
  assert(!ehUrlPdf("https://x/sign/compras-fotos/u/foto.jpg?token=abc.pdf"));
  assert(!ehUrlPdf("https://x/foto.png"));
  assert(!ehUrlPdf(""));
  assert(!ehUrlPdf(null));
  assert(!ehUrlPdf("https://x/%E0%A4%A.jpg?token=1")); // %-codificação inválida não lança
});

Deno.test("PDF por Content-Type", () => {
  assert(ehTipoPdf("application/pdf"));
  assert(ehTipoPdf("Application/PDF; charset=binary"));
  assert(!ehTipoPdf("image/jpeg"));
  assert(!ehTipoPdf(null));
});

Deno.test("limite de tamanho por imagem (8 MB)", () => {
  assertEquals(LIMITE_BYTES_IMAGEM, 8 * 1024 * 1024);
  assert(tamanhoDentroDoLimite(1));
  assert(tamanhoDentroDoLimite(LIMITE_BYTES_IMAGEM));
  assert(!tamanhoDentroDoLimite(LIMITE_BYTES_IMAGEM + 1));
  assert(!tamanhoDentroDoLimite(0));
  assert(!tamanhoDentroDoLimite(NaN));
});

Deno.test("limite de quantidade: 5 fotos, 2 documentos; vazios fora", () => {
  assertEquals(MAX_FOTOS_RECIBO, 5);
  assertEquals(MAX_DOCUMENTOS_RECIBO, 2);
  const sete = ["a", "b", "c", "d", "e", "f", "g"];
  assertEquals(limitarQuantidade(sete, MAX_FOTOS_RECIBO), { usados: ["a", "b", "c", "d", "e"], ignorados: 2 });
  assertEquals(limitarQuantidade(["a", "", "b"], 5), { usados: ["a", "b"], ignorados: 0 });
  assertEquals(limitarQuantidade(null, 5), { usados: [], ignorados: 0 });
  assertEquals(limitarQuantidade(["x", "y", "z"], MAX_DOCUMENTOS_RECIBO), { usados: ["x", "y"], ignorados: 1 });
});

Deno.test("tamanho proporcional: máx. 1600 no lado maior, sem ampliar", () => {
  assertEquals(LADO_MAXIMO_PX, 1600);
  assertEquals(dimensaoReduzida(4000, 3000), { largura: 1600, altura: 1200 });
  assertEquals(dimensaoReduzida(3000, 4000), { largura: 1200, altura: 1600 });
  assertEquals(dimensaoReduzida(800, 600), { largura: 800, altura: 600 });
  assertEquals(dimensaoReduzida(1600, 1600), { largura: 1600, altura: 1600 });
  assertEquals(dimensaoReduzida(10000, 3), { largura: 1600, altura: 1 });
  assertEquals(dimensaoReduzida(0, 100), { largura: 0, altura: 0 });
  // proporção mantida
  const r = dimensaoReduzida(4032, 3024);
  assert(Math.abs(r.largura / r.altura - 4032 / 3024) < 0.01);
});

const ok = (n: number): ImagemPreparada => ({ dataUrl: `data:image/jpeg;base64,${n}`, motivo: null });
const falha = (motivo: ImagemPreparada["motivo"]): ImagemPreparada => ({ dataUrl: null, motivo });

Deno.test("resumo de falhas: contagem, motivos e texto", () => {
  const r = resumirFalhas([ok(1), falha("http"), ok(2), falha("heic"), ok(3)]);
  assertEquals(r, { total: 5, falhas: 2, porMotivo: { http: 1, heic: 1 } });
  assertEquals(textoResumoFalhas(r), "2 de 5 fotos não carregaram");
  assertEquals(textoResumoFalhas(resumirFalhas([ok(1), falha("rede"), ok(2)])), "1 de 3 fotos não carregou");
  assertEquals(textoResumoFalhas(resumirFalhas([falha("rede")])), "1 de 1 foto não carregou");
  assertEquals(textoResumoFalhas(resumirFalhas([ok(1), ok(2)])), null);
  assertEquals(textoResumoFalhas(resumirFalhas([])), null);
});

Deno.test("resumo de documentos: PDF não conta como falha", () => {
  const r = resumirFalhas([falha("pdf"), falha("http")], { ignorarPdf: true });
  assertEquals(r, { total: 1, falhas: 1, porMotivo: { http: 1 } });
  assertEquals(resumirFalhas([falha("pdf")]).falhas, 1); // para foto, PDF é falha
});

Deno.test("sequência: uma falha (inclusive exceção) não afeta as outras; uma por vez", async () => {
  let emAndamento = 0;
  let maximo = 0;
  const ordem: string[] = [];
  const r = await prepararEmSequencia(["a", "quebra", "b", "", "404", "c"], async (url) => {
    emAndamento++;
    maximo = Math.max(maximo, emAndamento);
    ordem.push(url);
    await new Promise((res) => setTimeout(res, 2));
    emAndamento--;
    if (url === "quebra") throw new Error("explodiu");
    if (url === "404") return { dataUrl: null, motivo: "http", status: 404 };
    return { dataUrl: `data:image/jpeg;base64,${url}`, motivo: null };
  });
  assertEquals(maximo, 1, "processa uma imagem por vez");
  assertEquals(ordem, ["a", "quebra", "b", "404", "c"]);
  assertEquals(r.map((x) => x.dataUrl), [
    "data:image/jpeg;base64,a", null, "data:image/jpeg;base64,b", null, null, "data:image/jpeg;base64,c",
  ]);
  assertEquals(r.map((x) => x.motivo), [null, "rede", null, "vazio", "http", null]);
  assertEquals(textoResumoFalhas(resumirFalhas(r)), "3 de 6 fotos não carregaram");
});
