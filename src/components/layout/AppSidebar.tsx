import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionMeta, SIDEBAR_GRUPOS_EXPANDIDOS_KEY } from "@/lib/sessionStorage";
import logoMec from "@/assets/logo-mec-sistema.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Wrench,
  Package,
  LogOut,
  Receipt,
  Users,
  HelpCircle,
  Shield,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAdminBadges } from "@/hooks/useAdminBadges";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import type { PermissoesModulos } from "@/types/funcionario";
import { SeletorFilial } from "@/components/layout/SeletorFilial";
import { ADMIN_MENU_COM_ICONE, MENU_PRINCIPAL_COM_ICONE } from "@/components/layout/iconesMenu";
import { GRUPOS_MENU, filtrarMenuVisivel } from "@/lib/menu/menuPrincipal";
import { useAssinatura } from "@/hooks/useAssinatura";

// Menu de Ajuda: sempre visível para todos os usuários logados, sem restrição de permissão/plano
const ajudaItem = { title: "Ajuda", url: "/ajuda", icon: HelpCircle };

// Itens, seções e regra de visibilidade: src/lib/menu/menuPrincipal.ts (os mesmos
// do menu do celular/PWA, MobileMenuDrawer). Ícones: ./iconesMenu.
const menuItems = MENU_PRINCIPAL_COM_ICONE;

// Rótulo e ícone de cada seção do Menu Principal (só exibição; a ordem dos itens
// dentro de cada seção vem de GRUPOS_MENU). `icon` reaproveita, quando possível, o
// ícone de um item da própria seção (Package = "Produtos e Peças", Users =
// "Clientes"/"Equipe", Receipt = "Contas", HelpCircle = "Suporte"). Wrench
// (Atendimento) segue o sentido do emoji 🛠️ original.
const ROTULOS_GRUPOS: Record<string, { label: string; icon: LucideIcon }> = {
  atendimento: { label: "Atendimento", icon: Wrench },
  estoque: { label: "Estoque", icon: Package },
  pessoas: { label: "Pessoas", icon: Users },
  administrativo: { label: "Administrativo", icon: Receipt },
  "conta-suporte": { label: "Conta & Suporte", icon: HelpCircle },
};
const GRUPOS_MENU_SIDEBAR = GRUPOS_MENU.map((g) => ({ ...g, ...ROTULOS_GRUPOS[g.key] }));
// Sem label visível — Configurações é renderizada solta, sem cabeçalho de seção.
const GRUPO_CONFIGURACOES = { key: "configuracoes", urls: ["/configuracoes"] };

