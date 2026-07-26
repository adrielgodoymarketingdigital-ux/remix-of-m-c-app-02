import { LucideIcon } from "lucide-react";

interface EtapaCabecalhoProps {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
}

/** Cabeçalho padrão de cada etapa do wizard: ícone circular + título + descrição + separador. */
export function EtapaCabecalho({ icone: Icone, titulo, descricao }: EtapaCabecalhoProps) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icone className="h-3 w-3 text-primary" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-foreground">{titulo}</h3>
          <p className="text-[11px] text-muted-foreground leading-tight">{descricao}</p>
        </div>
      </div>
      <div className="border-b border-border/60 mt-2" />
    </div>
  );
}
