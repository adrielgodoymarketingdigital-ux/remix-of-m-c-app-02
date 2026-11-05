import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle } from "lucide-react";

interface BotaoCancelarTrialProps {
  cancelando: boolean;
  onConfirmar: () => void;
}

/** "Cancelar Trial" com a confirmação. */
export function BotaoCancelarTrial({ cancelando, onConfirmar }: BotaoCancelarTrialProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
          disabled={cancelando}
        >
          {cancelando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cancelando...
            </>
          ) : (
            <>
              <XCircle className="mr-2 h-4 w-4" />
              Cancelar Trial
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar período de teste?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Ao cancelar seu trial, você perderá acesso imediato a todas as funcionalidades:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Não poderá mais cadastrar dispositivos, clientes ou vendas</li>
              <li>Não terá acesso ao PDV, Financeiro e Relatórios</li>
              <li>Ordens de serviço ficarão indisponíveis</li>
              <li>Seus dados serão mantidos, mas não poderá acessá-los</li>
            </ul>
            <p className="font-semibold text-destructive">
              Para voltar a usar o sistema, você precisará assinar um plano.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar Trial</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmar}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Confirmar Cancelamento
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
