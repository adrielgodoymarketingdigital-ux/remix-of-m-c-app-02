import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { estiloChipNivel } from "./corNivel";

interface ChipNivelProps {
  /** Cor do nível vinda do banco (qualquer hex). Sem cor válida, o chip fica neutro. */
  cor: string | null | undefined;
  children: ReactNode;
  /** Texto completo para o caso de o nome do nível ser cortado. */
  title?: string;
  className?: string;
}

/**
 * Chip de nível do layout do computador: fundo translúcido da cor do nível,
 * bolinha na cor sólida e texto no token foreground (legível com qualquer hex,
 * nos dois temas). Sem cor válida: fundo neutro do tema e sem bolinha.
 */
export function ChipNivel({ cor, children, title, className }: ChipNivelProps) {
  const estilo = estiloChipNivel(cor);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium leading-4 text-foreground",
        estilo.temCor ? "border-border bg-transparent" : "border-border bg-muted",
        className
      )}
      style={estilo.chip}
      title={title}
    >
      {estilo.temCor && (
        // O anel garante contorno até para branco no tema claro e preto no escuro.
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full ring-1 ring-foreground/25" style={estilo.ponto} />
      )}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
