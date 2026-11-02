import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useFormatadores } from "@/hooks/useFormatadores";
import { cn } from "@/lib/utils";

interface SeloVariacaoProps {
  valor: number;
  /** "solido": sobre o gradiente do hero. "suave": sobre os cards claros/escuros de Hoje. */
  variante: "solido" | "suave";
  className?: string;
}

const CORES: Record<SeloVariacaoProps["variante"], Record<"alta" | "queda" | "neutra", string>> = {
  solido: {
    alta: "bg-emerald-700 text-white",
    queda: "bg-red-700 text-white",
    neutra: "bg-black/30 text-white",
  },
  suave: {
    alta: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    queda: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
    neutra: "bg-muted text-muted-foreground",
  },
};

/** Variação % com os três sentidos: alta, queda e sem mudança. */
export function SeloVariacao({ valor, variante, className }: SeloVariacaoProps) {
  const { numero } = useFormatadores();
  const sentido = valor > 0 ? "alta" : valor < 0 ? "queda" : "neutra";
  const Icone = sentido === "alta" ? ArrowUpRight : sentido === "queda" ? ArrowDownRight : Minus;
  const sinal = sentido === "alta" ? "+" : sentido === "queda" ? "−" : "";

  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold", CORES[variante][sentido], className)}>
      <Icone className="h-3.5 w-3.5 shrink-0" />
      {sinal}{numero(Math.abs(valor), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
    </span>
  );
}
