import { useTranslation } from "react-i18next";
import { Eye, EyeOff, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardCotacaoDolar } from "@/components/dashboard/CardCotacaoDolar";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { MenuUsuario } from "@/components/layout/MenuUsuario";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";

/** Barra do topo do Dashboard no computador. Nas outras telas o ocultar valores segue flutuante. */
export function DashboardTopbar() {
  const { t } = useTranslation("menu");
  const { valoresOcultos, toggleValores } = useOcultarValores();
  const rotuloValores = valoresOcultos ? t("cabecalho.mostrarValores") : t("cabecalho.ocultarValores");

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-8">
      <div className="flex min-w-0 items-center gap-3">
        <LayoutDashboard className="h-6 w-6 shrink-0 text-foreground" />
        <span className="truncate text-2xl font-bold tracking-tight text-foreground">{t("cabecalho.titulos.dashboard")}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <CardCotacaoDolar />
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-foreground [&_svg]:size-5"
          onClick={toggleValores}
          title={rotuloValores}
          aria-label={rotuloValores}
        >
          {valoresOcultos ? <EyeOff /> : <Eye />}
        </Button>
        <NotificationCenter className="mr-1.5 h-10 w-10 rounded-full text-foreground [&_svg]:size-5" />
        <MenuUsuario />
      </div>
    </header>
  );
}
