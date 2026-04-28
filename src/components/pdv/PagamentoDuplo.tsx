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
  a_receber: "A Receber",
};

const FORMAS_DISPONIVEIS = ["dinheiro", "pix", "debito", "credito", "credito_parcelado", "a_receber"];

interface PagamentoDuploProps {
  valorTotal: number;
  formaPagamento: string;
  numeroParcelas: number;
  onPagamentoDuploChange: (dados: {
    ativo: boolean;
    valorPrimeira: number;
    segundaForma: string;
    valorSegunda: number;
    dataPrevistaSegunda?: string;
  }) => void;
}

export function PagamentoDuplo({
  valorTotal,
  formaPagamento,
  numeroParcelas,
  onPagamentoDuploChange,
}: PagamentoDuploProps) {
  const [ativo, setAtivo] = useState(false);
  const [valorPrimeiraStr, setValorPrimeiraStr] = useState<string>("");
  const [segundaForma, setSegundaForma] = useState("");
  const [dataPrevistaSegunda, setDataPrevistaSegunda] = useState("");

  const hoje = new Date().toISOString().split("T")[0];

  // Inicializa o campo quando ativa ou quando o total muda (enquanto inativo)
  useEffect(() => {
    if (ativo) {
      setValorPrimeiraStr(valorTotal.toFixed(2));
    }
  }, [ativo, valorTotal]);

  // Reset ao desativar
  useEffect(() => {
    if (!ativo) {
      setValorPrimeiraStr("");
      setSegundaForma("");
      setDataPrevistaSegunda("");
      onPagamentoDuploChange({ ativo: false, valorPrimeira: valorTotal, segundaForma: "", valorSegunda: 0, dataPrevistaSegunda: "" });
    }
  }, [ativo]);

  const formasDisponiveis = FORMAS_DISPONIVEIS.filter((f) => f !== formaPagamento);

  const valorPrimeiraNum = parseFloat(valorPrimeiraStr) || 0;
  const valorSegundaCalculado = Math.max(0, valorTotal - valorPrimeiraNum);

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
                min="0.01"
                max={valorTotal}
                step="0.01"
                value={valorPrimeiraStr}
                onChange={(e) => {
                  setValorPrimeiraStr(e.target.value);
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num) && num > 0 && num < valorTotal) {
                    const segunda = valorTotal - num;
                    onPagamentoDuploChange({
                      ativo: true,
                      valorPrimeira: num,
                      segundaForma,
                      valorSegunda: segunda,
                      dataPrevistaSegunda,
                    });
                  }
                }}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value);
                  if (isNaN(num) || num <= 0) {
                    setValorPrimeiraStr("0.01");
                  } else if (num >= valorTotal) {
                    setValorPrimeiraStr((valorTotal - 0.01).toFixed(2));
                  }
                }}
                className="w-32 h-8 text-right"
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              Restante: <span className="font-medium text-foreground">{formatCurrency(valorSegundaCalculado)}</span>
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="segunda-forma" className="text-xs text-muted-foreground">
              2ª forma de pagamento
            </Label>
            <Select value={segundaForma} onValueChange={(v) => { setSegundaForma(v); setDataPrevistaSegunda(""); }}>
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

          {segundaForma === "a_receber" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Data Prevista de Recebimento *
              </Label>
              <Input
                type="date"
                value={dataPrevistaSegunda}
                onChange={(e) => setDataPrevistaSegunda(e.target.value)}
                min={hoje}
                className="h-8"
              />
            </div>
          )}

          {segundaForma && (
            <p className="text-xs text-center bg-muted rounded px-2 py-1.5">
              <span className="font-medium">{formatCurrency(valorPrimeiraNum)}</span>
              {" em "}{LABELS_FORMA[formaPagamento] ?? formaPagamento}
              {" + "}
              <span className="font-medium">{formatCurrency(valorSegundaCalculado)}</span>
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
