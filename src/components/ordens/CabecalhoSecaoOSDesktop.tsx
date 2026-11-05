import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface CabecalhoSecaoOSDesktopProps {
  icone: LucideIcon;
  titulo: string;
  subtitulo: string;
  children: ReactNode;
}

/** Cabeçalho dos blocos da tela de OS no computador. Sem espaço, `children` desce para a linha de baixo. */
export function CabecalhoSecaoOSDesktop({ icone: Icone, titulo, subtitulo, children }: CabecalhoSecaoOSDesktopProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-[17px]">
      <div className="flex min-w-0 items-center gap-4">
        <Icone className="h-[25px] w-[25px] shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 className="text-[19px] font-bold leading-tight tracking-tight text-foreground">{titulo}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{subtitulo}</p>
        </div>
      </div>
      <div className="ml-auto">{children}</div>
    </div>
  );
}
