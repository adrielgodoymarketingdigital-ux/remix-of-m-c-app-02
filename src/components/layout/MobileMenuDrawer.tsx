import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionMeta, SIDEBAR_GRUPOS_EXPANDIDOS_KEY } from "@/lib/sessionStorage";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
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
  ChevronRight,
  X,
  Video,
  Gift,
  Building2,
  Smartphone,
  ClipboardList,
  Settings2,
  PackageCheck,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminBadges } from "@/hooks/useAdminBadges";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useAssinatura } from "@/hooks/useAssinatura";
import type { PermissoesModulos } from "@/types/funcionario";
import { cn } from "@/lib/utils";

interface MobileMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPersonalizarMenu?: () => void;
}

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, modulo: "dashboard" as keyof PermissoesModulos },
  { title: "PDV", url: "/pdv", icon: ShoppingCart, modulo: "pdv" as keyof PermissoesModulos },
  { title: "Ordem de Serviço", url: "/os", icon: ClipboardCheck, modulo: "ordem_servico" as keyof PermissoesModulos },
  { title: "Produtos e Peças", url: "/produtos", icon: Package, modulo: "produtos_pecas" as keyof PermissoesModulos },
  { title: "Comp. Película", url: "/compatibilidade-pelicula", icon: ShieldCheck, modulo: "produtos_pecas" as keyof PermissoesModulos },
  { title: "Serviços", url: "/servicos", icon: WrenchIcon, modulo: "servicos" as keyof PermissoesModulos },
  { title: "Dispositivos", url: "/dispositivos", icon: Tablet, modulo: "dispositivos" as keyof PermissoesModulos },
  { title: "Remessas Corporativas", url: "/remessas", icon: PackageCheck, modulo: "remessas_corporativas" as keyof PermissoesModulos },
  { title: "Catálogo", url: "/catalogo", icon: BookOpen, modulo: "catalogo" as keyof PermissoesModulos },
  { title: "Origem de Dispositivos", url: "/origem-dispositivos", icon: ShoppingBag, modulo: "origem_dispositivos" as keyof PermissoesModulos },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck, modulo: "fornecedores" as keyof PermissoesModulos },
  { title: "Clientes", url: "/clientes", icon: Users, modulo: "clientes" as keyof PermissoesModulos, items: [
    { title: "👥 Clientes", url: "/clientes", icon: Users },
    { title: "🏆 Fidelidade", url: "/fidelidade", icon: Gift },
  ]},
  { title: "Orçamentos", url: "/orcamentos", icon: FileSpreadsheet, modulo: "orcamentos" as keyof PermissoesModulos },
  { title: "Pedidos/Encomendas", url: "/pedidos", icon: ClipboardList, modulo: "pedidos" as keyof PermissoesModulos },
  { title: "Contas", url: "/contas", icon: Receipt, modulo: "contas" as keyof PermissoesModulos },
  { title: "Vendas", url: "/vendas", icon: BarChart3, modulo: "vendas" as keyof PermissoesModulos },
  { title: "Relatórios", url: "/relatorios", icon: FileText, modulo: "relatorios" as keyof PermissoesModulos },
  { title: "Financeiro", url: "/financeiro", icon: FileText, modulo: "financeiro" as keyof PermissoesModulos },
  { title: "Equipe", url: "/equipe", icon: Users, modulo: "equipe" as keyof PermissoesModulos },
  { title: "Configurações", url: "/configuracoes", icon: Settings, modulo: "configuracoes" as keyof PermissoesModulos },
  { title: "Suporte", url: "/suporte", icon: HelpCircle, modulo: "suporte" as keyof PermissoesModulos },
  { title: "Plano", url: "/plano", icon: CreditCard, modulo: "plano" as keyof PermissoesModulos },
  { title: "Tutoriais", url: "/tutoriais", icon: Video, modulo: "tutoriais" as keyof PermissoesModulos },
  { title: "Baixar App", url: "/baixar-app", icon: Smartphone, modulo: "suporte" as keyof PermissoesModulos },
  { title: "Multi Empresas", url: "/multi-empresas", icon: Building2, modulo: "configuracoes" as keyof PermissoesModulos },
];

