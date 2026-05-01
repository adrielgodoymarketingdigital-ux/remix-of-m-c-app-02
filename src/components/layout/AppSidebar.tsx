import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionMeta } from "@/lib/sessionStorage";
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
  LayoutDashboard,
  ShoppingCart,
  Wrench,
  Package,
  DollarSign,
  FileText,
  LogOut,
  WrenchIcon,
  Tablet,
  ClipboardCheck,
  Truck,
  Receipt,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  ShoppingBag,
  HelpCircle,
  Shield,
  Webhook,
  Bell,
  FileSpreadsheet,
  BookOpen,
  Megaphone,
  MessageCircle,
  Sparkles,
  Target,
  PanelLeftClose,
  PanelLeft,
  Video,
  Gift,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAdminBadges } from "@/hooks/useAdminBadges";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import type { PermissoesModulos } from "@/types/funcionario";

// Menu destacado de Novidades
const novidadesItem = { title: "Novidades", url: "/novidades", icon: Sparkles, modulo: "novidades" as keyof PermissoesModulos };

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, modulo: "dashboard" as keyof PermissoesModulos },
  { title: "PDV", url: "/pdv", icon: ShoppingCart, modulo: "pdv" as keyof PermissoesModulos },
  { title: "Ordem de Serviço", url: "/os", icon: ClipboardCheck, modulo: "ordem_servico" as keyof PermissoesModulos },
  { title: "Produtos e Peças", url: "/produtos", icon: Package, modulo: "produtos_pecas" as keyof PermissoesModulos },
  { title: "Serviços", url: "/servicos", icon: WrenchIcon, modulo: "servicos" as keyof PermissoesModulos },
  { title: "Dispositivos", url: "/dispositivos", icon: Tablet, modulo: "dispositivos" as keyof PermissoesModulos },
  { title: "Catálogo", url: "/catalogo", icon: BookOpen, modulo: "catalogo" as keyof PermissoesModulos },
  { title: "Origem de Dispositivos", url: "/origem-dispositivos", icon: ShoppingBag, modulo: "origem_dispositivos" as keyof PermissoesModulos },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck, modulo: "fornecedores" as keyof PermissoesModulos },
  { title: "Clientes", url: "/clientes", icon: Users, modulo: "clientes" as keyof PermissoesModulos, items: [
    { title: "👥 Clientes", url: "/clientes" },
    { title: "🏆 Fidelidade", url: "/fidelidade" },
  ]},
  { title: "Orçamentos", url: "/orcamentos", icon: FileSpreadsheet, modulo: "orcamentos" as keyof PermissoesModulos },
  
  { title: "Vendas", url: "/vendas", icon: BarChart3, modulo: "vendas" as keyof PermissoesModulos },
  { title: "Relatórios", url: "/relatorios", icon: FileText, modulo: "relatorios" as keyof PermissoesModulos },
  { title: "Financeiro", url: "/financeiro", icon: FileText, modulo: "financeiro" as keyof PermissoesModulos },
  { title: "Equipe", url: "/equipe", icon: Users, modulo: "equipe" as keyof PermissoesModulos },
  { title: "Configurações", url: "/configuracoes", icon: Settings, modulo: "configuracoes" as keyof PermissoesModulos },
  { title: "Suporte", url: "/suporte", icon: HelpCircle, modulo: "suporte" as keyof PermissoesModulos },
  { title: "Plano", url: "/plano", icon: CreditCard, modulo: "plano" as keyof PermissoesModulos },
  { title: "Tutoriais", url: "/tutoriais", icon: Video, modulo: "tutoriais" as keyof PermissoesModulos },
];

