import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { type ParcelaCustoNaoConfirmado, useCustoNaoConfirmado } from "@/hooks/useCustoNaoConfirmado";
import { estornarParcelaSecundaria } from "@/lib/vendas/estornoParcelaSecundaria";
import { formatCurrency } from "@/lib/formatters";

const MAX_LISTADAS = 5;

/**
 * Aviso de parcelas de pagamento duplo recebidas sem custo confirmado: elas
 * ficam FORA do lucro e do faturamento até o custo ser confirmado (ver
 * isCustoNaoConfirmado em src/lib/vendasFinanceiras.ts). A tela de Vendas não
 * mostra essas linhas, então o estorno de parcela de venda cancelada/removida
 * é feito aqui.
 */
export function AvisoCustoNaoConfirmado() {
  const { userId, parcelas, quantidade, total } = useCustoNaoConfirmado();
  const queryClient = useQueryClient();
  const [confirmando, setConfirmando] = useState<ParcelaCustoNaoConfirmado | null>(null);
  const [estornando, setEstornando] = useState(false);

  if (quantidade === 0) return null;

  const listadas = parcelas.slice(0, MAX_LISTADAS);

  const estornar = async () => {
    if (!confirmando || !userId) return;
    setEstornando(true);
    const r = await estornarParcelaSecundaria(confirmando.id, userId);
    setEstornando(false);
    if (!r.ok) {
      toast({ title: "Não foi possível estornar a parcela", description: r.erro, variant: "destructive" });
      return;
    }
    toast({ title: "Parcela estornada", description: `${confirmando.descricao} — ${formatCurrency(confirmando.total)}` });
    setConfirmando(null);
    await queryClient.invalidateQueries({ queryKey: ["custo-nao-confirmado"] });
  };

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
        <ul className="mt-2 space-y-1">
          {listadas.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">
                {p.descricao} — {formatCurrency(p.total)}
              </span>
              {p.podeEstornar ? (
                <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => setConfirmando(p)}>
                  Estornar
                </Button>
              ) : (
                <span className="shrink-0 text-[11px] text-muted-foreground">Confirme o custo na venda</span>
              )}
            </li>
          ))}
          {quantidade > listadas.length && (
            <li className="text-xs text-muted-foreground">+{quantidade - listadas.length} parcela(s)</li>
          )}
        </ul>
      </AlertDescription>

      <AlertDialog open={!!confirmando} onOpenChange={(aberto) => !aberto && !estornando && setConfirmando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar parcela?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmando && `${confirmando.descricao} — ${formatCurrency(confirmando.total)}. `}
              A venda principal desta parcela foi cancelada ou removida. Estornar cancela a parcela:
              ela sai deste aviso e dos relatórios de caixa. Use só se a venda foi desfeita e o
              valor não ficou com a loja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={estornando}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={estornando}
              onClick={(e) => {
                e.preventDefault();
                void estornar();
              }}
            >
              {estornando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Estornar parcela
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Alert>
  );
}
