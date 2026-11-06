import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Acento do ícone. Transparência sobre o fundo do cartão: funciona no tema claro e no escuro. */
export type AcentoRelatorio = "blue" | "green" | "purple" | "orange" | "cyan";

const ACENTO_ICONE_RELATORIO: Record<AcentoRelatorio, string> = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  green: "bg-green-500/10 text-green-600 dark:text-green-400",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
};

interface CardResumoRelatorioProps {
  titulo: string;
  valor: ReactNode;
  descricao: string;
  icon: LucideIcon;
  acento: AcentoRelatorio;
  /** Classe extra do valor (ex.: cor de alerta). */
  classeValor?: string;
}

/**
 * Cartão de resumo das abas de Relatórios, só no layout do computador.
 * O valor nunca é cortado: diminui conforme a largura do cartão e, no limite, quebra a linha.
 */
export function CardResumoRelatorio({ titulo, valor, descricao, icon: Icon, acento, classeValor }: CardResumoRelatorioProps) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl", ACENTO_ICONE_RELATORIO[acento])}>
        <Icon className="h-6 w-6" />
      </div>
      {/* container-type: o tamanho do valor acompanha a largura do cartão (cqi), não a da tela. */}
      <div className="min-w-0 flex-1 [container-type:inline-size]">
        <p className="text-sm font-medium leading-5 text-muted-foreground">{titulo}</p>
        <div className={cn("mt-1 text-[clamp(0.95rem,10.5cqi,1.5rem)] font-bold leading-tight tabular-nums [overflow-wrap:anywhere]", classeValor)}>
          {valor}
        </div>
        <p className="mt-1 text-xs leading-4 text-muted-foreground">{descricao}</p>
      </div>
    </div>
  );
}

interface CabecalhoTabelaRelatorioProps {
  titulo: string;
  descricao: string;
  icon: LucideIcon;
  acento: AcentoRelatorio;
}

/** Título com ícone e subtítulo das tabelas de Relatórios, só no layout do computador. */
export function CabecalhoTabelaRelatorio({ titulo, descricao, icon: Icon, acento }: CabecalhoTabelaRelatorioProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", ACENTO_ICONE_RELATORIO[acento])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-6">{titulo}</h3>
        <p className="text-xs leading-5 text-muted-foreground">{descricao}</p>
      </div>
    </div>
  );
}
