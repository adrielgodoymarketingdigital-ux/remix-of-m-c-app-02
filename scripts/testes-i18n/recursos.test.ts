// deno test --no-check scripts/testes-i18n/
// Textos do namespace "menu": o pt-BR tem de ser LETRA POR LETRA o de
// src/lib/menu/menuPrincipal.ts (o menu do Brasil não pode mudar), e o es tem
// de cobrir todas as chaves (o piloto é o menu inteiro).
import { assert, assertEquals } from "jsr:@std/assert@1";
import menuPtBR from "../../src/locales/pt-BR/menu.ts";
import menuEs from "../../src/locales/es/menu.ts";
import comumPtBR from "../../src/locales/pt-BR/comum.ts";
import comumEs from "../../src/locales/es/comum.ts";
import dashboardPtBR from "../../src/locales/pt-BR/dashboard.ts";
import dashboardEs from "../../src/locales/es/dashboard.ts";
import configuracoesPtBR from "../../src/locales/pt-BR/configuracoes.ts";
import configuracoesEs from "../../src/locales/es/configuracoes.ts";
import pdvPtBR from "../../src/locales/pt-BR/pdv.ts";
import pdvEs from "../../src/locales/es/pdv.ts";
import vendasPtBR from "../../src/locales/pt-BR/vendas.ts";
import vendasEs from "../../src/locales/es/vendas.ts";
import servicosPtBR from "../../src/locales/pt-BR/servicos.ts";
import servicosEs from "../../src/locales/es/servicos.ts";
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

const NAMESPACES: [string, Arvore, Arvore][] = [
  ["comum", comumPtBR as Arvore, comumEs as Arvore],
  ["menu", menuPtBR as Arvore, menuEs as Arvore],
  ["dashboard", dashboardPtBR as Arvore, dashboardEs as Arvore],
  ["configuracoes", configuracoesPtBR as Arvore, configuracoesEs as Arvore],
  ["pdv", pdvPtBR as Arvore, pdvEs as Arvore],
  ["vendas", vendasPtBR as Arvore, vendasEs as Arvore],
  ["servicos", servicosPtBR as Arvore, servicosEs as Arvore],
];

// Listas (frases do dia) viram folhas "frases.0", "frases.1"...
function folhasComListas(o: Arvore | readonly string[], prefixo = ""): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string") m.set(prefixo + k, v);
    else for (const [kk, vv] of folhasComListas(v as Arvore, `${prefixo}${k}.`)) m.set(kk, vv);
  }
  return m;
}

const variaveis = (t: string) => [...t.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
const marcas = (t: string) => [...t.matchAll(/<\/?(\w+)\/?>/g)].map((m) => m[0]).sort();

Deno.test("es cobre todas as chaves de cada namespace, sem chave a mais e sem texto vazio", () => {
  for (const [ns, pt, es] of NAMESPACES) {
    const fPt = folhasComListas(pt);
    const fEs = folhasComListas(es);
    assertEquals([...fEs.keys()].sort(), [...fPt.keys()].sort(), ns);
    for (const [k, v] of fEs) assert(v.trim().length > 0, `${ns}:${k}`);
  }
});

Deno.test("es usa as mesmas {{variáveis}} e <marcas> do pt-BR; nada de ${} no texto", () => {
  for (const [ns, pt, es] of NAMESPACES) {
    const fPt = folhasComListas(pt);
    for (const [k, v] of folhasComListas(es)) {
      const base = k.replace(/_(zero|one|other)$/, "");
      // a forma plural do es pode não ter {{count}} quando o pt também não tem
      assertEquals(variaveis(v), variaveis(fPt.get(k) ?? fPt.get(`${base}_other`) ?? ""), `${ns}:${k}`);
      assertEquals(marcas(v), marcas(fPt.get(k) ?? ""), `${ns}:${k}`);
      assert(!v.includes("${"), `${ns}:${k}`);
    }
  }
});

Deno.test("plural: toda chave com _one tem _zero e _other (texto próprio para zero)", () => {
  for (const [ns, pt, es] of NAMESPACES) {
    for (const f of [folhasComListas(pt), folhasComListas(es)]) {
      for (const k of f.keys()) {
        const m = k.match(/^(.*)_(zero|one|other)$/);
        if (!m) continue;
        for (const forma of ["zero", "one", "other"]) assert(f.has(`${m[1]}_${forma}`), `${ns}:${m[1]}_${forma}`);
      }
    }
  }
});

Deno.test("pt-BR da barra inferior e do cabeçalho do celular = textos de antes da etapa 5A", () => {
  assertEquals(menuPtBR.barraInferior.itens, {
    dashboard: "Dashboard", pdv: "PDV", os: "OS", dispositivos: "Dispositivos", produtos: "Produtos", servicos: "Serviços",
    clientes: "Clientes", vendas: "Vendas", financeiro: "Financeiro", catalogo: "Catálogo", origem: "Origem",
    fornecedores: "Fornecedores", orcamentos: "Orçamentos", relatorios: "Relatórios", configuracoes: "Config", plano: "Plano",
    novidades: "Novidades", suporte: "Suporte", tutoriais: "Tutoriais",
  });
  // routeTitles de MobileHeader.tsx (origin/main 02777f4), pela chaveDaRota.
  const antes: Record<string, string> = {
    "/dashboard": "Dashboard", "/pdv": "PDV", "/os": "Ordens de Serviço", "/produtos": "Produtos e Peças", "/servicos": "Serviços",
    "/dispositivos": "Dispositivos", "/catalogo": "Catálogo", "/origem-dispositivos": "Origem", "/fornecedores": "Fornecedores",
    "/clientes": "Clientes", "/orcamentos": "Orçamentos", "/contas": "Contas", "/vendas": "Vendas", "/relatorios": "Relatórios",
    "/financeiro": "Financeiro", "/equipe": "Equipe", "/configuracoes": "Configurações", "/configuracoes/fiscal": "Fiscal",
    "/configuracoes/fiscal/xml-compra": "Importar XML", "/suporte": "Suporte", "/plano": "Meu Plano", "/novidades": "Novidades",
    "/admin/usuarios": "Usuários", "/admin/financeiro": "Financeiro", "/admin/novidades": "Novidades", "/admin/onboarding": "Onboarding",
    "/admin/push": "Push", "/admin/feedbacks": "Feedbacks", "/admin/chat": "Chat", "/admin/avisos": "Avisos",
    "/admin/notificacoes": "Notificações", "/admin/compatibilidade-pelicula": "Compatibilidade de Película",
    "/compatibilidade-pelicula": "Compatibilidade de Película",
  };
  assertEquals(menuPtBR.cabecalho.titulos, Object.fromEntries(Object.entries(antes).map(([r, t]) => [chaveDaRota(r), t])));
});

Deno.test("configuracoes: chave = texto pt-BR nos mapas consultados por nome (campos e paletas)", () => {
  for (const mapa of [configuracoesPtBR.campos, configuracoesPtBR.cores.paletas] as Record<string, string>[]) {
    for (const [k, v] of Object.entries(mapa)) assertEquals(v, k);
  }
});
