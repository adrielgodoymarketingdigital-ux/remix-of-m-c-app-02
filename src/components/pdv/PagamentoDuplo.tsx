import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";

const LABELS_FORMA: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
  credito_parcelado: "Crédito Parcelado",
};

const FORMAS_DISPONIVEIS = ["dinheiro", "pix", "debito", "credito", "credito_parcelado"];

interface PagamentoDuploProps {
  valorTotal: number;
  formaPagamento: string;
  numeroParcelas: number;
  onPagamentoDuploChange: (dados: {
    ativo: boolean;
    valorPrimeira: number;
    segundaForma: string;
    valorSegunda: number;
  }) => void;
}

export function PagamentoDuplo({
  valorTotal,
  formaPagamento,
  numeroParcelas,
  onPagamentoDuploChange,
}: PagamentoDuploProps) {
  const [ativo, setAtivo] = useState(false);
  const [valorPrimeira, setValorPrimeira] = useState(valorTotal);
  const [segundaForma, setSegundaForma] = useState("");

  const valorSegunda = Math.max(0, valorTotal - valorPrimeira);

  // Sincronizar valorPrimeira quando o total muda ou o modo é desativado
  useEffect(() => {
    setValorPrimeira(valorTotal);
  }, [valorTotal]);

  // Resetar ao desativar
  useEffect(() => {
    if (!ativo) {
      setValorPrimeira(valorTotal);
      setSegundaForma("");
      onPagamentoDuploChange({ ativo: false, valorPrimeira: valorTotal, segundaForma: "", valorSegunda: 0 });
    }
  }, [ativo]);

  // Notificar mudanças
  useEffect(() => {
    if (ativo) {
      onPagamentoDuploChange({ ativo, valorPrimeira, segundaForma, valorSegunda });
    }
  }, [ativo, valorPrimeira, segundaForma, valorSegunda]);

  const formasDisponiveis = FORMAS_DISPONIVEIS.filter((f) => f !== formaPagamento);

  return (
    <div className="space-y-3 pt-2 border-t">
      <div className="flex items-center justify-between">
        <Label htmlFor="pagamento-duplo" className="text-sm font-medium">
          Dividir em 2 formas de pagamento
        </Label>
        <Switch
          id="pagamento-duplo"
          checked={ativo}
          onCheckedChange={setAtivo}
        />
      </div>

      {ativo && (
        <div className="space-y-3 pl-1">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              1ª forma: <span className="font-medium text-foreground">{LABELS_FORMA[formaPagamento] ?? formaPagamento}</span>
              {formaPagamento === "credito_parcelado" && numeroParcelas > 1 && ` (${numeroParcelas}x)`}
            </p>
            <div className="flex items-center gap-2">
              <Label htmlFor="valor-primeira" className="text-xs text-muted-foreground whitespace-nowrap">
                Valor na 1ª forma
              </Label>
              <Input
                id="valor-primeira"
                type="number"
                min={0.01}
                max={valorTotal}
                step={0.01}
                value={valorPrimeira}
                onChange={(e) => {
                  const v = Math.min(valorTotal, Math.max(0, Number(e.target.value) || 0));
                  setValorPrimeira(v);
                }}
                className="h-8 text-right"
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              Restante: <span className="font-medium text-foreground">{formatCurrency(valorSegunda)}</span>
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="segunda-forma" className="text-xs text-muted-foreground">
              2ª forma de pagamento
            </Label>
            <Select value={segundaForma} onValueChange={setSegundaForma}>
              <SelectTrigger id="segunda-forma" className="h-8">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {formasDisponiveis.map((f) => (
                  <SelectItem key={f} value={f}>
                    {LABELS_FORMA[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {segundaForma && (
            <p className="text-xs text-center bg-muted rounded px-2 py-1.5">
              <span className="font-medium">{formatCurrency(valorPrimeira)}</span>
              {" em "}{LABELS_FORMA[formaPagamento] ?? formaPagamento}
              {" + "}
              <span className="font-medium">{formatCurrency(valorSegunda)}</span>
              {" em "}{LABELS_FORMA[segundaForma]}
              {" = "}
              <span className="font-semibold">{formatCurrency(valorTotal)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
