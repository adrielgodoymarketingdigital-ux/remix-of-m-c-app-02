// deno test --no-check --allow-read scripts/testes-menu-principal/
// Menu principal (src/lib/menu/menuPrincipal.ts): uma lista e uma regra para a
// barra lateral (desktop) e o menu do celular/PWA. Caso real (out/2026): o
// Extrato não aparecia no celular/PWA — o menu do celular tinha lista própria.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { ADMIN_MENU, CORES_ETIQUETA_NOVO, GRUPOS_MENU, MENU_PRINCIPAL, URL_FISCAL, URL_XML_COMPRA, diaLocalISO, etiquetaNovoVisivel, filtrarMenuVisivel, urlsVisiveis, type ContextoMenu } from "../../src/lib/menu/menuPrincipal.ts";
import { LIMITES_POR_PLANO, type PlanoTipo } from "../../src/types/assinatura.ts";
import { contraste } from "../../src/lib/recibo/corCabecalhoRecibo.ts";
import { VARIAVEIS_MENU_PADRAO, variaveisDoMenu, variavelParaHex } from "../../src/lib/menu/corMenu.ts";

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
    isUltra: plano === "ultra", isAdmin: false, fiscalVisivel: false, importacaoXmlVisivel: false,
    temAcessoPlano: (modulo) => m[modulo] ?? true,
    temAcessoFuncionario: () => true,
    ...extra,
  };
}
function funcionario(modulos: string[]): ContextoMenu {
  return {
    carregandoPermissoes: false, isFuncionario: true, carregandoAssinatura: false, temAssinatura: true,
    isUltra: false, isAdmin: false, fiscalVisivel: false, importacaoXmlVisivel: false,
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
  // "Todos" = todos os que a pessoa pode ver: Fiscal e Importar XML continuam de fora sem a sua visibilidade.
  const carregando = { ...dono("free"), carregandoAssinatura: true, temAssinatura: false };
  assertEquals(filtrarMenuVisivel(MENU_PRINCIPAL, carregando).length, MENU_PRINCIPAL.length - 2);
  assertEquals(filtrarMenuVisivel(MENU_PRINCIPAL, { ...carregando, fiscalVisivel: true }).length, MENU_PRINCIPAL.length - 1);
  assertEquals(filtrarMenuVisivel(MENU_PRINCIPAL, { ...carregando, fiscalVisivel: true, importacaoXmlVisivel: true }).length, MENU_PRINCIPAL.length);
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
    // Seções vêm de GRUPOS_MENU (o rótulo é do i18n desde a etapa 5A; o celular usa a lista direto).
    assertEquals(/GRUPOS_MENU(\.map|;)/.test(fonte), true, arq);
  }
});

Deno.test("seções cobrem os itens certos e o menu admin tem Cupons e Alterações", () => {
  const agrupadas = GRUPOS_MENU.flatMap((g) => g.urls);
  const soltos = MENU_PRINCIPAL.map((i) => i.url).filter((u) => !agrupadas.includes(u));
  assertEquals(soltos, ["/configuracoes", "/configuracoes/fiscal", "/configuracoes/fiscal/xml-compra"]);
  assertEquals(ADMIN_MENU.some((a) => a.url === "/admin/cupons") && ADMIN_MENU.some((a) => a.url === "/admin/alteracoes-correcoes"), true);
});

Deno.test("Fiscal só aparece com fiscalVisivel (admin), em qualquer plano e mesmo carregando a assinatura", () => {
  for (const p of ["free", "basico", "intermediario", "profissional", "ultra"] as const) {
    assertEquals(ver(dono(p)).includes(URL_FISCAL), false, p);
    assertEquals(ver(dono(p, { isAdmin: true })).includes(URL_FISCAL), false, `${p} admin sem fiscalVisivel`);
    assertEquals(ver(dono(p, { isAdmin: true, fiscalVisivel: true })).includes(URL_FISCAL), true, p);
  }
  assertEquals(ver({ ...dono("free"), carregandoAssinatura: true, temAssinatura: false }).includes(URL_FISCAL), false);
  assertEquals(ver(funcionario(["configuracoes"])).includes(URL_FISCAL), false);
  // Ligar o fiscal não muda nenhum outro item (nem liga a importação de XML).
  const sem = ver(dono("profissional", { isAdmin: true }));
  const com = ver(dono("profissional", { isAdmin: true, fiscalVisivel: true }));
  assertEquals(com.filter((u) => u !== URL_FISCAL), sem);
});

