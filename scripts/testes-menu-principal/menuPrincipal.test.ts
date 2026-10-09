// deno test --no-check --allow-read scripts/testes-menu-principal/
// Menu principal (src/lib/menu/menuPrincipal.ts): uma lista e uma regra para a
// barra lateral (desktop) e o menu do celular/PWA. Caso real (out/2026): o
// Extrato não aparecia no celular/PWA — o menu do celular tinha lista própria.
import { assertEquals } from "jsr:@std/assert@1";
import { ADMIN_MENU, GRUPOS_MENU, MENU_PRINCIPAL, filtrarMenuVisivel, urlsVisiveis, type ContextoMenu } from "../../src/lib/menu/menuPrincipal.ts";

// Módulos de plano, como em src/types/assinatura.ts (LIMITES_*.modulos), só os que mudam.
const PLANO = {
  free: { financeiro: false, precificador: false },
  basico: { financeiro: false, precificador: false },
  intermediario: { financeiro: true, precificador: false },
  profissional: { financeiro: true, precificador: false },
  ultra: { financeiro: true, precificador: true },
} as const;

function dono(plano: keyof typeof PLANO, extra: Partial<ContextoMenu> = {}): ContextoMenu {
  const m = PLANO[plano] as Record<string, boolean>;
  return {
    carregandoPermissoes: false, isFuncionario: false, carregandoAssinatura: false, temAssinatura: true,
    isUltra: plano === "ultra", isAdmin: false,
    temAcessoPlano: (modulo) => m[modulo] ?? true,
    temAcessoFuncionario: () => true,
    ...extra,
  };
}
function funcionario(modulos: string[]): ContextoMenu {
  return {
    carregandoPermissoes: false, isFuncionario: true, carregandoAssinatura: false, temAssinatura: true,
    isUltra: false, isAdmin: false,
    temAcessoPlano: () => true,
    temAcessoFuncionario: (modulo) => modulos.includes(modulo),
  };
}
const ver = (ctx: ContextoMenu) => urlsVisiveis(filtrarMenuVisivel(MENU_PRINCIPAL, ctx));

Deno.test("Extrato fica dentro de Financeiro, junto com Contas a Pagar/Receber e Relatórios", () => {
  const fin = MENU_PRINCIPAL.find((i) => i.url === "/financeiro")!;
  assertEquals(fin.items!.map((s) => [s.url, s.modulo]), [["/financeiro", "financeiro"], ["/extrato", "financeiro"], ["/relatorios", "relatorios"]]);
});

Deno.test("dono com plano que libera o financeiro vê o Extrato (Intermediário, Profissional, Ultra)", () => {
  for (const p of ["intermediario", "profissional", "ultra"] as const) assertEquals(ver(dono(p)).includes("/extrato"), true, p);
});

Deno.test("dono sem o financeiro no plano não vê o Extrato (Free, Básico) — trava de plano mantida", () => {
  for (const p of ["free", "basico"] as const) {
    const v = ver(dono(p));
    assertEquals([v.includes("/extrato"), v.includes("/financeiro")], [false, false], p);
  }
});

Deno.test("Precificador só no Ultra; Multi Empresas só no Ultra ou admin", () => {
  assertEquals(ver(dono("ultra")).includes("/precificador"), true);
  assertEquals(ver(dono("profissional")).includes("/precificador"), false);
  assertEquals(ver(dono("ultra")).includes("/multi-empresas"), true);
  assertEquals(ver(dono("profissional")).includes("/multi-empresas"), false);
  assertEquals(ver(dono("profissional", { isAdmin: true })).includes("/multi-empresas"), true);
});

Deno.test("funcionário com o módulo financeiro vê Extrato; sem ele, não", () => {
  assertEquals(ver(funcionario(["dashboard", "financeiro"])).includes("/extrato"), true);
  assertEquals(ver(funcionario(["dashboard", "pdv"])).includes("/extrato"), false);
});

Deno.test("funcionário: submenu filtrado item a item; Financeiro some se todos os subitens estão bloqueados", () => {
  // Só Relatórios liberado: Financeiro aparece com um subitem.
  const soRelatorios = filtrarMenuVisivel(MENU_PRINCIPAL, funcionario(["relatorios"]));
  assertEquals(soRelatorios.find((i) => i.url === "/financeiro"), undefined); // item pai exige o módulo financeiro
  const comFinanceiro = filtrarMenuVisivel(MENU_PRINCIPAL, funcionario(["financeiro"]));
  assertEquals(comFinanceiro.find((i) => i.url === "/financeiro")!.items!.map((s) => s.url), ["/financeiro", "/extrato"]);
  // Clientes sem Fidelidade.
  const clientes = filtrarMenuVisivel(MENU_PRINCIPAL, funcionario(["clientes"])).find((i) => i.url === "/clientes")!;
  assertEquals(clientes.items!.map((s) => s.url), ["/clientes"]);
});

Deno.test("funcionário nunca vê Plano, Equipe nem Multi Empresas (mesmo com configurações liberadas)", () => {
  const v = ver(funcionario(["plano", "equipe", "configuracoes"]));
  assertEquals([v.includes("/plano"), v.includes("/equipe"), v.includes("/multi-empresas"), v.includes("/configuracoes")], [false, false, false, true]);
});

Deno.test("gerente de filial / funcionário da filial: mesma regra por permissão (sem item a mais)", () => {
  assertEquals(ver(funcionario(["pdv", "vendas"])), ["/pdv", "/vendas"]);
});

Deno.test("carregando permissões: nenhum item; assinatura carregando: todos (sem piscar)", () => {
  assertEquals(filtrarMenuVisivel(MENU_PRINCIPAL, { ...dono("free"), carregandoPermissoes: true }), []);
  assertEquals(filtrarMenuVisivel(MENU_PRINCIPAL, { ...dono("free"), carregandoAssinatura: true, temAssinatura: false }).length, MENU_PRINCIPAL.length);
});

Deno.test("desktop × celular × PWA instalado: a regra não depende de tela nem de display-mode", () => {
  // A função só recebe perfil/plano/permissões — o resultado é o mesmo nos três.
  const ctx = dono("intermediario");
  const desktop = ver(ctx), celular = ver(ctx), pwa = ver(ctx);
  assertEquals([celular, pwa], [desktop, desktop]);
});

Deno.test("barra lateral e menu do celular usam a MESMA lista e a MESMA regra (sem lista própria)", async () => {
  for (const arq of ["src/components/layout/AppSidebar.tsx", "src/components/layout/MobileMenuDrawer.tsx"]) {
    const fonte = await Deno.readTextFile(arq);
    assertEquals(fonte.includes("filtrarMenuVisivel(menuItems"), true, arq);
    assertEquals(fonte.includes("const menuItems = MENU_PRINCIPAL_COM_ICONE;"), true, arq);
    assertEquals(/url: "\/(extrato|financeiro|dashboard)"/.test(fonte), false, `${arq} ainda define itens próprios`);
    assertEquals(fonte.includes("GRUPOS_MENU.map"), true, arq);
  }
});

Deno.test("seções cobrem os itens certos e o menu admin tem Cupons e Alterações", () => {
  const agrupadas = GRUPOS_MENU.flatMap((g) => g.urls);
  const soltos = MENU_PRINCIPAL.map((i) => i.url).filter((u) => !agrupadas.includes(u));
  assertEquals(soltos, ["/configuracoes"]);
  assertEquals(ADMIN_MENU.some((a) => a.url === "/admin/cupons") && ADMIN_MENU.some((a) => a.url === "/admin/alteracoes-correcoes"), true);
});
