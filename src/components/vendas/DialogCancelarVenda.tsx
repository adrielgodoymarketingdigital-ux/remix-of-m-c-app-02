import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, RotateCcw } from "lucide-react";
import { Venda } from "@/types/venda";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useState } from "react";

interface DialogCancelarVendaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda: Venda | null;
  onConfirmar: (estornarEstoque: boolean, motivo: string) => Promise<void>;
  cancelando: boolean;
}

const tipoLabels: Record<string, string> = {
  dispositivo: "Dispositivo",
  produto: "Produto",
  servico: "Serviço",
};

export const DialogCancelarVenda = ({
  open,
  onOpenChange,
  venda,
  onConfirmar,
  cancelando,
}: DialogCancelarVendaProps) => {
  const [estornarEstoque, setEstornarEstoque] = useState(true);
  const [motivo, setMotivo] = useState("");

  const handleConfirmar = async () => {
    await onConfirmar(estornarEstoque, motivo);
    setEstornarEstoque(true);
    setMotivo("");
  };

  const handleClose = () => {
    if (!cancelando) {
      onOpenChange(false);
      setEstornarEstoque(true);
      setMotivo("");
    }
  };

  if (!venda) return null;

  const nomeItem =
    venda.tipo === "dispositivo" && venda.dispositivos
      ? `${venda.dispositivos.marca} ${venda.dispositivos.modelo}`
      : venda.tipo === "servico" && venda.ordens_servico
      ? `OS ${venda.ordens_servico.numero_os}`
      : venda.produtos?.nome || "Item";

  // Serviços não têm estoque para estornar
  const podeEstornar = venda.tipo !== "servico";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancelar Venda
          </DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. A venda será marcada como cancelada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Detalhes da venda */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Item:</span>
              <span className="font-medium text-sm">{nomeItem}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tipo:</span>
              <Badge variant="outline">{tipoLabels[venda.tipo]}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor:</span>
              <ValorMonetario valor={venda.total} tipo="preco" className="font-semibold text-destructive" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Data:</span>
              <span className="text-sm">{formatDateTime(venda.data)}</span>
            </div>
            {venda.clientes?.nome && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cliente:</span>
                <span className="text-sm">{venda.clientes.nome}</span>
              </div>
            )}
          </div>

          {/* Opção de estorno de estoque */}
          {podeEstornar && (
            <div className="flex items-start gap-3 p-3 border rounded-lg bg-background">
              <Checkbox
                id="estornar"
                checked={estornarEstoque}
                onCheckedChange={(checked) => setEstornarEstoque(checked === true)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="estornar"
                  className="flex items-center gap-2 font-medium cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  Estornar para estoque
                </Label>
                <p className="text-xs text-muted-foreground">
                  Devolver a quantidade vendida ({venda.quantidade}{" "}
                  {venda.quantidade === 1 ? "unidade" : "unidades"}) ao estoque
                </p>
              </div>
            </div>
          )}

          {/* Motivo do cancelamento */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo do cancelamento (opcional)</Label>
            <Textarea
              id="motivo"
              placeholder="Informe o motivo do cancelamento..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={cancelando}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmar}
            disabled={cancelando}
          >
            {cancelando ? (
              "Cancelando..."
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Confirmar Cancelamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
