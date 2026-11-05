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

interface BotaoCancelarPlanoProps {
  cancelando: boolean;
  onConfirmar: () => void;
}

/** "Cancelar Plano" com a confirmação (cancel-subscription: volta ao Free na hora). */
export function BotaoCancelarPlano({ cancelando, onConfirmar }: BotaoCancelarPlanoProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={cancelando}>
          {cancelando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cancelando...
            </>
          ) : (
            <>
              <XCircle className="mr-2 h-4 w-4" />
              Cancelar Plano
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem certeza que deseja cancelar?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Ao cancelar seu plano, você perderá acesso imediato a todos os benefícios:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Limite de dispositivos será reduzido para 5</li>
              <li>Limite de clientes será reduzido para 10</li>
              <li>Limite de ordens de serviço será reduzido para 5</li>
              <li>Perda de acesso a módulos Premium</li>
              <li>Perda de relatórios avançados</li>
              <li>Perda de suporte prioritário</li>
            </ul>
            <p className="font-semibold text-destructive">
              Esta ação é irreversível. Você será movido para o plano de demonstração.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
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
