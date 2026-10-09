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
  LogOut,
  Shield,
  ChevronRight,
  X,
  Settings2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminBadges } from "@/hooks/useAdminBadges";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useAssinatura } from "@/hooks/useAssinatura";
import type { PermissoesModulos } from "@/types/funcionario";
import { ADMIN_MENU_COM_ICONE, ICONES_MENU, MENU_PRINCIPAL_COM_ICONE } from "@/components/layout/iconesMenu";
import { GRUPOS_MENU, filtrarMenuVisivel } from "@/lib/menu/menuPrincipal";
import { cn } from "@/lib/utils";

interface MobileMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPersonalizarMenu?: () => void;
}

// Itens, seções e regra de visibilidade: src/lib/menu/menuPrincipal.ts — os MESMOS
// da barra lateral do desktop (AppSidebar). Antes este menu tinha lista própria e
// ficou sem Extrato, Precificador e as travas de Multi Empresas/submenus.
const menuItems = MENU_PRINCIPAL_COM_ICONE;

// Rótulos das seções no celular (só exibição; itens e ordem vêm de GRUPOS_MENU).
// Itens fora de qualquer seção (hoje só Configurações) ficam soltos.
const ROTULOS_GRUPOS: Record<string, string> = {
  atendimento: "🛠️ Atendimento",
  estoque: "📦 Estoque",
  pessoas: "👥 Pessoas",
  administrativo: "💰 Administrativo",
  "conta-suporte": "🧭 Conta & Suporte",
};
const GRUPOS_MENU_CELULAR = GRUPOS_MENU.map((g) => ({ ...g, label: ROTULOS_GRUPOS[g.key] ?? g.key }));
const adminMenuItems = ADMIN_MENU_COM_ICONE;

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
  // true = expandida. Ausente/false = recolhida (padrão a cada novo login, exceto
  // "atendimento" que já começa expandida — a chave é apagada no logout por
  // clearSessionMeta). Persiste durante a sessão (F5, navegação, fechar aba), só é
  // limpa no logout explícito.
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

  const isUltra = ['profissional_ultra_mensal', 'profissional_ultra_anual'].includes(assinatura?.plano_tipo ?? '');
  // Mesma regra da barra lateral do desktop (menuPrincipal.ts).
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
              {(() => { const IconeSub = ICONES_MENU[sub.url] ?? item.icon; return <IconeSub className="h-4 w-4 flex-shrink-0" />; })()}
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
  const urlsAgrupadas = new Set(GRUPOS_MENU_CELULAR.flatMap(g => g.urls));
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
                {GRUPOS_MENU_CELULAR.map((grupo) => {
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
