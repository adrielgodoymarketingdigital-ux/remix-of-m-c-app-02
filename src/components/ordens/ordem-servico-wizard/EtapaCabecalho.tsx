import { LucideIcon } from "lucide-react";

interface EtapaCabecalhoProps {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
}

/** Cabeçalho padrão de cada etapa do wizard: ícone circular + título + descrição + separador. */
export function EtapaCabecalho({ icone: Icone, titulo, descricao }: EtapaCabecalhoProps) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icone className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">{titulo}</h3>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>
      <div className="border-b border-border/60 mt-2.5" />
    </div>
  );
}
