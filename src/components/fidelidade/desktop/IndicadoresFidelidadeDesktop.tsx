import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Award, Star, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { FidelidadeNivel } from "@/types/fidelidade";
import { ChipNivel } from "./ChipNivel";

export type ContagemNivel = FidelidadeNivel & { count: number };

interface IndicadoresFidelidadeDesktopProps {
  isLoading: boolean;
  totalClientes: number;
  totalPontosDistribuidos: number;
  contagemNiveis: ContagemNivel[];
}

interface CartaoIndicadorProps {
  titulo: string;
  icon: LucideIcon;
  /** Classes do quadrado do ícone (transparência: funciona nos dois temas). */
  acento: string;
  children: ReactNode;
}

function CartaoIndicador({ titulo, icon: Icon, acento, children }: CartaoIndicadorProps) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl", acento)}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 [container-type:inline-size]">
        <p className="text-sm font-medium leading-5 text-muted-foreground">{titulo}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

/** Valor grande do cartão: diminui com a largura do cartão (cqi) e nunca é cortado. */
function ValorIndicador({ children }: { children: ReactNode }) {
  return (
    <p className="text-[clamp(1rem,11cqi,1.75rem)] font-bold leading-tight tabular-nums [overflow-wrap:anywhere]">
      {children}
    </p>
  );
}

/** Os 3 cartões de indicadores da Fidelidade no computador. Mesmos números do celular. */
export function IndicadoresFidelidadeDesktop({
  isLoading,
  totalClientes,
  totalPontosDistribuidos,
  contagemNiveis,
}: IndicadoresFidelidadeDesktopProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)] gap-4">
      <CartaoIndicador titulo="Clientes no programa" icon={Users} acento="bg-blue-500/10 text-blue-600 dark:text-blue-400">
        {isLoading ? <Skeleton className="h-8 w-16" /> : <ValorIndicador>{totalClientes}</ValorIndicador>}
      </CartaoIndicador>

      <CartaoIndicador titulo="Total de pontos distribuídos" icon={Star} acento="bg-purple-500/10 text-purple-600 dark:text-purple-400">
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <ValorIndicador>{totalPontosDistribuidos.toLocaleString("pt-BR")}</ValorIndicador>
        )}
      </CartaoIndicador>

      <CartaoIndicador titulo="Clientes por nível" icon={Award} acento="bg-amber-500/10 text-amber-600 dark:text-amber-400">
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : contagemNiveis.length === 0 ? (
          <span className="text-sm text-muted-foreground">Sem níveis criados</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {contagemNiveis.map(n => (
              <ChipNivel key={n.id} cor={n.cor} title={`${n.nome}: ${n.count}`}>
                {n.nome}: <span className="font-semibold tabular-nums">{n.count}</span>
              </ChipNivel>
            ))}
          </div>
        )}
      </CartaoIndicador>
    </div>
  );
}