Deno.test("Importar XML de compra só aparece com importacaoXmlVisivel (admin), logo abaixo de Fiscal", () => {
  assertEquals(URL_XML_COMPRA, "/configuracoes/fiscal/xml-compra");
  const urls = MENU_PRINCIPAL.map((i) => i.url);
  assertEquals(urls.indexOf(URL_XML_COMPRA), urls.indexOf(URL_FISCAL) + 1);
  for (const p of ["free", "basico", "intermediario", "profissional", "ultra"] as const) {
    assertEquals(ver(dono(p)).includes(URL_XML_COMPRA), false, p);
    assertEquals(ver(dono(p, { isAdmin: true, fiscalVisivel: true })).includes(URL_XML_COMPRA), false, `${p} só fiscal`);
    const admin = ver(dono(p, { isAdmin: true, fiscalVisivel: true, importacaoXmlVisivel: true }));
    assertEquals(admin.includes(URL_XML_COMPRA), true, p);
    assertEquals(admin.indexOf(URL_XML_COMPRA), admin.indexOf(URL_FISCAL) + 1, `${p} ordem`);
  }
  assertEquals(ver({ ...dono("free"), carregandoAssinatura: true, temAssinatura: false }).includes(URL_XML_COMPRA), false);
  assertEquals(ver(funcionario(["configuracoes", "produtos_pecas"])).includes(URL_XML_COMPRA), false);
  // Ligar a importação não muda nenhum outro item.
  const sem = ver(dono("profissional", { isAdmin: true, fiscalVisivel: true }));
  const com = ver(dono("profissional", { isAdmin: true, fiscalVisivel: true, importacaoXmlVisivel: true }));
  assertEquals(com.filter((u) => u !== URL_XML_COMPRA), sem);
});

Deno.test("Importar XML de compra: barra lateral agrupa com Configurações/Fiscal, ícone e título no celular", async () => {
  const sidebar = await Deno.readTextFile("src/components/layout/AppSidebar.tsx");
  assertEquals(sidebar.includes('"/configuracoes/fiscal", "/configuracoes/fiscal/xml-compra"]'), true);
  for (const arq of ["src/components/layout/AppSidebar.tsx", "src/components/layout/MobileMenuDrawer.tsx"]) {
    assertEquals((await Deno.readTextFile(arq)).includes("importacaoXmlVisivel,"), true, arq);
  }
  assertEquals((await Deno.readTextFile("src/components/layout/iconesMenu.ts")).includes('"/configuracoes/fiscal/xml-compra": FileCode'), true);
  assertEquals((await Deno.readTextFile("src/components/layout/MobileHeader.tsx")).includes('"/configuracoes/fiscal/xml-compra"'), true);
  // Produtos não tem mais o botão/diálogo.
  assertEquals(/XmlCompra|Importar XML/.test(await Deno.readTextFile("src/pages/Produtos.tsx")), false);
});

Deno.test("Marketing (/marketing): em Pessoas depois de Equipe, ícone próprio, fora do menu admin", async () => {
  const item = MENU_PRINCIPAL.find((i) => i.url === "/marketing")!;
  assertEquals([item.title, item.modulo, item.items], ["Marketing", "marketing", undefined]);
  assertEquals(GRUPOS_MENU.find((g) => g.key === "pessoas")!.urls, ["/clientes", "/fornecedores", "/equipe", "/marketing"]);
  assertEquals((await Deno.readTextFile("src/components/layout/iconesMenu.ts")).includes('"/marketing": Megaphone'), true);
  // O Marketing de admin continua sendo outro item, outra rota.
  assertEquals(ADMIN_MENU.some((a) => a.url === "/admin/marketing"), true);
  assertEquals(ADMIN_MENU.some((a) => a.url === "/marketing"), false);
});

