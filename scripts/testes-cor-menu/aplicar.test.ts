// deno test --no-check --no-lock --allow-read scripts/testes-cor-menu/
// Aplicação no <html> e lembrança no localStorage (src/lib/menu/aplicarCorMenu.ts),
// com document e localStorage simulados.
import { assert, assertEquals } from "jsr:@std/assert@1";

const props = new Map<string, string>();
const armazenado = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: { style: { setProperty: (n: string, v: string) => props.set(n, v), removeProperty: (n: string) => props.delete(n) } } };
g.window = { localStorage: { getItem: (k: string) => armazenado.get(k) ?? null, setItem: (k: string, v: string) => armazenado.set(k, v), removeItem: (k: string) => armazenado.delete(k) } };

const { aplicarCorMenu, aplicarCorMenuLembrada, assinarCorMenu, corMenuAplicada, CHAVE_LOCAL_COR_MENU } = await import("../../src/lib/menu/aplicarCorMenu.ts");
const { NOMES_VARIAVEIS_MENU, variaveisDoMenu } = await import("../../src/lib/menu/corMenu.ts");

Deno.test("sem cor lembrada: abrir o app não define nenhuma variável", () => {
  aplicarCorMenuLembrada();
  assertEquals(props.size, 0);
  assertEquals(corMenuAplicada(), null);
});

Deno.test("aplicar cor: as 12 variáveis --sidebar-* e a lembrança local", () => {
  let avisos = 0;
  const sair = assinarCorMenu(() => avisos++);
  aplicarCorMenu("#4A0E1C");
  const v = variaveisDoMenu("#4a0e1c")!;
  assertEquals(props.size, NOMES_VARIAVEIS_MENU.length);
  for (const n of NOMES_VARIAVEIS_MENU) assertEquals(props.get(`--sidebar-${n}`), v[n]);
  assertEquals(armazenado.get(CHAVE_LOCAL_COR_MENU), "#4a0e1c");
  assertEquals(corMenuAplicada(), "#4a0e1c");
  aplicarCorMenu("#4a0e1c");
  assertEquals(avisos, 1, "mesma cor não avisa de novo");
  sair();
});

Deno.test("sem cor (null) ou inválida: tira tudo — vale o CSS padrão", () => {
  aplicarCorMenu("#000000");
  aplicarCorMenu(null);
  assertEquals(props.size, 0);
  assert(!armazenado.has(CHAVE_LOCAL_COR_MENU));
  assertEquals(corMenuAplicada(), null);
  aplicarCorMenu("#000000");
  aplicarCorMenu("lixo");
  assertEquals(props.size, 0);
  assertEquals(corMenuAplicada(), null);
});

Deno.test("cor lembrada é aplicada antes do primeiro render; lixo no localStorage é ignorado", () => {
  armazenado.set(CHAVE_LOCAL_COR_MENU, "#1f2937");
  aplicarCorMenuLembrada();
  assertEquals(corMenuAplicada(), "#1f2937");
  assertEquals(props.get("--sidebar-background"), variaveisDoMenu("#1f2937")!.background);
  aplicarCorMenu(null);
  armazenado.set(CHAVE_LOCAL_COR_MENU, "red;background:url(x)");
  aplicarCorMenuLembrada();
  assertEquals(props.size, 0);
});

Deno.test("localStorage bloqueado não quebra", () => {
  const antigo = g.window;
  g.window = { localStorage: { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); }, removeItem: () => { throw new Error("bloqueado"); } } };
  aplicarCorMenuLembrada();
  aplicarCorMenu("#000000");
  assertEquals(corMenuAplicada(), "#000000");
  aplicarCorMenu(null);
  g.window = antigo;
});
