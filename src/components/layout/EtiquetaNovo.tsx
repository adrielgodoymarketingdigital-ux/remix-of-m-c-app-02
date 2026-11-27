import { useTranslation } from "react-i18next";
import { CORES_ETIQUETA_NOVO } from "@/lib/menu/menuPrincipal";
import { cn } from "@/lib/utils";

// Cores por style (não por classe): não dependem das variáveis --sidebar-* da
// cor do menu nem do tema claro/escuro.
const ESTILO_PILULA = {
  backgroundColor: CORES_ETIQUETA_NOVO.fundo,
  color: CORES_ETIQUETA_NOVO.texto,
  boxShadow: `0 0 0 1px ${CORES_ETIQUETA_NOVO.contorno}`,
} as const;

/** Pílula "Novo" ao lado do nome do item do menu. */
export function EtiquetaNovo({ className }: { className?: string }) {
  const { t } = useTranslation("menu");
  return (
    <span
      data-etiqueta-novo=""
      className={cn("ml-auto inline-flex shrink-0 items-center rounded-full px-1.5 text-[10px] font-semibold leading-4", className)}
      style={ESTILO_PILULA}
    >
      {t("novo")}
    </span>
  );
}

/** Pontinho (barra lateral recolhida). Posição (left/top) vem de quem usa. */
export function PontoNovo({ className }: { className?: string }) {
  const { t } = useTranslation("menu");
  return (
    <span
      data-etiqueta-novo=""
      role="img"
      aria-label={t("novo")}
      className={cn("pointer-events-none absolute h-2.5 w-2.5 rounded-full", className)}
      style={ESTILO_PILULA}
    />
  );
}