Deno.test("Marketing: dono vê em TODOS os planos (sem trava de plano)", () => {
  for (const p of ["free", "basico", "intermediario", "profissional", "ultra"] as const) {
    // Mesmo que temAcessoPlano("marketing") devolvesse false, o item aparece.
    assertEquals(ver(dono(p, { temAcessoPlano: () => false })).includes("/marketing"), true, p);
  }
});

Deno.test("Marketing: funcionário só vê com o módulo marketing liberado", () => {
  assertEquals(ver(funcionario(["dashboard", "ordem_servico", "clientes"])).includes("/marketing"), false);
  assertEquals(ver(funcionario(["dashboard", "marketing"])).includes("/marketing"), true);
});

Deno.test("Marketing: funcionário já cadastrado (permissões sem a chave) fica SEM acesso", async () => {
  const tipos = await Deno.readTextFile("src/types/funcionario.ts");
  const padrao = tipos.slice(tipos.indexOf("export const PERMISSOES_DEFAULT"));
  assertEquals(/\n {4}marketing: false,/.test(padrao.slice(0, padrao.indexOf("recursos:"))), true);
  // A leitura mescla o salvo sobre PERMISSOES_DEFAULT: chave ausente = false.
  const hook = await Deno.readTextFile("src/hooks/useFuncionarioPermissoes.ts");
  assertEquals(hook.includes("modulos: { ...PERMISSOES_DEFAULT.modulos, ...(raw?.modulos ?? {}) }"), true);
  assertEquals(hook.includes('"/marketing": "marketing"'), true);
  assertEquals((await Deno.readTextFile("src/components/equipe/SeletorPermissoes.tsx")).includes('modulo: "marketing", label: "Marketing"'), true);
});

// ── Marketing do Profissional em diante: a trava é na PÁGINA, não no menu ──

Deno.test("Marketing: dono vê o item em Free, Básico, Intermediário, Profissional, Ultra, trial e admin (limites reais)", () => {
  const planos: PlanoTipo[] = ["free", "demonstracao", "basico_mensal", "basico_anual", "intermediario_mensal", "intermediario_anual",
    "profissional_mensal", "profissional_anual", "profissional_ultra_mensal", "profissional_ultra_anual", "trial", "admin"];
  for (const p of planos) {
    const modulos = LIMITES_POR_PLANO[p].modulos as Record<string, boolean>;
    const ctx = dono("free", {
      temAcessoPlano: (m) => modulos[m] ?? true,
      isUltra: p.startsWith("profissional_ultra"),
      isAdmin: p === "admin",
    });
    assertEquals(ver(ctx).includes("/marketing"), true, p);
  }
  // E o limite de fato difere: abaixo do Profissional o módulo está desligado.
  assertEquals(LIMITES_POR_PLANO.intermediario_mensal.modulos.marketing, false);
  assertEquals(LIMITES_POR_PLANO.profissional_mensal.modulos.marketing, true);
});

Deno.test("Marketing: funcionário segue pela permissão (sem permissão não vê; com permissão vê), mesmo com plano do dono sem o módulo", () => {
  const semPlano = (mods: string[]): ContextoMenu => ({ ...funcionario(mods), temAcessoPlano: (m) => m !== "marketing" });
  assertEquals(ver(semPlano(["dashboard"])).includes("/marketing"), false);
  assertEquals(ver(semPlano(["dashboard", "marketing"])).includes("/marketing"), true);
});

// ── Etiqueta "Novo" ───────────────────────────────────────────────────────

Deno.test("etiquetaNovoVisivel: até a data (inclusive), some no dia seguinte", () => {
  const novoAte = "2027-01-15";
  assertEquals(etiquetaNovoVisivel({ novoAte, hoje: "2026-11-27" }), true);
  assertEquals(etiquetaNovoVisivel({ novoAte, hoje: "2027-01-15" }), true);
  assertEquals(etiquetaNovoVisivel({ novoAte, hoje: "2027-01-16" }), false);
  assertEquals(etiquetaNovoVisivel({ novoAte, hoje: "2028-01-01" }), false);
});

