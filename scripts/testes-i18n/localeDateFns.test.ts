// deno test --no-check --allow-read --allow-env scripts/testes-i18n/
// Locale do date-fns: ptBR já carregado; es/en/it sob demanda.
import { assertEquals, assertStrictEquals } from "jsr:@std/assert@1";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { carregarLocaleDateFns, localeDateFnsCarregado } from "../../src/lib/i18n/localeDateFns.ts";

Deno.test("pt-BR já vem carregado e é o ptBR de sempre", async () => {
  assertStrictEquals(localeDateFnsCarregado("pt-BR"), ptBR);
  assertStrictEquals(await carregarLocaleDateFns("pt-BR"), ptBR);
});

Deno.test("es/en/it só depois de carregar; depois ficam em cache", async () => {
  assertEquals(localeDateFnsCarregado("es"), null);
  const es = await carregarLocaleDateFns("es");
  assertEquals(es.code, "es");
  assertStrictEquals(localeDateFnsCarregado("es"), es);
  assertEquals((await carregarLocaleDateFns("en")).code, "en-US");
  assertEquals((await carregarLocaleDateFns("it")).code, "it");
  const d = new Date(2026, 9, 26);
  assertEquals(format(d, "EEEE, d 'de' MMMM", { locale: es }), "lunes, 26 de octubre");
  assertEquals(format(d, "EEEE, d 'de' MMMM", { locale: ptBR }), "segunda-feira, 26 de outubro");
});
