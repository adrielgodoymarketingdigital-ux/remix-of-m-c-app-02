/**
 * Itens do menu principal e a regra de quem vê cada um — ÚNICA fonte para a
 * barra lateral (desktop, AppSidebar) e o menu do celular/PWA
 * (MobileMenuDrawer). Antes cada um tinha a sua lista e a sua regra, e o
 * celular ficou para trás: sem Extrato (submenu de Financeiro, desde
 * 11c9653), sem Precificador, sem a trava de Ultra do Multi Empresas e sem o
 * filtro de submenus por permissão do funcionário.
 *
 * Os ícones ficam de fora (ver components/layout/iconesMenu.ts): este módulo
 * não depende de React nem do navegador (testado com Deno em
 * scripts/testes-menu-principal/).
 */

export interface SubitemMenu {
  title: string;
  url: string;
  /** Módulo de PermissoesModulos que o funcionário precisa ter; sem módulo = sempre visível. */
  modulo?: string;
}

export interface ItemMenu {
  title: string;
  url: string;
  /** Chave de PermissoesModulos (funcionário) e, quando existir, de LimitesPlano.modulos (dono). */
  modulo: string;
  items?: SubitemMenu[];
}

export const MENU_PRINCIPAL: ItemMenu[] = [
  { title: "Dashboard", url: "/dashboard", modulo: "dashboard" },
  { title: "PDV", url: "/pdv", modulo: "pdv" },
  { title: "Ordem de Serviço", url: "/os", modulo: "ordem_servico" },
  { title: "Produtos e Peças", url: "/produtos", modulo: "produtos_pecas" },
  { title: "Comp. Película/Vidro", url: "/compatibilidade-pelicula", modulo: "produtos_pecas" },
  { title: "Serviços", url: "/servicos", modulo: "servicos" },
  { title: "Dispositivos", url: "/dispositivos", modulo: "dispositivos" },
  { title: "Remessas Corporativas", url: "/remessas", modulo: "remessas_corporativas" },
  { title: "Catálogo", url: "/catalogo", modulo: "catalogo" },
  { title: "Origem de Dispositivos", url: "/origem-dispositivos", modulo: "origem_dispositivos" },
  { title: "Fornecedores", url: "/fornecedores", modulo: "fornecedores" },
  { title: "Clientes", url: "/clientes", modulo: "clientes", items: [
    { title: "👥 Clientes", url: "/clientes", modulo: "clientes" },
    { title: "🏆 Fidelidade", url: "/fidelidade", modulo: "fidelidade" },
  ]},
  { title: "Orçamentos", url: "/orcamentos", modulo: "orcamentos" },
  { title: "Pedidos/Encomendas", url: "/pedidos", modulo: "pedidos" },
  { title: "Contas", url: "/contas", modulo: "contas" },
  { title: "Vendas", url: "/vendas", modulo: "vendas" },
  { title: "Financeiro", url: "/financeiro", modulo: "financeiro", items: [
    { title: "💰 Contas a Pagar/Receber", url: "/financeiro", modulo: "financeiro" },
    { title: "📒 Extrato", url: "/extrato", modulo: "financeiro" },
    { title: "📊 Relatórios", url: "/relatorios", modulo: "relatorios" },
  ]},
  { title: "Equipe", url: "/equipe", modulo: "equipe" },
  { title: "Configurações", url: "/configuracoes", modulo: "configuracoes" },
  { title: "Suporte", url: "/suporte", modulo: "suporte" },
  { title: "Plano", url: "/plano", modulo: "plano" },
  { title: "Tutoriais", url: "/tutoriais", modulo: "tutoriais" },
  { title: "Baixar App", url: "/baixar-app", modulo: "suporte" },
  { title: "Multi Empresas", url: "/multi-empresas", modulo: "configuracoes" },
  { title: "Precificador", url: "/precificador", modulo: "precificador" },
];

/**
 * Seções do menu (só organização visual; a ordem dentro de cada uma é `urls`).
 * Itens fora de qualquer seção (Configurações) ficam soltos.
 */
export const GRUPOS_MENU: { key: string; urls: string[] }[] = [
  { key: "atendimento", urls: ["/dashboard", "/pdv", "/os", "/orcamentos", "/pedidos", "/precificador"] },
  { key: "estoque", urls: ["/produtos", "/compatibilidade-pelicula", "/servicos", "/dispositivos", "/catalogo", "/origem-dispositivos", "/remessas"] },
  { key: "pessoas", urls: ["/clientes", "/fornecedores", "/equipe"] },
  { key: "administrativo", urls: ["/contas", "/vendas", "/financeiro", "/multi-empresas"] },
  { key: "conta-suporte", urls: ["/plano", "/suporte", "/tutoriais", "/baixar-app"] },
];

