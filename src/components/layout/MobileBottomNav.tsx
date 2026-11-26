import { NavLink, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MobileMenuDrawer } from "./MobileMenuDrawer";
import { MobileNavCustomizer, allNavOptions, getSelectedNavItems } from "./MobileNavCustomizer";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useCorMenuAplicada } from "@/hooks/useCorMenu";
import type { PermissoesModulos } from "@/types/funcionario";

// Mapeamento de id do nav para módulo de permissão
const NAV_ID_TO_MODULO: Record<string, keyof PermissoesModulos> = {
  dashboard: "dashboard",
  pdv: "pdv",
  os: "ordem_servico",
  dispositivos: "dispositivos",
  produtos: "produtos_pecas",
  servicos: "servicos",
  clientes: "clientes",
  vendas: "vendas",
  
  financeiro: "financeiro",
  catalogo: "catalogo",
  origem: "origem_dispositivos",
  fornecedores: "fornecedores",
  orcamentos: "orcamentos",
  relatorios: "relatorios",
  configuracoes: "configuracoes",
  plano: "plano",
  novidades: "novidades",
  suporte: "suporte",
  equipe: "equipe",
  tutoriais: "tutoriais",
};

// Cores da barra. Sem cor do menu escolhida: as de sempre (classes/estilo idênticos
// aos de antes). Com cor: as variáveis --sidebar-* derivadas dela (src/lib/menu/corMenu.ts).
const COR_PADRAO = {
  nav: "border-border/50",
  fundo: "hsl(var(--foreground) / 0.97)",
  ativo: "text-primary",
  inativo: "text-background/60 hover:text-background",
  linha: "bg-primary",
};
const COR_DO_MENU = {
  nav: "border-sidebar-border",
  fundo: "hsl(var(--sidebar-background) / 0.97)",
  ativo: "text-sidebar-primary",
  inativo: "text-sidebar-foreground hover:text-sidebar-hover-foreground",
  linha: "bg-sidebar-primary",
};

export function MobileBottomNav() {
  const location = useLocation();
  const cor = useCorMenuAplicada() ? COR_DO_MENU : COR_PADRAO;
  // Rótulos: barraInferior.itens.<id> no namespace "menu".
  const { t } = useTranslation("menu");
  const [menuOpen, setMenuOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [selectedNavIds, setSelectedNavIds] = useState<string[]>(getSelectedNavItems);
  const { temAcessoModulo: temAcessoModuloFuncionario, isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const { assinatura, carregando: carregandoAssinatura, temAcessoModulo: temAcessoModuloPlano } = useAssinatura();

  // Listen for tutorial requesting to open the mobile menu
  useEffect(() => {
    const handler = () => setMenuOpen(true);
    window.addEventListener("tutorial-open-mobile-menu", handler);
    return () => window.removeEventListener("tutorial-open-mobile-menu", handler);
  }, []);

  // Filtrar itens da barra inferior baseado nas permissões do funcionário E no plano contratado
  const navItems = useMemo(() => {
    const items = selectedNavIds
      .map((id) => allNavOptions.find((opt) => opt.id === id))
      .filter(Boolean) as typeof allNavOptions;

    if (carregandoPermissoes) return items;

    if (!isFuncionario) {
      // Dono da loja: filtrar pelo plano contratado
      // Se assinatura ainda carregando, mostrar todos os itens (evitar piscar/sumir itens)
      if (carregandoAssinatura && !assinatura) return items;
      return items.filter((item) => {
        const modulosSemRestricao = ["plano", "suporte", "tutoriais"];
        if (modulosSemRestricao.includes(item.id)) return true;
        const modulo = NAV_ID_TO_MODULO[item.id];
        if (!modulo) return true;
        // Módulos que existem em PermissoesModulos mas não em LimitesPlano (sem restrição de plano)
        const modulosSoPorFuncionario = ["origem_dispositivos", "relatorios", "equipe", "novidades"];
        if (modulosSoPorFuncionario.includes(modulo)) return true;
        // Módulos sempre visíveis no menu (bloqueio acontece dentro da página)
        const modulosSempreVisiveis = ["fornecedores", "pedidos"];
        if (modulosSempreVisiveis.includes(modulo)) return true;
        return temAcessoModuloPlano(modulo as Parameters<typeof temAcessoModuloPlano>[0]);
      });
    }

    // Funcionário: filtrar por permissões configuradas pelo dono
    return items.filter((item) => {
      const modulo = NAV_ID_TO_MODULO[item.id];
      if (!modulo) return true;
      if (["plano", "equipe"].includes(item.id)) return false;
      return temAcessoModuloFuncionario(modulo);
    });
  }, [selectedNavIds, isFuncionario, temAcessoModuloFuncionario, temAcessoModuloPlano, carregandoPermissoes, carregandoAssinatura, assinatura]);

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const handleSaveNav = (ids: string[]) => {
    setSelectedNavIds(ids);
  };

  return (
    <>
      <nav
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t ${cor.nav}`}
        style={{
          background: cor.fundo,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
        }}
      >
        <div className="flex items-stretch justify-around h-14 max-w-lg mx-auto">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 gap-0.5 transition-all duration-200 relative",
                  "active:scale-95 touch-manipulation transition-transform",
                  active
                    ? cor.ativo
                    : cor.inativo
                )}
              >
                {active && (
                  <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full ${cor.linha}`} />
                )}
                <item.icon className={cn(
                  "h-5 w-5 transition-transform",
                  active && "scale-110"
                )} />
                <span className={cn(
                  "text-[10px] font-medium",
                  active && "font-semibold"
                )}>
                  {t(`barraInferior.itens.${item.id}`)}
                </span>
              </NavLink>
            );
          })}

          {/* Menu Button */}
          <button
            onClick={() => setMenuOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 gap-0.5 transition-all duration-200 active:scale-95 touch-manipulation ${cor.inativo}`}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium">{t("barraInferior.menu")}</span>
          </button>
        </div>
      </nav>

      <MobileMenuDrawer open={menuOpen} onOpenChange={setMenuOpen} onPersonalizarMenu={() => setCustomizeOpen(true)} />
      <MobileNavCustomizer 
        open={customizeOpen} 
        onOpenChange={setCustomizeOpen}
        onSave={handleSaveNav}
        currentIds={selectedNavIds}
      />
    </>
  );
}