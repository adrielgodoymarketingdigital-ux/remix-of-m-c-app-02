import { Info } from "lucide-react";

interface DicaBoxProps {
  texto: string;
}

/** Bloco de dica azul claro exibido ao final de cada etapa do wizard. */
export function DicaBox({ texto }: DicaBoxProps) {
  return (
    <div className="mt-3 flex gap-2 rounded-xl bg-primary/5 border border-primary/10 p-2.5">
      <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold text-foreground">Dica</p>
        <p className="text-xs text-muted-foreground leading-tight">{texto}</p>
      </div>
    </div>
  );
}
