import { LucideIcon } from "lucide-react";

interface EtapaCabecalhoProps {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
}

/** Cabeçalho padrão de cada etapa do wizard: ícone circular + título + descrição + separador. */
export function EtapaCabecalho({ icone: Icone, titulo, descricao }: EtapaCabecalhoProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icone className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">{titulo}</h3>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
      </div>
      <div className="border-b border-border/60 mt-3" />
    </div>
  );
}