export const ADMIN_MENU: { title: string; url: string; badgeKey: "feedbacksPendentes" | "chatsAbertos" | null }[] = [
  { title: "Usuários", url: "/admin/usuarios", badgeKey: null },
  { title: "Financeiro", url: "/admin/financeiro", badgeKey: null },
  { title: "Cupons", url: "/admin/cupons", badgeKey: null },
  { title: "Novidades", url: "/admin/novidades", badgeKey: null },
  { title: "Onboarding", url: "/admin/onboarding", badgeKey: null },
  { title: "Push Notifications", url: "/admin/push", badgeKey: null },
  { title: "Feedbacks", url: "/admin/feedbacks", badgeKey: "feedbacksPendentes" },
  { title: "Chat Suporte", url: "/admin/chat", badgeKey: "chatsAbertos" },
  { title: "Avisos", url: "/admin/avisos", badgeKey: null },
  { title: "Notificações", url: "/admin/notificacoes", badgeKey: null },
  { title: "Alterações/Correções", url: "/admin/alteracoes-correcoes", badgeKey: null },
  { title: "Compatibilidade de Película e Vidro", url: "/admin/compatibilidade-pelicula", badgeKey: null },
];

export interface ContextoMenu {
  carregandoPermissoes: boolean;
  isFuncionario: boolean;
  carregandoAssinatura: boolean;
  temAssinatura: boolean;
  isUltra: boolean;
  isAdmin: boolean;
  /** Plano do dono libera o módulo (useAssinatura().temAcessoModulo). */
  temAcessoPlano: (modulo: string) => boolean;
  /** Dono liberou o módulo para o funcionário (useFuncionarioPermissoes().temAcessoModulo). */
  temAcessoFuncionario: (modulo: string) => boolean;
}

// Sem controle de plano: sempre aparecem para o dono.
const URLS_SEM_RESTRICAO = ["/plano", "/suporte", "/tutoriais", "/baixar-app"];
// Existem em PermissoesModulos mas não em LimitesPlano (sem restrição de plano).
const MODULOS_SO_POR_FUNCIONARIO = ["novidades", "origem_dispositivos", "relatorios", "equipe", "remessas_corporativas"];
// Sempre no menu (o bloqueio acontece dentro da página via ComVerificacaoPlano).
const MODULOS_SEMPRE_VISIVEIS = ["pedidos", "fornecedores"];
// Funcionário nunca vê.
const URLS_SO_DONO = ["/plano", "/equipe", "/multi-empresas"];

/**
 * Itens que o usuário vê (a mesma regra em desktop, celular e PWA instalado —
 * nada aqui depende de tela nem de display-mode).
 * - Carregando permissões: nenhum item (o menu mostra esqueleto).
 * - Dono: pelo plano; Multi Empresas só no Ultra (ou admin). Com a assinatura
 *   ainda carregando, todos (evita itens piscando).
 * - Funcionário: pelo que o dono liberou, item e submenu; item com todos os
 *   submenus bloqueados some.
 */
export function filtrarMenuVisivel<T extends ItemMenu>(itens: T[], ctx: ContextoMenu): T[] {
  if (ctx.carregandoPermissoes) return [];

  if (!ctx.isFuncionario) {
    if (ctx.carregandoAssinatura && !ctx.temAssinatura) return itens;
    return itens.filter((item) => {
      if (item.url === "/multi-empresas" && !ctx.isUltra && !ctx.isAdmin) return false;
      if (URLS_SEM_RESTRICAO.includes(item.url)) return true;
      if (MODULOS_SO_POR_FUNCIONARIO.includes(item.modulo)) return true;
      if (MODULOS_SEMPRE_VISIVEIS.includes(item.modulo)) return true;
      return ctx.temAcessoPlano(item.modulo);
    });
  }

  return itens
    .filter((item) => !URLS_SO_DONO.includes(item.url) && ctx.temAcessoFuncionario(item.modulo))
    .map((item): T =>
      item.items && item.items.length > 0
        ? { ...item, items: item.items.filter((sub) => (sub.modulo ? ctx.temAcessoFuncionario(sub.modulo) : true)) }
        : item,
    )
    .filter((item) => (item.items !== undefined ? item.items.length > 0 : true));
}

/** Rotas visíveis (inclui submenus) — para conferência e testes. */
export function urlsVisiveis(itens: ItemMenu[]): string[] {
  return [...new Set(itens.flatMap((i) => (i.items && i.items.length > 0 ? i.items.map((s) => s.url) : [i.url])))];
}
