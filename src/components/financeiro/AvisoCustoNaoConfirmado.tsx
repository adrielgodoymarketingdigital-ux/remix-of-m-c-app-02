import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { useFormatadores } from "@/hooks/useFormatadores";

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
  // Textos: namespace "dashboard" (custoNaoConfirmado.*); moeda da conta.
  const { t } = useTranslation("dashboard");
  const { moeda: formatCurrency } = useFormatadores();

  if (quantidade === 0) return null;

  const listadas = parcelas.slice(0, MAX_LISTADAS);

  const estornar = async () => {
    if (!confirmando || !userId) return;
    setEstornando(true);
    const r = await estornarParcelaSecundaria(confirmando.id, userId);
    setEstornando(false);
    if (!r.ok) {
      toast({ title: t("custoNaoConfirmado.erroEstornar"), description: r.erro, variant: "destructive" });
      return;
    }
    toast({
      title: t("custoNaoConfirmado.estornada"),
      description: t("custoNaoConfirmado.itemParcela", { descricao: confirmando.descricao, valor: formatCurrency(confirmando.total) }),
    });
    setConfirmando(null);
    await queryClient.invalidateQueries({ queryKey: ["custo-nao-confirmado"] });
  };

  return (
    <Alert className="border-amber-500/50">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle>{t("custoNaoConfirmado.titulo", { count: quantidade })}</AlertTitle>
      <AlertDescription>
        {t("custoNaoConfirmado.descricao", { count: quantidade, total: formatCurrency(total) })}
        <ul className="mt-2 space-y-1">
          {listadas.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">
                {t("custoNaoConfirmado.itemParcela", { descricao: p.descricao, valor: formatCurrency(p.total) })}
              </span>
              {p.podeEstornar ? (
                <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => setConfirmando(p)}>
                  {t("custoNaoConfirmado.estornar")}
                </Button>
              ) : (
                <span className="shrink-0 text-[11px] text-muted-foreground">{t("custoNaoConfirmado.confirmeCusto")}</span>
              )}
            </li>
          ))}
          {quantidade > listadas.length && (
            <li className="text-xs text-muted-foreground">{t("custoNaoConfirmado.maisParcelas", { count: quantidade - listadas.length })}</li>
          )}
        </ul>
      </AlertDescription>

      <AlertDialog open={!!confirmando} onOpenChange={(aberto) => !aberto && !estornando && setConfirmando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("custoNaoConfirmado.confirmarTitulo")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmando
                ? t("custoNaoConfirmado.confirmarDescricaoComItem", { descricao: confirmando.descricao, valor: formatCurrency(confirmando.total) })
                : t("custoNaoConfirmado.confirmarDescricao")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={estornando}>{t("custoNaoConfirmado.voltar")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={estornando}
              onClick={(e) => {
                e.preventDefault();
                void estornar();
              }}
            >
              {estornando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("custoNaoConfirmado.estornarParcela")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Alert>
  );
}
