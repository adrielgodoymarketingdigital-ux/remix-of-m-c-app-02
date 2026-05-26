import { KeyboardEvent } from "react";
import { Tag, AlertCircle, CheckCircle2, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CupomStatus, CupomDesconto } from "@/hooks/useCupom";

interface CupomFieldProps {
  codigo: string;
  setCodigo: (v: string) => void;
  status: CupomStatus;
  desconto: CupomDesconto | null;
  mensagemErro: string;
  validar: () => void;
  limpar: () => void;
  calcularPrecoFinal: (centavos: number) => number;
  precoOriginalCentavos: number;
}

export function CupomField({
  codigo,
  setCodigo,
  status,
  desconto,
  mensagemErro,
  validar,
  limpar,
  calcularPrecoFinal,
  precoOriginalCentavos,
}: CupomFieldProps) {
  const isLoading = status === "loading";
  const isValid = status === "valid";
  const isInvalid = status === "invalid" || status === "error";

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!isLoading && !isValid && codigo.trim()) {
        validar();
      }
    }
  };

  const precoFinalCentavos = calcularPrecoFinal(precoOriginalCentavos);
  const economiaReais = (precoOriginalCentavos - precoFinalCentavos) / 100;

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold flex items-center gap-1.5">
        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
        Cupom de desconto
      </Label>

      {/* Input + botão */}
      <div className="flex gap-2">
        <Input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="INSIRA O CÓDIGO"
          maxLength={30}
          disabled={isLoading || isValid}
          className={cn(
            "h-11 font-mono tracking-widest uppercase flex-1 transition-colors",
            isValid && "border-emerald-500 focus-visible:ring-emerald-500",
            isInvalid && "border-destructive focus-visible:ring-destructive"
          )}
        />

        {isValid ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
            onClick={limpar}
            aria-label="Remover cupom"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 px-4 shrink-0"
            onClick={validar}
            disabled={isLoading || !codigo.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Aplicar"
            )}
          </Button>
        )}
      </div>

      {/* Mensagem de erro */}
      {isInvalid && mensagemErro && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {mensagemErro}
        </p>
      )}

      {/* Card de sucesso */}
      {isValid && desconto && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              Cupom aplicado: {desconto.codigo}
            </span>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 ml-6">
            {desconto.descricao}
          </p>
          <div className="ml-6 space-y-0.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Valor original:</span>
              <span className="line-through">{formatCurrency(precoOriginalCentavos / 100)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-emerald-700 dark:text-emerald-300">Total com desconto:</span>
              <span className="text-emerald-700 dark:text-emerald-300">
                {formatCurrency(precoFinalCentavos / 100)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
              <span>Você economiza:</span>
              <span className="font-medium">{formatCurrency(economiaReais)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
