import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UsuarioAdmin } from "@/hooks/useAdminUsuarios";
import { AlertTriangle } from "lucide-react";

interface DialogDeletarUsuarioProps {
  usuario: UsuarioAdmin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (userId: string) => Promise<boolean>;
}

export function DialogDeletarUsuario({
  usuario,
  open,
  onOpenChange,
  onConfirmar,
}: DialogDeletarUsuarioProps) {
  const [confirmacaoTexto, setConfirmacaoTexto] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const textoEsperado = "DELETAR";
  const podeConfirmar = confirmacaoTexto === textoEsperado;

  const handleConfirmar = async () => {
    if (!usuario || !podeConfirmar) return;
    
    setIsDeleting(true);
    const success = await onConfirmar(usuario.user_id);
    setIsDeleting(false);
    
    if (success) {
      setConfirmacaoTexto("");
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmacaoTexto("");
    }
    onOpenChange(newOpen);
  };

  if (!usuario) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Deletar Usuário Permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Você está prestes a deletar permanentemente o usuário:
              </p>
              <div className="bg-muted p-3 rounded-lg space-y-1">
                <p className="font-medium">{usuario.nome}</p>
                <p className="text-sm text-muted-foreground">{usuario.email}</p>
              </div>
              <p className="text-red-600 font-medium">
                ⚠️ Esta ação é IRREVERSÍVEL e irá deletar:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Todos os dados do usuário</li>
                <li>Dispositivos, vendas e ordens de serviço</li>
                <li>Clientes, produtos e serviços</li>
                <li>Configurações da loja</li>
                <li>Assinatura e histórico</li>
                <li>Conta de autenticação</li>
              </ul>
              <div className="pt-2">
                <Label htmlFor="confirmacao" className="text-sm">
                  Digite <span className="font-mono font-bold text-red-600">DELETAR</span> para confirmar:
                </Label>
                <Input
                  id="confirmacao"
                  value={confirmacaoTexto}
                  onChange={(e) => setConfirmacaoTexto(e.target.value.toUpperCase())}
                  placeholder="Digite DELETAR"
                  className="mt-2"
                  autoComplete="off"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <Button
            onClick={handleConfirmar}
            disabled={!podeConfirmar || isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? "Deletando..." : "Deletar Permanentemente"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
