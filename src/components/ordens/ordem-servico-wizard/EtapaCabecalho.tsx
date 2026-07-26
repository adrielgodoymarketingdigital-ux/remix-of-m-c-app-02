import { LucideIcon } from "lucide-react";

interface EtapaCabecalhoProps {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
}

/** Cabeçalho padrão de cada etapa do wizard: ícone circular + título + descrição + separador. */
export function EtapaCabecalho({ icone: Icone, titulo, descricao }: EtapaCabecalhoProps) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">{titulo}</h3>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
      </div>
      <div className="border-b border-border/60 mt-4" />
    </div>
  );
}
