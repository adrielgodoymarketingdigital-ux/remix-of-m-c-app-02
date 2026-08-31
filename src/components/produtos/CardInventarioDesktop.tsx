import { Card } from "@/components/ui/card";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { LucideIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardInventarioDesktopProps {
  titulo: string;
  icon: LucideIcon;
  accent?: "blue" | "orange";
  totalItens: number;
  totalQuantidade: number;
  valorCusto: number;
  valorVenda: number;
  valorLucro: number;
}

/**
 * Variante visual DESKTOP do card de resumo de inventário (>= md).
 * Não substitui o CardInventario (usado no mobile/PWA e mantido intacto):
 * este componente só é renderizado no breakpoint desktop da tela Produtos,
 * seguindo o mockup de referência (ícone em box colorido, contadores em
 * destaque, 3 métricas numa linha com separadores). Todos os valores vêm
 * dos mesmos dados reais passados ao CardInventario.
 */
const ACCENT = {
  blue: {
    box: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    strong: "text-blue-600 dark:text-blue-400",
  },
  orange: {
    box: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
    strong: "text-orange-600 dark:text-orange-400",
  },
} as const;

export function CardInventarioDesktop({
  titulo,
  icon: Icon,
  accent = "blue",
  totalItens,
  totalQuantidade,
  valorCusto,
  valorVenda,
  valorLucro,
}: CardInventarioDesktopProps) {
  const a = ACCENT[accent];

  return (
    <Card className="relative overflow-hidden p-6 shadow-sm">
      <ChevronRight
        aria-hidden
        className="pointer-events-none absolute right-5 top-5 h-7 w-7 rounded-full border p-1 text-muted-foreground"
      />

      <div className="flex items-start gap-4 pr-10">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", a.box)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold">{titulo}</p>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            <span className={cn("text-2xl font-bold leading-none", a.strong)}>{totalItens}</span>
            {totalItens === 1 ? "cadastro" : "cadastros"}
            <span className="text-muted-foreground/50">•</span>
            <span className="text-2xl font-bold leading-none text-foreground">{totalQuantidade}</span>
            em estoque
          </p>
        </div>
      </div>

      <div className="my-4 h-px bg-border" />

      <div className="grid grid-cols-3 pl-[60px]">
        <div className="pr-4">
          <span className="mb-1.5 block text-[11px] text-muted-foreground">Custo total</span>
          <ValorMonetario valor={valorCusto} tipo="custo" className="text-[13px] font-semibold" />
        </div>
        <div className="border-l pl-6 pr-4">
          <span className="mb-1.5 block text-[11px] text-muted-foreground">Venda total</span>
          <ValorMonetario
            valor={valorVenda}
            tipo="preco"
            className="text-[13px] font-semibold text-blue-600 dark:text-blue-400"
          />
        </div>
        <div className="border-l pl-6">
          <span className="mb-1.5 block text-[11px] text-muted-foreground">Lucro potencial</span>
          <ValorMonetario
            valor={valorLucro}
            tipo="lucro"
            className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400"
          />
        </div>
      </div>
    </Card>
  );
}
