import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import { useCaixaMovimentacoes } from "@/hooks/useCaixaMovimentacoes";
import { formatCurrency } from "@/lib/formatters";

interface DialogSangriaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caixaId: string;
  onSucesso?: () => void;
}

export function DialogSangria({ open, onOpenChange, caixaId, onSucesso }: DialogSangriaProps) {
  const [tipo, setTipo] = useState<"sangria" | "suprimento">("sangria");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { registrarMovimentacao, totalSangrias, totalSuprimentos, carregarMovimentacoes } = useCaixaMovimentacoes();

  const handleOpenChange = (open: boolean) => {
    if (open) carregarMovimentacoes(caixaId);
    else {
      setValor("");
      setMotivo("");
    }
    onOpenChange(open);
  };

  const handleConfirmar = async () => {
    const valorNum = parseFloat(valor.replace(",", "."));
    if (!valorNum || valorNum <= 0) return;

    setSalvando(true);
    const ok = await registrarMovimentacao(caixaId, tipo, valorNum, motivo);
    setSalvando(false);

    if (ok) {
      setValor("");
      setMotivo("");
      onSucesso?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sangria / Suprimento</DialogTitle>
        </DialogHeader>

        <Tabs value={tipo} onValueChange={(v) => setTipo(v as "sangria" | "suprimento")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="sangria" className="gap-2">
              <ArrowDownCircle className="h-4 w-4 text-red-500" />
              Sangria
            </TabsTrigger>
            <TabsTrigger value="suprimento" className="gap-2">
              <ArrowUpCircle className="h-4 w-4 text-green-500" />
              Suprimento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sangria" className="space-y-4 mt-4">
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-3">
              <p className="text-xs text-red-600 dark:text-red-400">
                <strong>Sangria:</strong> Retirada de dinheiro do caixa. O valor será descontado do saldo final no fechamento.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="suprimento" className="space-y-4 mt-4">
            <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20 p-3">
              <p className="text-xs text-green-600 dark:text-green-400">
                <strong>Suprimento:</strong> Adição de dinheiro ao caixa. O valor será somado ao saldo no fechamento.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Valor (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Motivo</Label>
            <Input
              placeholder={tipo === "sangria" ? "Ex: Pagamento de fornecedor" : "Ex: Troco inicial"}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>

          {(totalSangrias > 0 || totalSuprimentos > 0) && (
            <div className="rounded-lg border border-border/40 bg-muted/30 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Movimentações do caixa</p>
              {totalSangrias > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-red-600 flex items-center gap-1">
                    <ArrowDownCircle className="h-3.5 w-3.5" /> Sangrias
                  </span>
                  <span className="text-red-600 font-mono">- {formatCurrency(totalSangrias)}</span>
                </div>
              )}
              {totalSuprimentos > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 flex items-center gap-1">
                    <ArrowUpCircle className="h-3.5 w-3.5" /> Suprimentos
                  </span>
                  <span className="text-green-600 font-mono">+ {formatCurrency(totalSuprimentos)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirmar}
              disabled={!valor || parseFloat(valor) <= 0 || salvando}
              variant={tipo === "sangria" ? "destructive" : "default"}
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : tipo === "sangria" ? "Registrar Sangria" : "Registrar Suprimento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
