import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { Trash2, Smartphone, Package } from "lucide-react";
import { ItemVenda } from "./DialogSelecionarItem";

interface ItemCarrinhoProps {
  item: ItemVenda;
  onRemover: (id: string) => void;
  onAtualizarQuantidade: (id: string, quantidade: number) => void;
}

export const ItemCarrinho = ({
  item,
  onRemover,
  onAtualizarQuantidade,
}: ItemCarrinhoProps) => {
  const total = item.preco * item.quantidade;

  const getItemIcon = () => {
    if (item.tipo === "dispositivo") {
      return (
        <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
          <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
      );
    }
    return (
      <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
        <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
      </div>
    );
  };

  const getItemLabel = () => {
    if (item.tipo === "dispositivo") return "Dispositivo";
    if (item.tipo === "peca") return "Peça";
    return "Produto";
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 border rounded-lg">
      {/* Linha 1: Ícone + Nome (sempre visível) */}
      <div className="flex items-center gap-3 w-full sm:w-auto sm:flex-1 min-w-0">
        <div className="flex-shrink-0">
          {getItemIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate text-sm sm:text-base">{item.nome}</div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {getItemLabel()}
            </Badge>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {formatCurrency(item.preco)} × {item.quantidade}
            </span>
          </div>
        </div>
      </div>

      {/* Linha 2: Controles + Total + Remover */}
      <div className="flex items-center justify-between w-full sm:w-auto gap-2 sm:gap-3 pt-2 sm:pt-0 border-t sm:border-t-0">
        {/* Controles de quantidade */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() =>
              onAtualizarQuantidade(item.id, Math.max(1, item.quantidade - 1))
            }
            disabled={item.quantidade <= 1}
          >
            -
          </Button>
          <Input
            type="number"
            min="1"
            max={item.estoque}
            value={item.quantidade}
            onChange={(e) =>
              onAtualizarQuantidade(item.id, parseInt(e.target.value) || 1)
            }
            className="w-12 sm:w-14 h-8 text-center text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() =>
              onAtualizarQuantidade(
                item.id,
                Math.min(item.estoque, item.quantidade + 1)
              )
            }
            disabled={item.quantidade >= item.estoque}
          >
            +
          </Button>
        </div>

        {/* Total */}
        <div className="text-right flex-1 sm:flex-none sm:min-w-[80px]">
          <div className="font-semibold text-sm sm:text-base">{formatCurrency(total)}</div>
        </div>

        {/* Botão remover */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
          onClick={() => onRemover(item.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
