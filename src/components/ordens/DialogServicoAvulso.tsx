import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Wrench } from "lucide-react";

interface DialogServicoAvulsoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriar: (dados: { nome: string; custo: number; preco: number; observacoes?: string }) => Promise<boolean>;
}

export const DialogServicoAvulso = ({ open, onOpenChange, onCriar }: DialogServicoAvulsoProps) => {
  const [nome, setNome] = useState("");
  const [custo, setCusto] = useState("");
  const [preco, setPreco] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const custoNum = parseFloat(custo) || 0;
  const precoNum = parseFloat(preco) || 0;
  const lucro = precoNum - custoNum;

  const handleSubmit = async () => {
    if (!nome || !preco) return;

    setIsSubmitting(true);
    try {
      const sucesso = await onCriar({
        nome,
        custo: custoNum,
        preco: precoNum,
        observacoes: observacoes || undefined,
      });

      if (sucesso) {
        setNome("");
        setCusto("");
        setPreco("");
        setObservacoes("");
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Lançar Serviço Avulso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="nome-avulso">Nome do Serviço *</Label>
            <Input
              id="nome-avulso"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Troca de tela avulsa"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="custo-avulso">Custo (R$)</Label>
              <Input
                id="custo-avulso"
                type="number"
                step="0.01"
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preco-avulso">Valor Cobrado (R$) *</Label>
              <Input
                id="preco-avulso"
                type="number"
                step="0.01"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className={`p-3 rounded-md border ${lucro >= 0 ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'}`}>
            <p className={`text-sm font-medium ${lucro >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              Lucro: <ValorMonetario valor={lucro} />
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs-avulso">Observações</Label>
            <Textarea
              id="obs-avulso"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre o serviço (opcional)"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!nome || !preco || isSubmitting}
            >
              {isSubmitting ? "Lançando..." : "Lançar Serviço"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
