import { Info } from "lucide-react";

interface DicaBoxProps {
  texto: string;
}

/** Bloco de dica azul claro exibido ao final de cada etapa do wizard. */
export function DicaBox({ texto }: DicaBoxProps) {
  return (
    <div className="mt-2 flex gap-2 rounded-lg bg-primary/5 border border-primary/10 p-2">
      <Info className="h-3 w-3 text-primary shrink-0 mt-0.5" />
      <div>
        <p className="text-[11px] font-semibold text-foreground">Dica</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{texto}</p>
      </div>
    </div>
  );
}