// Agrupamento visual do menu — só organiza a exibição (ordem/rótulos de seção),
// não altera rotas nem os filtros de permissão/plano aplicados a `menuItems` acima.
// Itens fora de qualquer grupo (hoje só Configurações) ficam soltos, sem rótulo de
// seção acima — Novidades foi removida do menu (rota /novidades continua ativa).
const GRUPOS_MENU: { key: string; label: string; urls: string[] }[] = [
  { key: "atendimento", label: "🛠️ Atendimento", urls: ["/dashboard", "/pdv", "/os", "/orcamentos", "/pedidos"] },
  { key: "estoque", label: "📦 Estoque", urls: ["/produtos", "/compatibilidade-pelicula", "/servicos", "/dispositivos", "/catalogo", "/origem-dispositivos", "/remessas"] },
  { key: "pessoas", label: "👥 Pessoas", urls: ["/clientes", "/fornecedores", "/equipe"] },
  { key: "administrativo", label: "💰 Administrativo", urls: ["/contas", "/vendas", "/relatorios", "/financeiro", "/multi-empresas"] },
  { key: "conta-suporte", label: "🧭 Conta & Suporte", urls: ["/plano", "/suporte", "/tutoriais", "/baixar-app"] },
];
const adminMenuItems = [
  { title: "Usuários", url: "/admin/usuarios", icon: Users, badgeKey: null },
  { title: "Financeiro", url: "/admin/financeiro", icon: CreditCard, badgeKey: null },
  { title: "Novidades", url: "/admin/novidades", icon: Sparkles, badgeKey: null },
  { title: "Onboarding", url: "/admin/onboarding", icon: ClipboardCheck, badgeKey: null },
  { title: "Push Notifications", url: "/admin/push", icon: Bell, badgeKey: null },
  { title: "Feedbacks", url: "/admin/feedbacks", icon: Megaphone, badgeKey: 'feedbacksPendentes' as const },
  { title: "Chat Suporte", url: "/admin/chat", icon: MessageCircle, badgeKey: 'chatsAbertos' as const },
  { title: "Avisos", url: "/admin/avisos", icon: Megaphone, badgeKey: null },
  { title: "Notificações", url: "/admin/notificacoes", icon: Bell, badgeKey: null },
  { title: "Compatibilidade de Película", url: "/admin/compatibilidade-pelicula", icon: Layers, badgeKey: null },
];

// Map routes to tutorial data-tutorial attribute values
const tutorialTargetMap: Record<string, string> = {
  "/os": "sidebar-os",
  "/dispositivos": "sidebar-dispositivos",
  "/vendas": "sidebar-vendas",
  "/pdv": "sidebar-pdv",
  "/financeiro": "sidebar-financeiro",
  "/clientes": "sidebar-clientes",
  "/configuracoes": "sidebar-configuracoes",
};

