// deno test --no-check --allow-read scripts/testes-crm-leads/
// Telefone do CRM de leads: as duas cópias TS (app e Edge Function) são
// idênticas e batem com a lista de casos que o PGlite usa no SQL
// (scripts/crm-leads/casos-telefone.json). Números fictícios.
import { assertEquals } from "jsr:@std/assert@1";
import { mascararTelefone, normalizarTelefone as doApp } from "../../src/lib/marketing/telefoneLead.ts";
import { normalizarTelefone as daFuncao } from "../../supabase/functions/crm-leads/telefone.ts";

const raiz = new URL("../../", import.meta.url);
const ler = (p: string) => Deno.readTextFileSync(new URL(p, raiz));
const { casos } = JSON.parse(ler("scripts/crm-leads/casos-telefone.json")) as { casos: [string | null, string | null][] };

Deno.test("as duas cópias TS têm o mesmo código (fora o cabeçalho)", () => {
  const corpo = (s: string) => s.slice(s.indexOf("export function normalizarTelefone"));
  assertEquals(
    corpo(ler("src/lib/marketing/telefoneLead.ts")),
    corpo(ler("supabase/functions/crm-leads/telefone.ts")),
  );
});

for (const [entrada, esperado] of casos) {
  Deno.test(`normaliza ${JSON.stringify(entrada)} -> ${esperado}`, () => {
    assertEquals(doApp(entrada), esperado);
    assertEquals(daFuncao(entrada), esperado);
  });
}

Deno.test("idempotente: normalizar o resultado devolve o mesmo", () => {
  for (const [entrada] of casos) {
    const n = doApp(entrada);
    if (n) assertEquals(doApp(n), n);
  }
});

Deno.test("máscara nunca mostra mais que DDD e 4 finais", () => {
  assertEquals(mascararTelefone("+5511990000001"), "+55 11 •••••-0001");
  assertEquals(mascararTelefone("+351910000001"), "+35 •••• 0001");
  assertEquals(mascararTelefone(null), "—");
  for (const [entrada] of casos) {
    const n = doApp(entrada);
    if (!n) continue;
    const m = mascararTelefone(n);
    const digitos = m.replace(/\D/g, "");
    // +55 DDD + 4 finais = 8 dígitos visíveis no máximo
    assertEquals(digitos.length <= 8, true, m);
  }
});
