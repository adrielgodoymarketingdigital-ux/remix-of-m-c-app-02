import { useEffect, useSyncExternalStore } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { divergenciaRelogio } from "@/lib/horaBrasilia/relogioServidor.core";
import { relogioServidor } from "@/lib/horaBrasilia/relogioServidor";
import { cn } from "@/lib/utils";

/** Avisa que o relógio do aparelho está errado. Só informa: nunca bloqueia a venda. */
export function AvisoRelogioAparelho({ className }: { className?: string }) {
  const { t } = useTranslation("pdv");
  const offsetMs = useSyncExternalStore(relogioServidor.assinar, relogioServidor.offsetMs);

  useEffect(() => {
    void relogioServidor.sincronizar();
  }, []);

  const divergencia = divergenciaRelogio(offsetMs);
  if (!divergencia) return null;

  const { direcao, horas, minutos } = divergencia;
  const tempo = horas === 0
    ? t("caixa.relogio.tempoMinutos", { minutos })
    : minutos === 0
      ? t("caixa.relogio.tempoHoras", { horas })
      : t("caixa.relogio.tempoHorasMinutos", { horas, minutos });

  return (
    <Alert className={cn("border-amber-500/50 bg-amber-500/10 [&>svg]:text-amber-600", className)}>
      <Clock className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{t("caixa.relogio.titulo")}</AlertTitle>
      <AlertDescription>
        <p>{t(`caixa.relogio.${direcao}`, { tempo })}</p>
        <p>{t("caixa.relogio.orientacao")}</p>
      </AlertDescription>
    </Alert>
  );
}
