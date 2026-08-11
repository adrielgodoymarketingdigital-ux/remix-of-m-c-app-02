import { useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SeletorFilial } from "@/components/layout/SeletorFilial";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";
import { DASHBOARD_HEADER_SLOT_ID } from "@/contexts/DashboardHeaderContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Mapeamento de rotas para títulos
const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pdv": "PDV",
  "/os": "Ordens de Serviço",
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
  "/admin/compatibilidade-pelicula": "Compatibilidade de Película",
  "/compatibilidade-pelicula": "Compatibilidade de Película",
};

export function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { valoresOcultos, toggleValores } = useOcultarValores();
  const [userInitials, setUserInitials] = useState("?");
  const [userName, setUserName] = useState("");
  const isDashboard = location.pathname === "/dashboard";

  useEffect(() => {
    const buscarUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const nome =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        "";

      setUserName(nome);

      const palavras = nome.trim().split(/\s+/);
      if (palavras.length >= 2) {
        setUserInitials((palavras[0][0] + palavras[1][0]).toUpperCase());
      } else if (palavras[0]?.length > 0) {
        setUserInitials(palavras[0][0].toUpperCase());
      }
    };

    buscarUsuario();
  }, []);

  const pageTitle = useMemo(() => {
    if (routeTitles[location.pathname]) {
      return routeTitles[location.pathname];
    }

    const pathParts = location.pathname.split("/");
    while (pathParts.length > 1) {
      const testPath = pathParts.join("/");
      if (routeTitles[testPath]) {
        return routeTitles[testPath];
      }
      pathParts.pop();
    }

    return "Méc";
  }, [location.pathname]);

  return (
    <header
      className={
        isDashboard
          // Dashboard: bloco único com gradiente diagonal escuro + cantos bem
          // arredondados embaixo, absorvendo a saudação (via portal) — igual
          // nos dois temas do app, funciona como destaque visual fixo. O card
          // de cotação/plano fica fora do cabeçalho, no conteúdo da página.
          ? "lg:hidden sticky top-0 z-40 rounded-b-[24px] bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 shadow-lg shadow-black/20"
          : "lg:hidden sticky top-0 z-40 border-b border-slate-800 bg-slate-900 dark:border-white/10 dark:bg-white"
      }
    >
      {/* Safe area para notch do iPhone */}
      <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className={isDashboard ? "flex flex-col gap-7 px-4 pt-6 pb-10" : "flex flex-col gap-3 px-4 pt-4 pb-3"}>

          <div className="flex items-center justify-between gap-2">
            {/* Título da página */}
            <div className="shrink-0">
              <h1 className={`text-sm font-bold tracking-tight leading-tight whitespace-nowrap ${isDashboard ? "text-white" : "text-white dark:text-slate-900"}`}>
                {pageTitle}
              </h1>
              {(location.pathname === "/os" || isDashboard) && (
                <p className={`text-sm capitalize leading-tight mt-0.5 ${isDashboard ? "text-white/60" : "text-white/70 dark:text-slate-500"}`}>
                  {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
              )}
            </div>

            {/* Ações da direita */}
            <div className="flex items-center gap-1.5 min-w-0">
              <SeletorFilial
                className={
                  isDashboard
                    ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
                    : "border-white/20 bg-white/10 text-white hover:bg-white/20 dark:border-slate-900/20 dark:bg-slate-900/10 dark:text-slate-900 dark:hover:bg-slate-900/20"
                }
              />

              {/* Ocultar valores */}
              <Button
                variant="ghost"
                size="icon"
                className={
                  isDashboard
                    ? "h-8 w-8 shrink-0 text-white hover:bg-white/10 hover:text-white"
                    : "h-8 w-8 shrink-0 text-white hover:bg-white/10 hover:text-white dark:text-slate-900 dark:hover:bg-slate-900/10 dark:hover:text-slate-900"
                }
                onClick={toggleValores}
                title={valoresOcultos ? "Mostrar valores" : "Ocultar valores"}
              >
                {valoresOcultos
                  ? <EyeOff className="h-4 w-4" />
                  : <Eye className="h-4 w-4" />}
              </Button>

              {/* Notificações */}
              <NotificationCenter
                className={
                  isDashboard
                    ? "mr-1 text-white hover:bg-white/10"
                    : "mr-1 text-white hover:bg-white/10 dark:text-slate-900 dark:hover:bg-slate-900/10"
                }
              />

              {/* Avatar de perfil — navega para /configuracoes */}
              <button
                onClick={() => navigate("/configuracoes")}
                className={
                  isDashboard
                    ? "flex items-center justify-center h-8 w-8 rounded-full overflow-hidden ring-2 ring-white/20 hover:ring-white/40 transition-all active:scale-95 shrink-0"
                    : "flex items-center justify-center h-8 w-8 rounded-full overflow-hidden ring-2 ring-white/20 hover:ring-white/40 dark:ring-slate-900/20 dark:hover:ring-slate-900/40 transition-all active:scale-95 shrink-0"
                }
                title={userName || "Perfil"}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs font-semibold bg-primary text-primary-foreground">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </div>
          </div>

          {/* Alvo do portal: Dashboard.tsx injeta saudação + card de cotação/plano
              aqui via createPortal, direto na renderização (sem passar por
              Context+useEffect, que perdia o conteúdo em re-renders rápidos
              causados pelos hooks de dados da Dashboard). */}
          {isDashboard && <div id={DASHBOARD_HEADER_SLOT_ID} className="flex flex-col gap-9" />}
        </div>
      </div>
    </header>
  );
}
