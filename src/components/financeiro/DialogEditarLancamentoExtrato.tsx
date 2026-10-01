import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { parseValorMonetarioBR } from "@/lib/formatters";
import type { EdicaoLancamentoExtrato, EventoExtrato } from "@/hooks/useExtratoFinanceiro";

interface DialogEditarLancamentoExtratoProps {
  /** Lançamento manual/balanço a editar; null = diálogo fechado. */
  evento: EventoExtrato | null;
  onOpenChange: (open: boolean) => void;
  /** Grava a edição; true = deu certo (o diálogo fecha). */
  onSalvar: (edicao: EdicaoLancamentoExtrato) => Promise<boolean>;
}

/** Editar valor, data e se conta no saldo de um lançamento manual ou de balanço já gravado. */
export function DialogEditarLancamentoExtrato({ evento, onOpenChange, onSalvar }: DialogEditarLancamentoExtratoProps) {
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [contaNoSaldo, setContaNoSaldo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!evento) return;
    setValor(evento.valor.toFixed(2).replace(".", ","));
    setData(evento.data);
    setContaNoSaldo(evento.conta_no_saldo);
  }, [evento]);

  const valorNumero = parseValorMonetarioBR(valor);
  const valido = valorNumero > 0 && /^\d{4}-\d{2}-\d{2}$/.test(data);

  const confirmar = async () => {
    if (!evento || !valido || salvando) return;
    setSalvando(true);
    const ok = await onSalvar({ id: evento.referencia_id, valor: valorNumero, data, contaNoSaldo });
    setSalvando(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={!!evento} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
          <DialogDescription>
            {evento?.descricao ?? ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="editar-lancamento-valor">Valor (R$)</Label>
              <Input
                id="editar-lancamento-valor"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="editar-lancamento-data">Data</Label>
              <Input id="editar-lancamento-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="editar-lancamento-conta-saldo">Contar no saldo e nos relatórios</Label>
              <p className="text-xs text-muted-foreground">
                {contaNoSaldo
                  ? "Esse lançamento entra no Saldo Atual e nos cards de entrada/saída."
                  : "Fica marcado como \"Fora do caixa\" — continua na lista, mas não soma no saldo nem nos cards."}
              </p>
            </div>
            <Switch id="editar-lancamento-conta-saldo" checked={contaNoSaldo} onCheckedChange={setContaNoSaldo} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!valido || salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
