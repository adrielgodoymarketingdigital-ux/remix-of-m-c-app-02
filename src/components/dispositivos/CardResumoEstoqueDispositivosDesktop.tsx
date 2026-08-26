import { Smartphone, DollarSign, ShoppingCart, TrendingUp, Package } from "lucide-react";
import { ValorMonetario } from "@/components/ui/valor-monetario";

interface CardResumoEstoqueDispositivosDesktopProps {
  totalQuantidade: number;
  valorCusto: number;
  valorVenda: number;
  valorLucro: number;
}

// Variante visual desktop do CardInventario, só para Dispositivos — não substitui o componente compartilhado com Produtos.
export function CardResumoEstoqueDispositivosDesktop({
  totalQuantidade,
  valorCusto,
  valorVenda,
  valorLucro,
}: CardResumoEstoqueDispositivosDesktopProps) {
  const margemPct = valorVenda > 0 ? (valorLucro / valorVenda) * 100 : null;

  return (
    <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[17px] font-semibold text-foreground">Resumo do Estoque</h2>
        <Smartphone className="h-[19px] w-[19px] text-violet-600 dark:text-violet-400" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 xl:gap-0">
        <div className="flex items-center gap-4 xl:pr-6 xl:border-r xl:border-border">
          <div
            className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-2xl text-white"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
          >
            <Package className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs text-muted-foreground mb-1.5">Total de itens</span>
            <div className="text-[28px] font-bold leading-none tracking-tight text-foreground">
              {totalQuantidade}
              <span className="ml-1 text-[13px] font-medium text-muted-foreground">itens</span>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 xl:px-6 xl:border-r xl:border-border">
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-muted text-blue-600 dark:text-blue-400">
            <DollarSign className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs text-muted-foreground mb-1.5">Custo total</span>
            <div className="text-[19px] font-bold whitespace-nowrap text-foreground">
              <ValorMonetario valor={valorCusto} tipo="custo" />
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 xl:px-6 xl:border-r xl:border-border">
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-muted text-blue-600 dark:text-blue-400">
            <ShoppingCart className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs text-muted-foreground mb-1.5">Venda total</span>
            <div className="text-[19px] font-bold whitespace-nowrap text-foreground">
              <ValorMonetario valor={valorVenda} tipo="preco" />
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 xl:pl-6">
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs text-muted-foreground mb-1.5">Lucro potencial</span>
            <div className="text-[19px] font-bold whitespace-nowrap text-emerald-600 dark:text-emerald-400">
              <ValorMonetario valor={valorLucro} tipo="lucro" />
            </div>
            {margemPct !== null && (
              <span className="mt-1.5 inline-block rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {margemPct.toFixed(2).replace(".", ",")}% de margem
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
