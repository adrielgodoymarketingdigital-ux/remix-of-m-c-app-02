import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Caixa } from "@/types/caixa";
import { useTranslation } from "react-i18next";
import { useFormatadores } from "@/hooks/useFormatadores";
import i18n from "@/lib/i18n/instancia";

interface DialogAberturaCaixaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCaixaAberto: (caixa: Caixa) => void;
  abrirCaixa: (saldoInicial: number, observacoes?: string) => Promise<Caixa | null>;
}

export function DialogAberturaCaixa({ open, onOpenChange, onCaixaAberto, abrirCaixa }: DialogAberturaCaixaProps) {
  const { toast } = useToast();
  const { t } = useTranslation("pdv");
  const fmt = useFormatadores();
  // Toasts depois do await: lidos na hora (convencoes.md, item 10).
  const tAgora = (chave: string) => i18n.t(chave, { ns: "pdv" });
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleAbrir = async () => {
    setSalvando(true);
    try {
      const caixa = await abrirCaixa(saldoInicial, observacoes || undefined);
      if (!caixa) throw new Error(tAgora("caixa.abertura.falha"));
      toast({ title: tAgora("caixa.abertura.sucesso") });
      onCaixaAberto(caixa);
      setSaldoInicial(0);
      setObservacoes("");
    } catch (err: unknown) {
      toast({
        title: tAgora("caixa.abertura.erro"),
        description: err instanceof Error ? err.message : tAgora("caixa.erroDesconhecido"),
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
          <DialogTitle>{t("caixa.abertura.titulo")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="saldo-inicial">{t("caixa.abertura.saldoInicial", { simbolo: fmt.simboloMoeda })}</Label>
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
            <Label htmlFor="obs-abertura">{t("caixa.abertura.observacoes")}</Label>
            <Input
              id="obs-abertura"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder={t("caixa.abertura.observacoesPlaceholder")}
            />
          </div>
          <Button className="w-full" onClick={handleAbrir} disabled={salvando}>
            {salvando ? t("caixa.abertura.abrindo") : t("caixa.abertura.abrir")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
