import { ReactNode, useEffect, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export const AVISO_RESPONSABILIDADE_FISCAL = "Os dados fiscais são de responsabilidade do lojista e do contador dele.";

interface SecaoDadosFiscaisProps {
  /** Algum campo já preenchido: a seção abre sozinha e mostra o selo. */
  preenchido: boolean;
  children: ReactNode;
}

/** Bloco colapsável "Dados fiscais" dos cadastros (só renderizado quando useFiscalVisivel). */
export function SecaoDadosFiscais({ preenchido, children }: SecaoDadosFiscaisProps) {
  const [aberto, setAberto] = useState(preenchido);

  // Ao abrir outro item para editar, abre se ele já tem dados fiscais.
  useEffect(() => {
    if (preenchido) setAberto(true);
  }, [preenchido]);

  return (
    <Collapsible open={aberto} onOpenChange={setAberto}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between h-11" data-testid="secao-dados-fiscais">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Dados fiscais</span>
            {preenchido && <Badge variant="secondary" className="text-xs">Preenchido</Badge>}
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            Opcional. {AVISO_RESPONSABILIDADE_FISCAL}
          </p>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Aviso de validação leve: avisa, mas não impede salvar. */
export function AvisoCampoFiscal({ texto }: { texto?: string }) {
  if (!texto) return null;
  return <p className="text-xs text-amber-700 dark:text-amber-400">{texto}</p>;
}
