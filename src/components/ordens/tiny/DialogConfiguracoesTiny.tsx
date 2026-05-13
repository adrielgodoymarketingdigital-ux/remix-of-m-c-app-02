import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Lock, RefreshCw, Unplug, CheckCircle2, XCircle } from "lucide-react";
import { TinyIntegration } from "@/hooks/useTinyIntegration";

interface Props {
  open: boolean;
  onClose: () => void;
  integration: TinyIntegration | null;
  onReconectar: () => void;
  onDesconectar: () => void;
  onAtualizarIntervalo: (v: number) => void;
}

export function DialogConfiguracoesTiny({
  open,
  onClose,
  integration,
  onReconectar,
  onDesconectar,
  onAtualizarIntervalo,
}: Props) {
  const [confirmDesconectar, setConfirmDesconectar] = useState(false);

  const conectado = !!integration && new Date(integration.expires_at) > new Date();

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Configurações da Integração Tiny</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Status */}
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-3">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Assistência parceira</p>
                <p className="text-sm font-semibold">
                  {integration?.nome_assistencia || "Não informado"}
                </p>
              </div>
              <Badge
                variant={conectado ? "default" : "destructive"}
                className="gap-1 text-xs"
              >
                {conectado ? (
                  <><CheckCircle2 className="h-3 w-3" /> Conectado</>
                ) : (
                  <><XCircle className="h-3 w-3" /> Desconectado</>
                )}
              </Badge>
            </div>

            {/* Atualização automática */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Atualização automática</p>
              <Select
                value={String(integration?.auto_refresh_interval ?? 15)}
                onValueChange={(v) => onAtualizarIntervalo(Number(v))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">A cada 5 minutos</SelectItem>
                  <SelectItem value="15">A cada 15 minutos</SelectItem>
                  <SelectItem value="30">A cada 30 minutos</SelectItem>
                  <SelectItem value="60">A cada 60 minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ações */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2 text-xs"
                onClick={onReconectar}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reconectar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 gap-2 text-xs"
                onClick={() => setConfirmDesconectar(true)}
              >
                <Unplug className="h-3.5 w-3.5" />
                Desconectar
              </Button>
            </div>
          </div>

          <DialogFooter>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 w-full">
              <Lock className="h-3 w-3 shrink-0" />
              A conexão é feita com segurança via OAuth 2.0. Nenhum token é exposto no navegador.
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDesconectar} onOpenChange={setConfirmDesconectar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar integração?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Isso removerá o acesso aos dados da assistência parceira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { onDesconectar(); setConfirmDesconectar(false); onClose(); }}
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
