import { Smartphone, DollarSign, ShoppingCart, TrendingUp } from "lucide-react";
import { ValorMonetario } from "@/components/ui/valor-monetario";

interface CardResumoEstoqueDispositivosMobileProps {
  totalQuantidade: number;
  valorCusto: number;
  valorVenda: number;
  valorLucro: number;
}

// Variante visual mobile do CardInventario, só para Dispositivos — não substitui o componente compartilhado com Produtos.
export function CardResumoEstoqueDispositivosMobile({
  totalQuantidade,
  valorCusto,
  valorVenda,
  valorLucro,
}: CardResumoEstoqueDispositivosMobileProps) {
  return (
    <div className="rounded-[22px] border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{ background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)" }}
        >
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Resumo do Estoque</p>
          <p className="text-lg font-bold leading-tight text-foreground">
            {totalQuantidade} <span className="text-xs font-normal text-muted-foreground">itens</span>
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/50 p-2">
          <DollarSign className="mx-auto h-4 w-4 text-muted-foreground" />
          <p className="mt-1 text-[10px] text-muted-foreground">Custo</p>
          <p className="text-xs font-semibold text-foreground">
            <ValorMonetario valor={valorCusto} tipo="custo" />
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 p-2">
          <ShoppingCart className="mx-auto h-4 w-4 text-blue-500" />
          <p className="mt-1 text-[10px] text-muted-foreground">Venda</p>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            <ValorMonetario valor={valorVenda} tipo="preco" />
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 p-2">
          <TrendingUp className="mx-auto h-4 w-4 text-emerald-500" />
          <p className="mt-1 text-[10px] text-muted-foreground">Lucro</p>
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ValorMonetario valor={valorLucro} tipo="lucro" />
          </p>
        </div>
      </div>
    </div>
  );
}