const adminMenuItems = ADMIN_MENU_COM_ICONE;

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const collapsed = state === "collapsed";
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  // true = seção expandida. Ausente/false = recolhida (padrão a cada novo login,
  // exceto "atendimento" que já começa expandida — ver clearSessionMeta, que apaga
  // essa chave no logout). Persiste em localStorage durante a sessão (sobrevive a
  // F5/navegação/fechar aba), só é limpa no logout.
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>(() => {
    try {
      const salvo = localStorage.getItem(SIDEBAR_GRUPOS_EXPANDIDOS_KEY);
      return salvo ? JSON.parse(salvo) : { atendimento: true };
    } catch {
      return { atendimento: true };
    }
  });
  const { badges } = useAdminBadges(isAdmin);
  const { temAcessoModulo: temAcessoModuloFuncionario, isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const { assinatura, carregando: carregandoAssinatura, temAcessoModulo: temAcessoModuloPlano } = useAssinatura();
  const isUltra = ['profissional_ultra_mensal', 'profissional_ultra_anual'].includes(assinatura?.plano_tipo ?? '');

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, []);

  // Filtrar menus pelas permissões do funcionário E pelo plano (regra em menuPrincipal.ts).
  const menusVisiveis = useMemo(() => filtrarMenuVisivel(menuItems, {
    carregandoPermissoes,
    isFuncionario,
    carregandoAssinatura,
    temAssinatura: !!assinatura,
    isUltra,
    isAdmin,
    temAcessoPlano: (modulo) => temAcessoModuloPlano(modulo as Parameters<typeof temAcessoModuloPlano>[0]),
    temAcessoFuncionario: (modulo) => temAcessoModuloFuncionario(modulo as keyof PermissoesModulos),
  }), [isFuncionario, temAcessoModuloFuncionario, temAcessoModuloPlano, carregandoPermissoes, carregandoAssinatura, assinatura, isUltra, isAdmin]);

  const handleLogout = async () => {
    clearSessionMeta();
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/auth");
  };

  const isActive = (path: string) => location.pathname === path;

  const toggleGrupo = (key: string) => {
    setGruposExpandidos(prev => {
      const novo = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(SIDEBAR_GRUPOS_EXPANDIDOS_KEY, JSON.stringify(novo)); } catch { /* noop */ }
      return novo;
    });
  };

  // Renderiza um item de menu (com ou sem submenu) — reaproveitado pelos grupos
  // recolhíveis e pelo item solto "Configurações".
  const renderMenuItem = (item: (typeof menuItems)[number]) => {
    const tutorialMap: Record<string, string> = {
      "/os": "sidebar-os",
      "/dispositivos": "sidebar-dispositivos",
      "/vendas": "sidebar-vendas",
      "/pdv": "sidebar-pdv",
      "/financeiro": "sidebar-financeiro",
      "/clientes": "sidebar-clientes",
      "/configuracoes": "sidebar-configuracoes",
    };
    const tutorialAttr = tutorialMap[item.url];
    const temSubmenu = !!(item.items && item.items.length > 0);
    const subRotaAtiva = temSubmenu && item.items!.some(sub => location.pathname === sub.url);
    const estadoManual = expandidos[item.url];
    const expandido = temSubmenu && (estadoManual !== undefined ? estadoManual : subRotaAtiva);
    const isItemActive = !temSubmenu && location.pathname === item.url;
    return (
      <SidebarMenuItem key={item.title} data-tutorial={tutorialAttr}>
        <SidebarMenuButton
          onClick={temSubmenu
            ? () => setExpandidos(prev => ({ ...prev, [item.url]: !expandido }))
            : () => navigate(item.url)
          }
          isActive={isItemActive}
          className={
            temSubmenu && subRotaAtiva && !expandido
              ? "bg-blue-500/10 text-blue-400 font-medium border-l-2 border-blue-500"
              : isItemActive
              ? "bg-blue-500/10 text-blue-400 font-medium border-l-2 border-blue-500"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }
        >
          {temSubmenu ? (
            <>
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.title}</span>
                  <ChevronRight className={`h-4 w-4 transition-transform ${expandido ? "rotate-90" : ""}`} />
                </>
              )}
            </>
          ) : (
            <>
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </>
          )}
        </SidebarMenuButton>
        {!collapsed && expandido && item.items?.map(sub => (
          <SidebarMenuButton key={sub.url} asChild>
            <NavLink
              to={sub.url}
              end
              className="text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all pl-8 text-sm"
              activeClassName="bg-blue-500/10 text-blue-400 font-medium border-l-2 border-blue-500"
            >
              <span>{sub.title}</span>
            </NavLink>
          </SidebarMenuButton>
        ))}
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className={`hidden lg:flex border-r border-white/5 bg-[hsl(222,47%,6%)] ${collapsed ? "w-16" : "w-64"}`}>
      <SidebarContent className="relative">
        {/* Subtle glow effect at top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className={`flex items-center border-b border-white/5 ${collapsed ? 'p-2 justify-center flex-col gap-2' : 'p-4 justify-between'}`}>
          <img
            src={logoMec}
            alt="Méc"
            className={`flex-shrink-0 object-contain transition-all ${collapsed ? 'h-10' : 'h-16'}`}
          />
          <SidebarTrigger className="hidden md:flex h-8 w-8 hover:bg-white/5 text-slate-400 hover:text-slate-200">
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </SidebarTrigger>
        </div>
        {!collapsed && (
          <div className="px-4 py-2 border-b border-white/5">
            <SeletorFilial />
          </div>
        )}

        {carregandoPermissoes ? (
          <SidebarGroup data-tutorial="sidebar-menu">
            <SidebarGroupContent>
              <SidebarMenu>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <Skeleton className="h-5 w-5 rounded bg-slate-800" />
                      {!collapsed && <Skeleton className="h-4 w-24 bg-slate-800" />}
                    </div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            {GRUPOS_MENU_SIDEBAR.map((grupo, idx) => {
              const itensDoGrupo = grupo.urls
                .map(url => menusVisiveis.find(item => item.url === url))
                .filter((item): item is typeof menusVisiveis[number] => !!item);
              if (itensDoGrupo.length === 0) return null;
              const grupoColapsado = !collapsed && !gruposExpandidos[grupo.key];
              return (
                <SidebarGroup
                  key={grupo.key}
                  data-tutorial={idx === 0 ? "sidebar-menu" : undefined}
                  className={grupoColapsado ? "py-0.5" : undefined}
                >
                  {/* Cabeçalho de seção — VARIAÇÃO C (mais ousada): painel com fundo e borda
                      própria (bg-white/[0.06] + border), cor neutra (zinc, família diferente
                      do slate usado nos itens), tracking bem largo, SEM feedback de hover
                      (cor estática) — só o cursor-pointer indica que é clicável. */}
                  <SidebarGroupLabel asChild className={`h-auto mt-2 ${collapsed ? "justify-center" : ""}`}>
                    <button
                      type="button"
                      onClick={() => !collapsed && toggleGrupo(grupo.key)}
                      className={`w-full flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-2 cursor-pointer text-zinc-500 ${collapsed ? "justify-center" : "justify-between"}`}
                    >
                      {!collapsed && (
                        <>
                          <span className="flex items-center gap-1.5 min-w-0">
                            <grupo.icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                            <span className="truncate text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">{grupo.label}</span>
                          </span>
                          <ChevronRight className={`h-3 w-3 shrink-0 text-zinc-600 transition-transform ${grupoColapsado ? "" : "rotate-90"}`} />
                        </>
                      )}
                    </button>
                  </SidebarGroupLabel>
                  {!grupoColapsado && (
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {itensDoGrupo.map(renderMenuItem)}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  )}
                </SidebarGroup>
              );
            })}

            {/* Configurações: item solto, sem cabeçalho/rótulo de seção acima */}
            {(() => {
              const configItem = menusVisiveis.find(item => item.url === GRUPO_CONFIGURACOES.urls[0]);
              if (!configItem) return null;
              return (
                <SidebarGroup>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {renderMenuItem(configItem)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })()}
          </>
        )}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className={`text-slate-500 ${collapsed ? "justify-center" : ""}`}>
              {!collapsed && <span className="flex items-center gap-2"><Shield className="h-4 w-4 text-violet-400" /> Admin</span>}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => {
                  const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end
                          className="text-slate-400 hover:text-violet-300 hover:bg-violet-500/5 transition-all relative"
                          activeClassName="bg-violet-500/10 text-violet-400 font-medium border-l-2 border-violet-500"
                        >
                          <div className="relative">
                            <item.icon className="h-5 w-5" />
                            {badgeCount > 0 && (
                              <Badge 
                                variant="destructive" 
                                className="absolute -top-2 -right-2 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center animate-pulse"
                              >
                                {badgeCount > 9 ? '9+' : badgeCount}
                              </Badge>
                            )}
                          </div>
                          {!collapsed && (
                            <span className="flex items-center gap-2">
                              {item.title}
                              {badgeCount > 0 && (
                                <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                                  {badgeCount}
                                </Badge>
                              )}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <div className="mt-auto p-4 border-t border-white/5 space-y-1">
          <Button
            variant="ghost"
            className={`w-full text-slate-400 hover:text-slate-200 hover:bg-white/5 ${collapsed ? "justify-center" : "justify-start"} ${location.pathname.startsWith(ajudaItem.url) ? "bg-blue-500/10 text-blue-400 font-medium" : ""}`}
            onClick={() => navigate(ajudaItem.url)}
          >
            <ajudaItem.icon className="h-5 w-5" />
            {!collapsed && <span className="ml-2">{ajudaItem.title}</span>}
          </Button>
          <Button
            variant="ghost"
            className={`w-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 ${collapsed ? "justify-center" : "justify-start"}`}
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
