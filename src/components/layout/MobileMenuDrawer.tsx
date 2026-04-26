import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionMeta } from "@/lib/sessionStorage";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminBadges } from "@/hooks/useAdminBadges";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import type { PermissoesModulos } from "@/types/funcionario";
import { cn } from "@/lib/utils";

interface MobileMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
  { title: "Clientes", url: "/clientes", icon: Users, modulo: "clientes" as keyof PermissoesModulos },
  { title: "Orçamentos", url: "/orcamentos", icon: FileSpreadsheet, modulo: "orcamentos" as keyof PermissoesModulos },
  { title: "Contas", url: "/contas", icon: Receipt, modulo: "contas" as keyof PermissoesModulos },
  { title: "Vendas", url: "/vendas", icon: BarChart3, modulo: "vendas" as keyof PermissoesModulos },
  { title: "Relatórios", url: "/relatorios", icon: FileText, modulo: "relatorios" as keyof PermissoesModulos },
  { title: "Financeiro", url: "/financeiro", icon: FileText, modulo: "financeiro" as keyof PermissoesModulos },
  { title: "Equipe", url: "/equipe", icon: Users, modulo: "equipe" as keyof PermissoesModulos },
  { title: "Configurações", url: "/configuracoes", icon: Settings, modulo: "configuracoes" as keyof PermissoesModulos },
  { title: "Suporte", url: "/suporte", icon: HelpCircle, modulo: "suporte" as keyof PermissoesModulos },
  { title: "Plano", url: "/plano", icon: CreditCard, modulo: "plano" as keyof PermissoesModulos },
  { title: "Novidades", url: "/novidades", icon: Sparkles, modulo: "novidades" as keyof PermissoesModulos },
  { title: "Tutoriais", url: "/tutoriais", icon: Video, modulo: "tutoriais" as keyof PermissoesModulos },
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

export function MobileMenuDrawer({ open, onOpenChange }: MobileMenuDrawerProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const { badges } = useAdminBadges(isAdmin);
  const { temAcessoModulo, isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();

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
    if (!isFuncionario) return menuItems;
    
    return menuItems.filter(item => {
      if (['/plano', '/equipe'].includes(item.url)) return false;
      return temAcessoModulo(item.modulo);
    });
  }, [isFuncionario, temAcessoModulo, carregandoPermissoes]);

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
              menusVisiveis.map((item) => {
                const tutorialId = tutorialTargetMap[item.url];
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
              })
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
