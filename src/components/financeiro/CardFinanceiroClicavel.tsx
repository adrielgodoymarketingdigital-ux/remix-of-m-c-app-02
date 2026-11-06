import type { CSSProperties, KeyboardEvent } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
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
  /**
   * Opcional: o valor nunca é cortado com "…". A fonte fica no tamanho de sempre
   * (text-lg) e só diminui quando o número não caberia na largura do cartão
   * (container query). Sem a prop, nada muda.
   */
  valorAjustavel?: boolean;
  /** Opcional: no computador (lg+), esqueleto no lugar do valor. Abaixo de lg nada muda. */
  carregando?: boolean;
}

/**
 * Largura média de um caractere do valor em negrito, em "em". Folgada de propósito
 * (dígitos ~0,6em, pontuação ~0,3em) para o número caber com sobra.
 */
const LARGURA_CARACTERE_EM = 0.64;

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
  valorAjustavel = false,
  carregando = false,
}: CardFinanceiroClicavelProps) {
  const estilo = ESTILO_TOM[tom];

  // Quantos caracteres o valor ocupa na tela (só para escolher o tamanho da fonte).
  const caracteresDoValor = valorAjustavel
    ? tipo === "quantidade"
      ? String(quantidade ?? 0).length
      : tipo === "percentual"
        ? `${(valor ?? 0).toFixed(2)}%`.length
        : formatCurrency(valor ?? 0).length
    : 0;
  // text-lg (1.125rem) enquanto couber; abaixo disso, encolhe na medida da largura do cartão.
  const estiloValor: CSSProperties | undefined = valorAjustavel
    ? { fontSize: `min(1.125rem, calc(100cqi / ${(caracteresDoValor * LARGURA_CARACTERE_EM).toFixed(2)}))` }
    : undefined;
  const classeValor = valorAjustavel
    ? "font-bold tracking-tight tabular-nums whitespace-nowrap leading-7"
    : null;

  const conteudoValor = (
    <>
      {tipo === "valor" && (
        <div
          className={cn(classeValor ?? "text-lg font-bold tracking-tight tabular-nums truncate", valorColor)}
          style={estiloValor}
        >
          <ValorMonetario valor={valor ?? 0} />
        </div>
      )}
      {tipo === "quantidade" && (
        <div
          className={cn(classeValor ?? "text-lg font-bold tracking-tight tabular-nums", valorColor)}
          style={estiloValor}
        >
          {quantidade ?? 0}
        </div>
      )}
      {tipo === "percentual" && (
        <div
          className={cn(classeValor ?? "text-lg font-bold tracking-tight tabular-nums truncate", valorColor)}
          style={estiloValor}
        >
          {(valor ?? 0).toFixed(2)}%
        </div>
      )}
    </>
  );

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
        valorAjustavel && "[container-type:inline-size]",
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

      <div
        className={cn(
          "flex items-start gap-2.5",
          // Computador, cartão estreito (7 numa linha em ~1366-1600px): ícone em cima do
          // título para o título não ser cortado no meio da palavra.
          valorAjustavel && "lg:[@container(max-width:139px)]:flex-col lg:[@container(max-width:139px)]:gap-2",
        )}
      >
        <div
          aria-hidden="true"
          className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10", estilo.caixa)}
        >
          <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
        </div>
        <h3
          className={cn(
            "min-w-0 flex-1 pt-0.5 text-xs sm:text-[13px] font-medium leading-snug text-foreground line-clamp-3",
            onClick && "pr-3",
          )}
        >
          {titulo}
        </h3>
        {onClick && (
          <ChevronRight
            aria-hidden="true"
            className="absolute right-2 top-3 h-4 w-4 text-muted-foreground sm:right-3 sm:top-4"
          />
        )}
      </div>

      <div className="mt-2.5">
        {carregando ? (
          <>
            <Skeleton aria-hidden="true" className="hidden h-7 w-3/4 rounded-md lg:block" />
            <div className="lg:hidden">{conteudoValor}</div>
          </>
        ) : (
          conteudoValor
        )}
        {subtitulo && (
          <p
            className={cn(
              "mt-0.5 text-[11px] sm:text-xs text-muted-foreground truncate",
              // Computador: subtítulo quebra em até 2 linhas em vez de "…".
              valorAjustavel && "lg:line-clamp-2 lg:whitespace-normal",
            )}
          >
            {subtitulo}
          </p>
        )}
      </div>
    </Card>
  );
}
