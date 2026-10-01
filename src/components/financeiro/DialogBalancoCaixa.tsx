import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { formatCurrency, parseValorMonetarioBR } from "@/lib/formatters";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";
import type { NovoLancamentoExtrato } from "@/hooks/useExtratoFinanceiro";

interface DialogBalancoCaixaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Saldo acumulado do Extrato agora (o do card "Saldo Atual"); null se falhou. */
  buscarSaldoAtual: () => Promise<number | null>;
  /** Grava o ajuste; true = deu certo (o diálogo fecha). */
  onSalvar: (lancamento: NovoLancamentoExtrato) => Promise<boolean>;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

/**
 * Balanço do caixa: o usuário informa o saldo real e o sistema lança UM ajuste
 * (entrada ou saída) com a diferença, para o saldo do Extrato bater dali em diante.
 */
export function DialogBalancoCaixa({ open, onOpenChange, buscarSaldoAtual, onSalvar }: DialogBalancoCaixaProps) {
  const [saldoSistema, setSaldoSistema] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [saldoInformado, setSaldoInformado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [contaNoSaldo, setContaNoSaldo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSaldoInformado("");
    setMotivo("");
    setContaNoSaldo(true);
    setSaldoSistema(null);
    setCarregando(true);
    buscarSaldoAtual().then((saldo) => {
      setSaldoSistema(saldo);
      setCarregando(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // parseValorMonetarioBR devolve o valor absoluto; o saldo real pode ser negativo (conta no vermelho).
  const informadoPreenchido = /\d/.test(saldoInformado);
  const informado = (saldoInformado.trim().startsWith("-") ? -1 : 1) * parseValorMonetarioBR(saldoInformado);
  const ajuste = saldoSistema !== null && informadoPreenchido ? centavos(informado - saldoSistema) : null;
  const semDiferenca = ajuste !== null && Math.abs(ajuste) < 0.01;

  const confirmar = async () => {
    if (ajuste === null || semDiferenca || salvando || saldoSistema === null) return;
    setSalvando(true);
    // Recalcula na hora de gravar: se entrou/saiu algo desde a prévia, mostra a prévia nova antes.
    const saldoAgora = await buscarSaldoAtual();
    if (saldoAgora === null) {
      toast.error("Não foi possível conferir o saldo. Tente de novo.");
      setSalvando(false);
      return;
    }
    if (Math.abs(saldoAgora - saldoSistema) >= 0.01) {
      setSaldoSistema(saldoAgora);
      setSalvando(false);
      toast.info("O saldo do sistema mudou enquanto você conferia. Veja o ajuste atualizado e confirme de novo.");
      return;
    }
    const ok = await onSalvar({
      tipo: ajuste > 0 ? "entrada" : "saida",
      valor: Math.abs(ajuste),
      motivo,
      data: dataBrasiliaISO(),
      categoria: "balanco",
      contaNoSaldo,
    });
    setSalvando(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Balanço do caixa</DialogTitle>
          <DialogDescription>
            Informe quanto a empresa tem de verdade hoje (banco + caixa). O sistema lança um único ajuste para o
            saldo do extrato bater com esse valor daqui pra frente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="balanco-saldo">Saldo real (R$)</Label>
            <Input
              id="balanco-saldo"
              inputMode="decimal"
              placeholder="0,00"
              value={saldoInformado}
              onChange={(e) => setSaldoInformado(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="balanco-motivo">Motivo (opcional)</Label>
            <Input
              id="balanco-motivo"
              maxLength={200}
              placeholder="Ex: Balanço de recomeço, conferência manual"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="balanco-conta-saldo">Contar no saldo e nos relatórios</Label>
              <p className="text-xs text-muted-foreground">
                {contaNoSaldo
                  ? "Esse ajuste entra no Saldo Atual, nos cards de entrada/saída e no Extrato."
                  : "Esse ajuste fica gravado, mas não aparece no saldo, nos cards nem em nenhum relatório financeiro."}
              </p>
            </div>
            <Switch id="balanco-conta-saldo" checked={contaNoSaldo} onCheckedChange={setContaNoSaldo} />
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Saldo atual do sistema</span>
              <span className="font-medium">
                {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : saldoSistema === null ? "Indisponível" : formatCurrency(saldoSistema)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Saldo informado</span>
              <span className="font-medium">{informadoPreenchido ? formatCurrency(informado) : "—"}</span>
            </div>
            <div className="flex justify-between gap-3 border-t pt-1.5">
              <span className="text-muted-foreground">Ajuste a ser lançado</span>
              {ajuste === null ? (
                <span className="font-medium">—</span>
              ) : semDiferenca ? (
                <span className="font-medium">Nenhum — o saldo já confere</span>
              ) : (
                <span className={`font-semibold ${ajuste > 0 ? "text-green-600" : "text-destructive"}`}>
                  {formatCurrency(Math.abs(ajuste))} ({ajuste > 0 ? "entrada" : "saída"})
                </span>
              )}
            </div>
          </div>

          {!carregando && saldoSistema === null && (
            <p className="text-xs text-destructive">Não foi possível calcular o saldo do sistema. Feche e abra de novo.</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={ajuste === null || semDiferenca || salvando}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