export function MobileMenuDrawer({ open, onOpenChange, onPersonalizarMenu }: MobileMenuDrawerProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  // Mesma chave do AppSidebar (desktop) — estado compartilhado entre as duas telas.
  // true = expandida. Ausente/false = recolhida (padrão a cada novo login — a chave
  // é apagada no logout por clearSessionMeta). Persiste durante a sessão (F5,
  // navegação, fechar aba), só é limpa no logout explícito.
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>(() => {
    try {
      const salvo = localStorage.getItem(SIDEBAR_GRUPOS_EXPANDIDOS_KEY);
      return salvo ? JSON.parse(salvo) : {};
    } catch {
      return {};
    }
  });
  const { badges } = useAdminBadges(isAdmin);
  const { temAcessoModulo: temAcessoModuloFuncionario, isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const { assinatura, carregando: carregandoAssinatura, temAcessoModulo: temAcessoModuloPlano } = useAssinatura();

  // Verificar admin quando o drawer abrir
  useEffect(() => {
    if (!open) return;
    
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
  }, [open]);

  const menusVisiveis = useMemo(() => {
    if (carregandoPermissoes) return [];

    // Dono da loja: filtrar pelo plano contratado
    // Se assinatura ainda carregando, mostrar todos os menus (evitar piscar/sumir itens)
    if (!isFuncionario) {
      if (carregandoAssinatura && !assinatura) return menuItems;
      return menuItems.filter(item => {
        const modulosSemRestricao: string[] = ['/plano', '/suporte', '/tutoriais', '/baixar-app'];
        if (modulosSemRestricao.includes(item.url)) return true;
        // Módulos que existem em PermissoesModulos mas não em LimitesPlano (sem restrição de plano)
        const modulosSoPorFuncionario: string[] = ['novidades', 'origem_dispositivos', 'relatorios', 'equipe', 'remessas_corporativas'];
        if (modulosSoPorFuncionario.includes(item.modulo)) return true;
        // Módulos sempre visíveis no menu (bloqueio acontece dentro da página via ComVerificacaoPlano)
        const modulosSempreVisiveis: string[] = ['pedidos', 'fornecedores'];
        if (modulosSempreVisiveis.includes(item.modulo)) return true;
        return temAcessoModuloPlano(item.modulo as Parameters<typeof temAcessoModuloPlano>[0]);
      });
    }

    // Funcionário: filtrar por permissões configuradas pelo dono
    return menuItems.filter(item => {
      if (['/plano', '/equipe'].includes(item.url)) return false;
      return temAcessoModuloFuncionario(item.modulo);
    });
  }, [isFuncionario, temAcessoModuloFuncionario, temAcessoModuloPlano, carregandoPermissoes, carregandoAssinatura, assinatura]);

  const handleLogout = async () => {
    clearSessionMeta();
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    onOpenChange(false);
    navigate("/auth");
  };

  const handleNavigate = (url: string) => {
    navigate(url);
    onOpenChange(false);
  };

  const isActive = (path: string) => location.pathname === path;

  const toggleGrupo = (key: string) => {
    setGruposExpandidos(prev => {
      const novo = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(SIDEBAR_GRUPOS_EXPANDIDOS_KEY, JSON.stringify(novo)); } catch { /* noop */ }
      return novo;
    });
  };

  const renderItem = (item: (typeof menuItems)[number]) => {
    const tutorialId = tutorialTargetMap[item.url];
    const temSubmenu = !!(item.items && item.items.length > 0);

    if (temSubmenu) {
      const expandido = !!expandidos[item.title];
      return (
        <div key={item.title}>
          <button
            onClick={() => setExpandidos(prev => ({ ...prev, [item.title]: !expandido }))}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left",
              "active:scale-[0.98] touch-manipulation",
              "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            )}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 text-sm">{item.title}</span>
            <ChevronRight className={cn("h-4 w-4 text-slate-600 transition-transform", expandido && "rotate-90")} />
          </button>
          {expandido && item.items?.map(sub => (
            <button
              key={sub.url}
              onClick={() => handleNavigate(sub.url)}
              className={cn(
                "w-full flex items-center gap-3 pl-10 pr-3 py-2.5 rounded-lg transition-colors text-left",
                "active:scale-[0.98] touch-manipulation",
                isActive(sub.url)
                  ? "bg-blue-500/10 text-blue-400 font-medium border-l-2 border-blue-500"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              )}
            >
              <sub.icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-sm">{sub.title}</span>
            </button>
          ))}
        </div>
      );
    }

    return (
      <button
        key={item.title}
        onClick={() => handleNavigate(item.url)}
        {...(tutorialId ? { "data-tutorial": tutorialId } : {})}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left",
          "active:scale-[0.98] touch-manipulation",
          isActive(item.url)
            ? "bg-blue-500/10 text-blue-400 font-medium border-l-2 border-blue-500"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
        )}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        <span className="flex-1 text-sm">{item.title}</span>
        <ChevronRight className="h-4 w-4 text-slate-600" />
      </button>
    );
  };

  // Itens que não pertencem a nenhum dos grupos temáticos (Novidades e Configurações)
  // ficam soltos na lista, sem rótulo de seção acima.
  const urlsAgrupadas = new Set(GRUPOS_MENU.flatMap(g => g.urls));
  const itensSoltos = menusVisiveis.filter(item => !urlsAgrupadas.has(item.url));

  return (
    <Drawer open={open} onOpenChange={(v) => {
      // Don't close if tutorial is active
      if (!v && document.querySelector('[data-tutorial-active]')) return;
      onOpenChange(v);
    }} modal={false}>
      <DrawerContent className="max-h-[90vh] flex flex-col bg-[hsl(222,47%,6%)] border-t border-white/10">
        <DrawerHeader className="flex-shrink-0 flex items-center justify-between border-b border-white/5 pb-4">
          <DrawerTitle className="text-lg font-semibold text-slate-100">Menu</DrawerTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-400 hover:text-slate-200 hover:bg-white/5"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 overscroll-contain">
          <div className="py-4 space-y-1">
            {carregandoPermissoes ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3">
                  <Skeleton className="h-5 w-5 rounded bg-slate-800" />
                  <Skeleton className="h-4 w-32 bg-slate-800" />
                </div>
              ))
            ) : (
              <>
                {GRUPOS_MENU.map((grupo) => {
                  const itensDoGrupo = grupo.urls
                    .map(url => menusVisiveis.find(item => item.url === url))
                    .filter((item): item is typeof menusVisiveis[number] => !!item);
                  if (itensDoGrupo.length === 0) return null;
                  const grupoColapsado = !gruposExpandidos[grupo.key];
                  return (
                    <div key={grupo.key} className={cn("last:mb-0 mt-2", grupoColapsado ? "mb-1" : "mb-3")}>
                      {/* Cabeçalho de seção — VARIAÇÃO C (mais ousada): painel com fundo e
                          borda própria, cor neutra (zinc, família diferente do slate usado
                          nos itens), tracking bem largo. Mantém active:scale no toque (padrão
                          já usado em todos os botões do drawer), sem nenhum outro feedback. */}
                      <button
                        type="button"
                        onClick={() => toggleGrupo(grupo.key)}
                        className="w-full flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500 active:scale-[0.98] touch-manipulation"
                      >
                        <span>{grupo.label}</span>
                        <ChevronRight className={cn("h-3 w-3 shrink-0 text-zinc-600 transition-transform", !grupoColapsado && "rotate-90")} />
                      </button>
                      {!grupoColapsado && (
                        <div className="space-y-1">
                          {itensDoGrupo.map(renderItem)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {itensSoltos.length > 0 && (
                  <div className="space-y-1">
                    {itensSoltos.map(renderItem)}
                  </div>
                )}
              </>
            )}
          </div>

          {isAdmin && (
            <div className="border-t border-white/5 pt-4 pb-2">
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500">
                <Shield className="h-4 w-4 text-violet-400" />
                <span>Administração</span>
              </div>
              <div className="space-y-1">
                {adminMenuItems.map((item) => {
                  const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;
                  return (
                    <button
                      key={item.title}
                      onClick={() => handleNavigate(item.url)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left",
                        "active:scale-[0.98] touch-manipulation",
                        isActive(item.url)
                          ? "bg-violet-500/10 text-violet-400 font-medium border-l-2 border-violet-500"
                          : "text-slate-400 hover:text-violet-300 hover:bg-violet-500/5"
                      )}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span className="flex-1 text-sm">{item.title}</span>
                      {badgeCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                          {badgeCount}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t border-white/5 py-4 mb-4">
            {onPersonalizarMenu && (
              <button
                onClick={() => {
                  onPersonalizarMenu();
                  onOpenChange(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left active:scale-[0.98] touch-manipulation text-slate-400 hover:text-slate-200 hover:bg-white/5"
              >
                <Settings2 className="h-5 w-5 flex-shrink-0" />
                <span className="flex-1 text-sm">Personalizar menu inferior</span>
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 h-12"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5 mr-3" />
              <span>Sair da conta</span>
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
