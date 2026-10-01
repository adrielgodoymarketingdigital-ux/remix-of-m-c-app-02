import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import { parseValorMonetarioBR } from "@/lib/formatters";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";
import type { NovoLancamentoExtrato } from "@/hooks/useExtratoFinanceiro";

interface DialogLancamentoExtratoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Grava o lançamento; true = deu certo (o diálogo fecha). */
  onSalvar: (lancamento: NovoLancamentoExtrato) => Promise<boolean>;
}

/** Lançamento manual de entrada/saída no Extrato (independe de caixa aberto no PDV). */
export function DialogLancamentoExtrato({ open, onOpenChange, onSalvar }: DialogLancamentoExtratoProps) {
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [data, setData] = useState(dataBrasiliaISO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipo("entrada");
    setValor("");
    setMotivo("");
    setData(dataBrasiliaISO());
  }, [open]);

  const valorNumero = parseValorMonetarioBR(valor);
  const valido = valorNumero > 0 && /^\d{4}-\d{2}-\d{2}$/.test(data);

  const confirmar = async () => {
    if (!valido || salvando) return;
    setSalvando(true);
    const ok = await onSalvar({ tipo, valor: valorNumero, motivo, data, categoria: "manual" });
    setSalvando(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar entrada ou saída</DialogTitle>
          <DialogDescription>
            Registra no extrato um valor que entrou ou saiu da empresa e não veio de venda, OS ou conta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={tipo === "entrada" ? "default" : "outline"}
              className={tipo === "entrada" ? "bg-green-600 hover:bg-green-600/90 text-white" : ""}
              onClick={() => setTipo("entrada")}
            >
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Entrada
            </Button>
            <Button
              variant={tipo === "saida" ? "destructive" : "outline"}
              onClick={() => setTipo("saida")}
            >
              <ArrowDownCircle className="h-4 w-4 mr-2" />
              Saída
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="lancamento-valor">Valor (R$)</Label>
              <Input
                id="lancamento-valor"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmar(); }}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lancamento-data">Data</Label>
              <Input id="lancamento-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="lancamento-motivo">Motivo (opcional)</Label>
            <Input
              id="lancamento-motivo"
              maxLength={200}
              placeholder={tipo === "entrada" ? "Ex: aporte do sócio" : "Ex: retirada do sócio"}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmar(); }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!valido || salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Lançar {tipo === "entrada" ? "entrada" : "saída"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
