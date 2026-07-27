import { useState, useEffect } from "react";
import { Clock, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";

interface DialogConfiguracaoValorHoraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export function DialogConfiguracaoValorHora({
  open,
  onOpenChange,
  onSave,
}: DialogConfiguracaoValorHoraProps) {
  const { config, atualizarConfiguracao } = useConfiguracaoLoja();
  const [valorHora, setValorHora] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setValorHora(
      config?.valor_hora_referencia != null ? String(config.valor_hora_referencia) : ""
    );
  }, [config]);

  const handleSalvar = async () => {
    const valorNumerico = valorHora ? Number(valorHora.replace(",", ".")) : null;

    if (valorHora && (valorNumerico == null || Number.isNaN(valorNumerico) || valorNumerico < 0)) {
      toast.error("Informe um valor válido");
      return;
    }

    setSalvando(true);
    try {
      const sucesso = await atualizarConfiguracao({
        valor_hora_referencia: valorNumerico,
      });
      if (sucesso) {
        toast.success("Valor por hora salvo com sucesso!");
        onSave?.();
        onOpenChange(false);
      } else {
        toast.error("Erro ao salvar valor por hora");
      }
    } catch (error) {
      toast.error("Erro ao salvar valor por hora");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Valor por Hora (Mão de Obra)
          </DialogTitle>
          <DialogDescription>
            Valor de referência usado para calcular o custo de mão de obra nas OS.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Esse cálculo é apenas informativo — não altera o valor cobrado do cliente nem os
            cálculos de faturamento/lucro do Dashboard e relatórios.
          </AlertDescription>
        </Alert>

        <div className="space-y-1.5">
          <Label htmlFor="valor-hora">Valor por hora (R$)</Label>
          <Input
            id="valor-hora"
            type="text"
            inputMode="decimal"
            placeholder="Ex: 50.00"
            value={valorHora}
            onChange={(e) => setValorHora(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            <Save className="h-4 w-4 mr-2" />
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
