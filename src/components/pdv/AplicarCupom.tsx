import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Ticket, X, Check, Loader2 } from "lucide-react";
import { useCupons } from "@/hooks/useCupons";
import { Cupom } from "@/types/cupom";

interface AplicarCupomProps {
  valorCompra: number;
  onCupomAplicado: (cupom: Cupom, valorDesconto: number) => void;
  onCupomRemovido: () => void;
  cupomAplicado?: {
    cupom: Cupom;
    valorDesconto: number;
  };
}

export const AplicarCupom = ({
  valorCompra,
  onCupomAplicado,
  onCupomRemovido,
  cupomAplicado,
}: AplicarCupomProps) => {
  const [codigo, setCodigo] = useState("");
  const [validando, setValidando] = useState(false);
  const { validarCupom } = useCupons();

  const handleAplicarCupom = async () => {
    if (!codigo.trim()) return;

    setValidando(true);
    const resultado = await validarCupom(codigo, valorCompra);
    setValidando(false);

    if (resultado.valido && resultado.cupom && resultado.valorDesconto) {
      onCupomAplicado(resultado.cupom, resultado.valorDesconto);
      setCodigo("");
    }
  };

  const handleRemoverCupom = () => {
    onCupomRemovido();
  };

  if (cupomAplicado) {
    return (
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-900 dark:text-green-100">
              Cupom Aplicado
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemoverCupom}
            className="h-6 w-6 text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Código:</span>
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
              {cupomAplicado.cupom.codigo}
            </Badge>
          </div>
          
          {cupomAplicado.cupom.descricao && (
            <p className="text-xs text-muted-foreground">
              {cupomAplicado.cupom.descricao}
            </p>
          )}
          
          <div className="flex items-center justify-between text-sm pt-1 border-t border-green-200 dark:border-green-800">
            <span className="text-muted-foreground">Desconto:</span>
            <span className="font-semibold text-green-700 dark:text-green-400">
              - R$ {cupomAplicado.valorDesconto.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="cupom" className="text-sm flex items-center gap-2">
        <Ticket className="h-4 w-4" />
        Cupom de Desconto
      </Label>
      
      <div className="flex gap-2">
        <Input
          id="cupom"
          placeholder="Digite o código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleAplicarCupom()}
          className="uppercase"
          disabled={validando}
        />
        <Button
          onClick={handleAplicarCupom}
          disabled={!codigo.trim() || validando}
          size="sm"
        >
          {validando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Aplique um cupom para obter desconto adicional
      </p>
    </div>
  );
};
