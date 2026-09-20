import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCustoNaoConfirmado } from "@/hooks/useCustoNaoConfirmado";
import { formatCurrency } from "@/lib/formatters";

/**
 * Aviso de parcelas de pagamento duplo recebidas sem custo confirmado: elas
 * ficam FORA do lucro e do faturamento até o custo ser confirmado (ver
 * isCustoNaoConfirmado em src/lib/vendasFinanceiras.ts).
 */
export function AvisoCustoNaoConfirmado() {
  const { parcelas, quantidade, total } = useCustoNaoConfirmado();
  if (quantidade === 0) return null;

  const exemplos = parcelas.slice(0, 3);

  return (
    <Alert className="border-amber-500/50">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle>Custo não confirmado em {quantidade} parcela(s) recebida(s)</AlertTitle>
      <AlertDescription>
        {quantidade === 1 ? "Essa parcela (" : "Essas parcelas ("}
        {formatCurrency(total)}
        {quantidade === 1 ? ") foi recebida" : ") foram recebidas"} sem o custo da venda confirmado
        (venda principal cancelada, removida ou sem custo) e ficam FORA do lucro e do faturamento
        até o custo ser confirmado.
        <span className="block mt-1 text-xs text-muted-foreground">
          {exemplos.map((p) => `${p.descricao} — ${formatCurrency(p.total)}`).join(" · ")}
          {quantidade > exemplos.length ? ` · +${quantidade - exemplos.length}` : ""}
        </span>
      </AlertDescription>
    </Alert>
  );
}
