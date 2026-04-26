import { useOcultarValores } from "@/contexts/OcultarValoresContext";
import { formatCurrency } from "@/lib/formatters";

interface ValorMonetarioProps {
  valor: number | null | undefined;
  className?: string;
  /** "preco" = nunca oculta. Sem prop ou "custo"/"lucro" = oculta quando ativado */
  tipo?: "preco" | "custo" | "lucro";
}

export function ValorMonetario({ valor, className, tipo }: ValorMonetarioProps) {
  const { valoresOcultos } = useOcultarValores();

  if (valoresOcultos && tipo !== "preco") {
    return <span className={className}>•••••</span>;
  }

  return <span className={className}>{formatCurrency(valor)}</span>;
}
