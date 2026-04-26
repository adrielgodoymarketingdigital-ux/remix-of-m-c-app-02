import { useLocation } from "react-router-dom";
import { useMemo } from "react";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

// Mapeamento de rotas para títulos
const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pdv": "PDV",
  "/os": "Ordem de Serviço",
  "/produtos": "Produtos e Peças",
  "/servicos": "Serviços",
  "/dispositivos": "Dispositivos",
  "/catalogo": "Catálogo",
  "/origem-dispositivos": "Origem",
  "/fornecedores": "Fornecedores",
  "/clientes": "Clientes",
  "/orcamentos": "Orçamentos",
  "/contas": "Contas",
  "/vendas": "Vendas",
  "/relatorios": "Relatórios",
  "/financeiro": "Financeiro",
  "/equipe": "Equipe",
  "/configuracoes": "Configurações",
  "/suporte": "Suporte",
  "/plano": "Meu Plano",
  "/novidades": "Novidades",
  // Admin routes
  "/admin/usuarios": "Usuários",
  "/admin/financeiro": "Financeiro",
  "/admin/novidades": "Novidades",
  "/admin/onboarding": "Onboarding",
  "/admin/push": "Push",
  "/admin/feedbacks": "Feedbacks",
  "/admin/chat": "Chat",
  "/admin/avisos": "Avisos",
  "/admin/notificacoes": "Notificações",
};

export function MobileHeader() {
  const location = useLocation();
  

  const pageTitle = useMemo(() => {
    // Tenta match exato primeiro
    if (routeTitles[location.pathname]) {
      return routeTitles[location.pathname];
    }
    
    // Tenta match parcial para sub-rotas
    const pathParts = location.pathname.split('/');
    while (pathParts.length > 1) {
      const testPath = pathParts.join('/');
      if (routeTitles[testPath]) {
        return routeTitles[testPath];
      }
      pathParts.pop();
    }
    
    return "Méc";
  }, [location.pathname]);

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80 border-b border-border safe-area-top">
      <div className="flex items-center justify-between h-12 px-4">
        <h1 className="text-base font-semibold text-foreground truncate">
          {pageTitle}
        </h1>
        <NotificationCenter />
      </div>
    </header>
  );
}
