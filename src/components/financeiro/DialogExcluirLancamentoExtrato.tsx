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
import { ValorMonetario } from "@/components/ui/valor-monetario";
import type { EventoExtrato } from "@/hooks/useExtratoFinanceiro";

interface DialogExcluirLancamentoExtratoProps {
  /** Lançamento manual/balanço a excluir; null = diálogo fechado. */
  evento: EventoExtrato | null;
  onOpenChange: (open: boolean) => void;
  /** Exclui de fato; o diálogo fecha independente do resultado. */
  onConfirmar: (evento: EventoExtrato) => void;
}

/** Confirmação antes de excluir um lançamento manual ou de balanço. */
export function DialogExcluirLancamentoExtrato({ evento, onOpenChange, onConfirmar }: DialogExcluirLancamentoExtratoProps) {
  return (
    <AlertDialog open={!!evento} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
          <AlertDialogDescription>
            {evento && (
              <>
                {evento.descricao} — {evento.tipo === "entrada" ? "entrada" : "saída"} de{" "}
                <ValorMonetario valor={evento.valor} />.{" "}
                {evento.conta_no_saldo
                  ? "Esse valor está contando no saldo e nos cards — ao excluir, ele é retirado/adicionado de volta automaticamente."
                  : "Esse lançamento está marcado como \"Fora do caixa\" e não afeta o saldo."}
                {" "}Essa ação não pode ser desfeita.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => evento && onConfirmar(evento)}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
