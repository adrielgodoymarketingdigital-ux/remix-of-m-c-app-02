import { NavLink, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { MobileMenuDrawer } from "./MobileMenuDrawer";
import { MobileNavCustomizer, allNavOptions, getSelectedNavItems } from "./MobileNavCustomizer";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useAssinatura } from "@/hooks/useAssinatura";
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

export function MobileBottomNav() {
  const location = useLocation();
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
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/50"
        style={{
          background: "hsl(var(--background) / 0.97)",
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
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-primary" />
                )}
                <item.icon className={cn(
                  "h-5 w-5 transition-transform",
                  active && "scale-110"
                )} />
                <span className={cn(
                  "text-[10px] font-medium",
                  active && "font-semibold"
                )}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}
          
          {/* Menu Button */}
          <button
            onClick={() => setMenuOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 gap-0.5 transition-all duration-200",
              "active:scale-95 touch-manipulation",
              "text-slate-500 hover:text-slate-300"
            )}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium">Menu</span>
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