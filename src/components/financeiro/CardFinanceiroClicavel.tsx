import type { KeyboardEvent } from "react";
import { Card } from "@/components/ui/card";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESTILO_TOM, MOLDURA_CARD_FINANCEIRO, type TomCardFinanceiro } from "./estiloCardFinanceiro";

interface CardFinanceiroClicavelProps {
  titulo: string;
  valor?: number;
  quantidade?: number;
  subtitulo?: string;
  icon: LucideIcon;
  /** Não é mais usado (a cor do ícone vem de `tom`); mantido para não quebrar chamadas. */
  iconColor?: string;
  valorColor?: string;
  ativo?: boolean;
  onClick?: () => void;
  tipo?: "valor" | "quantidade" | "percentual";
  tom?: TomCardFinanceiro;
  /** Degradê suave da cor do cartão no rodapé. Puro enfeite, não é gráfico. */
  degrade?: boolean;
}

export function CardFinanceiroClicavel({
  titulo,
  valor,
  quantidade,
  subtitulo,
  icon: Icon,
  valorColor,
  ativo,
  onClick,
  tipo = "valor",
  tom = "neutro",
  degrade = false,
}: CardFinanceiroClicavelProps) {
  const estilo = ESTILO_TOM[tom];

  // Teclado: Enter/Espaço chamam o mesmo handler do clique. Espaço sem
  // preventDefault rolaria a página.
  const handleKeyDown = onClick
    ? (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }
    : undefined;

  return (
    <Card
      className={cn(
        MOLDURA_CARD_FINANCEIRO,
        "transition-all hover:shadow-md",
        estilo.card,
        onClick &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        ativo && "ring-2 ring-primary shadow-md",
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      {degrade && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-12 bg-gradient-to-t to-transparent",
            estilo.degrade,
          )}
        />
      )}

      <div className="flex items-start gap-2.5">
        <div
          aria-hidden="true"
          className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10", estilo.caixa)}
        >
          <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
        </div>
        <h3 className="min-w-0 flex-1 pt-0.5 text-xs sm:text-[13px] font-medium leading-snug text-foreground line-clamp-2">
          {titulo}
        </h3>
        {onClick && (
          <ChevronRight aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </div>

      <div className="mt-2.5">
        {tipo === "valor" && (
          <div className={cn("text-lg font-bold tracking-tight tabular-nums truncate", valorColor)}>
            <ValorMonetario valor={valor ?? 0} />
          </div>
        )}
        {tipo === "quantidade" && (
          <div className={cn("text-lg font-bold tracking-tight tabular-nums", valorColor)}>
            {quantidade ?? 0}
          </div>
        )}
        {tipo === "percentual" && (
          <div className={cn("text-lg font-bold tracking-tight tabular-nums truncate", valorColor)}>
            {(valor ?? 0).toFixed(2)}%
          </div>
        )}
        {subtitulo && (
          <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground truncate">{subtitulo}</p>
        )}
      </div>
    </Card>
  );
}