const adminMenuItems = [
  { title: "Usuários", url: "/admin/usuarios", icon: Users, badgeKey: null },
  { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign, badgeKey: null },
  { title: "Novidades", url: "/admin/novidades", icon: Sparkles, badgeKey: null },
  { title: "Onboarding", url: "/admin/onboarding", icon: ClipboardCheck, badgeKey: null },
  { title: "Push Notifications", url: "/admin/push", icon: Bell, badgeKey: null },
  { title: "Feedbacks", url: "/admin/feedbacks", icon: Megaphone, badgeKey: 'feedbacksPendentes' as const },
  { title: "Chat Suporte", url: "/admin/chat", icon: MessageCircle, badgeKey: 'chatsAbertos' as const },
  { title: "Avisos", url: "/admin/avisos", icon: Megaphone, badgeKey: null },
  { title: "Notificações", url: "/admin/notificacoes", icon: Bell, badgeKey: null },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const collapsed = state === "collapsed";
  const [isAdmin, setIsAdmin] = useState(false);
  const [clientesExpandido, setClientesExpandido] = useState(false);
  const { badges } = useAdminBadges(isAdmin);
  const { temAcessoModulo, isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();

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

  // Filtrar menus baseado nas permissões do funcionário
  const menusVisiveis = useMemo(() => {
    // Se ainda está carregando, não mostrar nenhum menu (loading state)
    if (carregandoPermissoes) {
      return [];
    }
    
    // Dono da loja (não é funcionário) vê todos os menus
    if (!isFuncionario) {
      return menuItems;
    }
    
    // Para funcionários, filtrar baseado nas permissões configuradas
    return menuItems.filter(item => {
      // Funcionários NUNCA veem Plano nem Equipe (regra obrigatória)
      if (['/plano', '/equipe'].includes(item.url)) {
        return false;
      }
      // Verificar permissão do módulo conforme configurado pelo dono
      return temAcessoModulo(item.modulo);
    });
  }, [isFuncionario, temAcessoModulo, carregandoPermissoes]);

  // Verificar se novidades está visível (não mostrar durante loading)
  const novidadesVisivel = !carregandoPermissoes && (!isFuncionario || temAcessoModulo(novidadesItem.modulo));

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

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Menu Novidades Destacado */}
              {novidadesVisivel && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={novidadesItem.url}
                      end
                      className="bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 transition-all rounded-md shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)]"
                      activeClassName="from-blue-500 to-blue-400 text-white font-medium"
                    >
                      <novidadesItem.icon className="h-5 w-5" />
                      {!collapsed && <span className="font-medium">{novidadesItem.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup data-tutorial="sidebar-menu">
          <SidebarGroupLabel className={`text-slate-500 ${collapsed ? "justify-center" : ""}`}>
            {!collapsed && "Menu Principal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {carregandoPermissoes ? (
                // Skeleton loading para os menus
                Array.from({ length: 6 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <Skeleton className="h-5 w-5 rounded bg-slate-800" />
                      {!collapsed && <Skeleton className="h-4 w-24 bg-slate-800" />}
                    </div>
                  </SidebarMenuItem>
                ))
              ) : (
                menusVisiveis.map((item) => {
                  // Map URL to tutorial target
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
                  const expandido = temSubmenu && clientesExpandido;
                  return (
                    <SidebarMenuItem key={item.title} data-tutorial={tutorialAttr}>
                      <SidebarMenuButton asChild={!temSubmenu}>
                        {temSubmenu ? (
                          <button
                            onClick={() => setClientesExpandido(v => !v)}
                            className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
                          >
                            <item.icon className="h-5 w-5 shrink-0" />
                            {!collapsed && (
                              <>
                                <span className="flex-1 text-left">{item.title}</span>
                                <ChevronRight className={`h-4 w-4 transition-transform ${expandido ? "rotate-90" : ""}`} />
                              </>
                            )}
                          </button>
                        ) : (
                          <NavLink
                            to={item.url}
                            end
                            className="text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
                            activeClassName="bg-blue-500/10 text-blue-400 font-medium border-l-2 border-blue-500"
                          >
                            <item.icon className="h-5 w-5" />
                            {!collapsed && <span>{item.title}</span>}
                          </NavLink>
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
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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

        <div className="mt-auto p-4 border-t border-white/5">
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10"
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
