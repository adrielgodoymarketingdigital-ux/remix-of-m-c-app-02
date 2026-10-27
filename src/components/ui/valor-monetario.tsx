import { createContext, useContext } from "react";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";
import { formatCurrency } from "@/lib/formatters";

/**
 * Como formatar o valor. Padrão: formatCurrency (o de sempre). A tela já
 * traduzida (i18n) envolve o conteúdo com <FormatoMoedaProvider
 * value={useFormatadores().moeda}> e os ValorMonetario dela passam a sair na
 * moeda da conta; as outras telas não mudam.
 */
const FormatoMoedaContext = createContext<(valor: number | null | undefined) => string>(formatCurrency);
export const FormatoMoedaProvider = FormatoMoedaContext.Provider;

interface ValorMonetarioProps {
  valor: number | null | undefined;
  className?: string;
  /** "preco" = nunca oculta. Sem prop ou "custo"/"lucro" = oculta quando ativado */
  tipo?: "preco" | "custo" | "lucro";
}

export function ValorMonetario({ valor, className, tipo }: ValorMonetarioProps) {
  const { valoresOcultos } = useOcultarValores();
  const formatar = useContext(FormatoMoedaContext);

  if (valoresOcultos && tipo !== "preco") {
    return <span className={className}>•••••</span>;
  }

  return <span className={className}>{formatar(valor)}</span>;
}
