import { Info } from "lucide-react";

interface DicaBoxProps {
  texto: string;
}

/** Bloco de dica azul claro exibido ao final de cada etapa do wizard. */
export function DicaBox({ texto }: DicaBoxProps) {
  return (
    <div className="mt-4 flex gap-3 rounded-xl bg-primary/5 border border-primary/10 p-4">
      <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-foreground">Dica</p>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
    </div>
  );
}
