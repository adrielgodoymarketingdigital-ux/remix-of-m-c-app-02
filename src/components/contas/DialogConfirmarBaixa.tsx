import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Conta } from "@/types/conta";
import { useFormasPagamentoCustomizadas } from "@/hooks/useFormasPagamentoCustomizadas";

const FORMAS_PADRAO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "credito_parcelado", label: "Crédito Parcelado" },
];

interface DialogConfirmarBaixaProps {
  conta: Conta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (id: string, tipo: "pagar" | "receber", formaPagamento: string) => Promise<boolean>;
}

export function DialogConfirmarBaixa({
  conta,
  open,
  onOpenChange,
  onConfirmar,
}: DialogConfirmarBaixaProps) {
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [loading, setLoading] = useState(false);
  const { formas: formasCustomizadas } = useFormasPagamentoCustomizadas();

  const handleConfirmar = async () => {
    if (!conta) return;
    setLoading(true);
    await onConfirmar(conta.id, conta.tipo, formaPagamento);
    setLoading(false);
    onOpenChange(false);
    setFormaPagamento("dinheiro");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) setFormaPagamento("dinheiro");
    onOpenChange(open);
  };

  if (!conta) return null;

  const tituloBotao = conta.tipo === "pagar" ? "Marcar como Pago" : "Marcar como Recebido";
  const tituloDialog = conta.tipo === "pagar" ? "Confirmar Pagamento" : "Confirmar Recebimento";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tituloDialog}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-sm font-medium">{conta.nome}</p>
            <p className="text-lg font-bold">
              <ValorMonetario valor={conta.valor} tipo="preco" />
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="forma-pagamento">Forma de pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger id="forma-pagamento">
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PADRAO.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
                {formasCustomizadas.map((f) => (
                  <SelectItem key={f.id} value={f.nome}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={loading || !formaPagamento}>
            {tituloBotao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
