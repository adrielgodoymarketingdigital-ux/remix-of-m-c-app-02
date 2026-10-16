// deno test --no-check scripts/testes-fotos-miniatura/
// Roda as funções reais de src/lib/dispositivos/fotosDispositivoNomes.ts.
import { assertEquals } from "jsr:@std/assert@1";
import {
  arquivosParaRemover,
  caminhoMiniatura,
  ehFotoV2,
  urlMiniatura,
} from "../../src/lib/dispositivos/fotosDispositivoNomes.ts";

const BASE = "https://qztuzcchknptrvkdmdph.supabase.co/storage/v1/object/public/dispositivos-fotos/";

Deno.test("foto v2: miniatura com _thumb antes da extensão", () => {
  assertEquals(urlMiniatura(`${BASE}v2-1760000000000-abc123.jpg`), `${BASE}v2-1760000000000-abc123_thumb.jpg`);
  assertEquals(caminhoMiniatura("v2-1-a.jpg"), "v2-1-a_thumb.jpg");
});

Deno.test("foto antiga (sem v2-): devolve a própria URL, sem 404 extra", () => {
  const antiga = `${BASE}0.6083700139834658.jpg`;
  assertEquals(urlMiniatura(antiga), antiga);
  assertEquals(urlMiniatura(`${BASE}0.69.webp`), `${BASE}0.69.webp`);
  assertEquals(ehFotoV2(antiga), false);
});

Deno.test("só o NOME do arquivo decide (v2- em pasta não conta)", () => {
  assertEquals(urlMiniatura(`${BASE}v2-pasta/0.5.jpg`), `${BASE}v2-pasta/0.5.jpg`);
  assertEquals(ehFotoV2(`${BASE}pasta/v2-x.jpg`), true);
});

Deno.test("query string e fragmento são preservados", () => {
  assertEquals(urlMiniatura(`${BASE}v2-x.jpg?t=1#a`), `${BASE}v2-x_thumb.jpg?t=1#a`);
  assertEquals(urlMiniatura(`${BASE}0.5.jpg?t=1`), `${BASE}0.5.jpg?t=1`);
});

Deno.test("vazio/nulo passam direto", () => {
  assertEquals(urlMiniatura(""), "");
  assertEquals(urlMiniatura(null), null);
  assertEquals(urlMiniatura(undefined), undefined);
});

Deno.test("remoção: v2 apaga principal + miniatura; antiga só a principal", () => {
  assertEquals(arquivosParaRemover(`${BASE}v2-1-a.jpg`), ["v2-1-a.jpg", "v2-1-a_thumb.jpg"]);
  assertEquals(arquivosParaRemover(`${BASE}0.123.png`), ["0.123.png"]);
  assertEquals(arquivosParaRemover(`${BASE}v2-1-a.jpg?t=9`), ["v2-1-a.jpg", "v2-1-a_thumb.jpg"]);
  assertEquals(arquivosParaRemover(""), []);
});
