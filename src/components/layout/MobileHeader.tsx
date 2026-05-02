import { useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";
import { supabase } from "@/integrations/supabase/client";
import { SeletorFilial } from "@/components/layout/SeletorFilial";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const navigate = useNavigate();
  const { valoresOcultos, toggleValores } = useOcultarValores();
  const [userInitials, setUserInitials] = useState("?");
  const [userName, setUserName] = useState("");

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
      className="lg:hidden sticky top-0 z-40 border-b border-border/50"
      style={{
        background: "hsl(var(--background) / 0.97)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Safe area para notch do iPhone */}
      <div style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between h-14 px-4">

          {/* Título da página */}
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-semibold text-foreground tracking-tight truncate leading-tight">
              {pageTitle}
            </h1>
            {location.pathname === "/os" && (
              <p className="text-[11px] text-muted-foreground capitalize leading-tight">
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            )}
          </div>

          {/* Ações da direita */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <SeletorFilial />

            {/* Botão ocultar valores */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={toggleValores}
              title={valoresOcultos ? "Mostrar valores" : "Ocultar valores"}
            >
              {valoresOcultos
                ? <EyeOff className="h-[18px] w-[18px]" />
                : <Eye className="h-[18px] w-[18px]" />}
            </Button>

            {/* Notificações */}
            <NotificationCenter />

            {/* Avatar de perfil — navega para /configuracoes */}
            <button
              onClick={() => navigate("/configuracoes")}
              className="ml-1 flex items-center justify-center h-9 w-9 rounded-full overflow-hidden ring-2 ring-border/50 hover:ring-primary/50 transition-all active:scale-95"
              title={userName || "Perfil"}
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs font-semibold bg-primary text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </button>

          </div>
        </div>
      </div>
    </header>
  );
}
