import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, ShieldX, ShieldCheck, Lock, CreditCard } from "lucide-react";

export type TipoBloqueio = "indeterminado" | "ate_assinar";

interface DialogBloquearUsuarioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario: {
    user_id: string;
    nome: string;
    email: string;
    bloqueado?: boolean;
    bloqueado_tipo?: TipoBloqueio;
  } | null;
  onConfirmar: (userId: string, motivo: string, tipoBloqueio: TipoBloqueio) => Promise<void>;
  onDesbloquear: (userId: string) => Promise<void>;
  isLoading: boolean;
}

export function DialogBloquearUsuario({
  open,
  onOpenChange,
  usuario,
  onConfirmar,
  onDesbloquear,
  isLoading,
}: DialogBloquearUsuarioProps) {
  const [motivo, setMotivo] = useState("");
  const [tipoBloqueio, setTipoBloqueio] = useState<TipoBloqueio>("ate_assinar");

  if (!usuario) return null;

  const handleConfirmar = async () => {
    if (usuario.bloqueado) {
      await onDesbloquear(usuario.user_id);
    } else {
      await onConfirmar(usuario.user_id, motivo, tipoBloqueio);
    }
    setMotivo("");
    setTipoBloqueio("ate_assinar");
    onOpenChange(false);
  };

  const handleClose = () => {
    setMotivo("");
    setTipoBloqueio("ate_assinar");
    onOpenChange(false);
  };

  const getTipoBloqueioLabel = (tipo?: TipoBloqueio) => {
    if (tipo === "indeterminado") return "Bloqueio Indeterminado (manual)";
    if (tipo === "ate_assinar") return "Bloqueado até assinar plano";
    return "Desconhecido";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {usuario.bloqueado ? (
              <>
                <ShieldCheck className="h-5 w-5 text-green-600" />
                Desbloquear Usuário
              </>
            ) : (
              <>
                <ShieldX className="h-5 w-5 text-red-600" />
                Bloquear Usuário
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {usuario.bloqueado
              ? "Este usuário está atualmente bloqueado. Deseja restaurar o acesso?"
              : "Escolha o tipo de bloqueio para este usuário."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium">{usuario.nome}</p>
            <p className="text-sm text-muted-foreground">{usuario.email}</p>
            {usuario.bloqueado && usuario.bloqueado_tipo && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {getTipoBloqueioLabel(usuario.bloqueado_tipo)}
              </p>
            )}
          </div>

          {!usuario.bloqueado && (
            <>
              <div className="space-y-3">
                <Label>Tipo de Bloqueio</Label>
                <RadioGroup
                  value={tipoBloqueio}
                  onValueChange={(value) => setTipoBloqueio(value as TipoBloqueio)}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="ate_assinar" id="ate_assinar" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="ate_assinar" className="flex items-center gap-2 cursor-pointer font-medium">
                        <CreditCard className="h-4 w-4 text-blue-600" />
                        Bloquear até assinar plano
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        O usuário será desbloqueado automaticamente quando assinar qualquer plano pago. 
                        As funcionalidades serão liberadas conforme o plano escolhido.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="indeterminado" id="indeterminado" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="indeterminado" className="flex items-center gap-2 cursor-pointer font-medium">
                        <Lock className="h-4 w-4 text-red-600" />
                        Bloquear por prazo indeterminado
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Bloqueio permanente. Apenas um administrador pode desbloquear manualmente, 
                        mesmo se o usuário assinar um plano.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-400">
                  {tipoBloqueio === "ate_assinar" 
                    ? "O usuário não poderá usar o sistema até assinar um plano. Após assinar, terá acesso normal conforme o plano escolhido."
                    : "O usuário ficará bloqueado permanentemente até que você o desbloqueie manualmente."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo do bloqueio (opcional)</Label>
                <Textarea
                  id="motivo"
                  placeholder="Ex: Uso indevido após término do trial..."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          {usuario.bloqueado ? (
            <Button
              onClick={handleConfirmar}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? "Desbloqueando..." : "Confirmar Desbloqueio"}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleConfirmar}
              disabled={isLoading}
            >
              {isLoading ? "Bloqueando..." : "Confirmar Bloqueio"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