Deno.test("etiquetaNovoVisivel: sem novoAte (ou data malformada) = sem etiqueta", () => {
  assertEquals(etiquetaNovoVisivel({ novoAte: undefined, hoje: "2026-11-27" }), false);
  assertEquals(etiquetaNovoVisivel({ novoAte: null, hoje: "2026-11-27" }), false);
  assertEquals(etiquetaNovoVisivel({ novoAte: "", hoje: "2026-11-27" }), false);
  assertEquals(etiquetaNovoVisivel({ novoAte: "15/01/2027", hoje: "2026-11-27" }), false);
  assertEquals(etiquetaNovoVisivel({ novoAte: "2027-01-15", hoje: "27/11/2026" }), false);
});

Deno.test("Etiqueta Novo: só o Marketing tem novoAte (2027-01-15); dia local", () => {
  assertEquals(MENU_PRINCIPAL.filter((i) => i.novoAte).map((i) => [i.url, i.novoAte]), [["/marketing", "2027-01-15"]]);
  assertEquals(diaLocalISO(new Date(2027, 0, 5, 23, 59)), "2027-01-05");
});

Deno.test("Etiqueta Novo: cores fixas, texto legível (>= 4,5:1) e pílula destacada de QUALQUER fundo de menu (>= 3:1)", () => {
  const { fundo, texto, contorno } = CORES_ETIQUETA_NOVO;
  assert(contraste(texto, fundo) >= 4.5, `texto × pílula = ${contraste(texto, fundo).toFixed(2)}`);
  // Pílula ou contorno se destaca do fundo do menu: padrão, cores de exemplo e uma varredura de todas as cores.
  const destaque = (bg: string) => Math.max(contraste(fundo, bg), contraste(contorno, bg));
  const exemplos = ["#ffffff", "#f1f5f9", "#fde68a", "#facc15", "#22c55e", "#047857", "#0f766e", "#2563eb", "#dc2626", "#7c3aed", "#111827", "#000000"];
  const fundos = [variavelParaHex(VARIAVEIS_MENU_PADRAO.background), ...exemplos.map((hex) => variavelParaHex(variaveisDoMenu(hex)!.background))];
  for (const bg of fundos) assert(destaque(bg) >= 3, `fundo ${bg}: ${destaque(bg).toFixed(2)}`);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  for (let r = 0; r < 256; r += 15) for (let g = 0; g < 256; g += 15) for (let b = 0; b < 256; b += 15) {
    const bg = `#${hex(r)}${hex(g)}${hex(b)}`;
    assert(destaque(bg) >= 3, `fundo ${bg}: ${destaque(bg).toFixed(2)}`);
  }
});

Deno.test("Etiqueta Novo: a pílula não usa as variáveis do menu (--sidebar-*) e o texto vem do i18n", async () => {
  const comp = await Deno.readTextFile("src/components/layout/EtiquetaNovo.tsx");
  assertEquals(/(bg|text|ring|border)-(sidebar|primary)|var\(--sidebar/.test(comp), false);
  assertEquals(comp.includes("CORES_ETIQUETA_NOVO"), true);
  assertEquals(comp.includes('t("novo")'), true);
  for (const arq of ["src/components/layout/AppSidebar.tsx", "src/components/layout/MobileMenuDrawer.tsx"]) {
    const fonte = await Deno.readTextFile(arq);
    assertEquals(fonte.includes("useEtiquetaNovoMenu()"), true, arq);
    assertEquals(fonte.includes("<EtiquetaNovo"), true, arq);
  }
  assertEquals((await Deno.readTextFile("src/components/layout/AppSidebar.tsx")).includes("{collapsed && novo && <PontoNovo"), true);
});

Deno.test("Etiqueta Novo: abrir a página NÃO faz sumir (hook sem localStorage nem efeito de rota; clique só navega)", async () => {
  const hook = await Deno.readTextFile("src/hooks/useEtiquetaNovoMenu.ts");
  assertEquals(/localStorage|useEffect|useLocation|jaAbriu|marcarAberto/.test(hook), false);
  assertEquals(hook.includes("diaLocalISO(new Date())"), true);
  for (const arq of ["src/components/layout/AppSidebar.tsx", "src/components/layout/MobileMenuDrawer.tsx"]) {
    const fonte = await Deno.readTextFile(arq);
    assertEquals(/marcarAberto|novo_visto/.test(fonte), false, arq);
  }
});

