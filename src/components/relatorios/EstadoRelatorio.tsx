import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";

interface EstadoRelatorioProps {
  /** "carregando" mostra o giro; "vazio" mostra o ícone da aba. */
  tipo: "carregando" | "vazio";
  texto: string;
  icon?: LucideIcon;
}

/** Estado de carregando / vazio das tabelas de Relatórios, só no layout do computador. Os textos vêm de quem chama. */
export function EstadoRelatorio({ tipo, texto, icon: Icon }: EstadoRelatorioProps) {
  if (tipo === "carregando") {
    return (
      <div role="status" className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        {texto}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
      {Icon && (
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
          <Icon className="h-5 w-5" />
        </div>
      )}
      {texto}
    </div>
  );
}
