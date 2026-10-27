// deno test --no-check scripts/testes-i18n/
// Textos do namespace "menu": o pt-BR tem de ser LETRA POR LETRA o de
// src/lib/menu/menuPrincipal.ts (o menu do Brasil não pode mudar), e o es tem
// de cobrir todas as chaves (o piloto é o menu inteiro).
import { assert, assertEquals } from "jsr:@std/assert@1";
import menuPtBR from "../../src/locales/pt-BR/menu.ts";
import menuEs from "../../src/locales/es/menu.ts";
import comumPtBR from "../../src/locales/pt-BR/comum.ts";
import comumEs from "../../src/locales/es/comum.ts";
import { ADMIN_MENU, GRUPOS_MENU, MENU_PRINCIPAL } from "../../src/lib/menu/menuPrincipal.ts";
import { chaveDaRota } from "../../src/lib/i18n/chaves.ts";

type Arvore = { [k: string]: string | Arvore };

function folhas(o: Arvore, prefixo = ""): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string") m.set(prefixo + k, v);
    else for (const [kk, vv] of folhas(v, `${prefixo}${k}.`)) m.set(kk, vv);
  }
  return m;
}

Deno.test("chaveDaRota", () => {
  assertEquals(chaveDaRota("/os"), "os");
  assertEquals(chaveDaRota("/configuracoes/fiscal/xml-compra"), "configuracoes_fiscal_xml-compra");
  assertEquals(chaveDaRota("/admin/compatibilidade-pelicula"), "admin_compatibilidade-pelicula");
  for (const item of [...MENU_PRINCIPAL, ...ADMIN_MENU]) assert(!chaveDaRota(item.url).includes("."), item.url);
});

Deno.test("pt-BR do menu = títulos de menuPrincipal.ts, letra por letra", () => {
  const itens = menuPtBR.itens as Record<string, string>;
  const subitens = menuPtBR.subitens as Record<string, string>;
  const admin = menuPtBR.admin.itens as Record<string, string>;
  assertEquals(Object.keys(itens).sort(), MENU_PRINCIPAL.map((i) => chaveDaRota(i.url)).sort());
  for (const item of MENU_PRINCIPAL) {
    assertEquals(itens[chaveDaRota(item.url)], item.title, item.url);
    for (const sub of item.items ?? []) assertEquals(subitens[chaveDaRota(sub.url)], sub.title, sub.url);
  }
  assertEquals(Object.keys(subitens).length, MENU_PRINCIPAL.flatMap((i) => i.items ?? []).length);
  assertEquals(Object.keys(admin).sort(), ADMIN_MENU.map((i) => chaveDaRota(i.url)).sort());
  for (const item of ADMIN_MENU) assertEquals(admin[chaveDaRota(item.url)], item.title, item.url);
  assertEquals(Object.keys(menuPtBR.grupos).sort(), GRUPOS_MENU.map((g) => g.key).sort());
  // Textos que estavam escritos direto no AppSidebar antes da etapa 4:
  assertEquals(menuPtBR.grupos, {
    atendimento: "Atendimento", estoque: "Estoque", pessoas: "Pessoas", administrativo: "Administrativo", "conta-suporte": "Conta & Suporte",
  });
  assertEquals([menuPtBR.ajuda, menuPtBR.sair, menuPtBR.admin.mostrarMenu, menuPtBR.admin.verComoUsuario], ["Ajuda", "Sair", "Mostrar menu admin", "Ver como usuário"]);
});

Deno.test("es cobre todas as chaves do menu e do comum, sem chave a mais e sem texto vazio", () => {
  for (const [pt, es] of [[menuPtBR, menuEs], [comumPtBR, comumEs]] as [Arvore, Arvore][]) {
    const fPt = folhas(pt);
    const fEs = folhas(es);
    assertEquals([...fEs.keys()].sort(), [...fPt.keys()].sort());
    for (const [k, v] of fEs) assert(v.trim().length > 0, k);
  }
});

Deno.test("nenhum texto concatena frase nem usa interpolação no menu (convenções)", () => {
  for (const [k, v] of [...folhas(menuPtBR as Arvore), ...folhas(menuEs as Arvore)]) {
    assert(!/\{\{|\$\{/.test(v), `${k}: ${v}`);
  }
});
