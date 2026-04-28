import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCaixa } from "@/hooks/useCaixa";
import { Caixa } from "@/types/caixa";

interface DialogAberturaCaixaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCaixaAberto: (caixa: Caixa) => void;
}

export function DialogAberturaCaixa({ open, onOpenChange, onCaixaAberto }: DialogAberturaCaixaProps) {
  const { toast } = useToast();
  const { abrirCaixa } = useCaixa();
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleAbrir = async () => {
    setSalvando(true);
    try {
      const caixa = await abrirCaixa(saldoInicial, observacoes || undefined);
      if (!caixa) throw new Error("Falha ao abrir caixa");
      toast({ title: "Caixa aberto com sucesso!" });
      onCaixaAberto(caixa);
      setSaldoInicial(0);
      setObservacoes("");
    } catch (err: unknown) {
      toast({
        title: "Erro ao abrir caixa",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Abrir Caixa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="saldo-inicial">Saldo Inicial (R$)</Label>
            <Input
              id="saldo-inicial"
              type="number"
              min="0"
              step="0.01"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="obs-abertura">Observações (opcional)</Label>
            <Input
              id="obs-abertura"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Caixa do turno da manhã"
            />
          </div>
          <Button className="w-full" onClick={handleAbrir} disabled={salvando}>
            {salvando ? "Abrindo..." : "Abrir Caixa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
