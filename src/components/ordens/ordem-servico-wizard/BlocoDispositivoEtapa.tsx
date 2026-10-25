import type { ReactNode } from "react";
import { AlertTriangle, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CamposAparelhoNasEtapas,
  EstadoAdicionaisForm,
  ExibicaoAparelhosNasEtapas,
} from "@/lib/ordemServico/formularioDispositivosAdicionaisOS";

/**
 * O que as etapas 4 e 5 recebem para mostrar um bloco por aparelho (etapa 6
 * da OS com vários dispositivos). Só existe para quem vê os adicionais
 * (useDispositivosAdicionaisOSVisivel); para os demais a prop é undefined e a
 * etapa fica exatamente como sempre foi.
 */
export interface AparelhosNasEtapas {
  /** O MESMO estadoAdicionais do diálogo do aparelho. */
  estado: EstadoAdicionaisForm;
  /** OS salva e adicionais pendentes de gravar: blocos só para leitura. */
  bloqueada: boolean;
  onAlterar: (id: string, parcial: CamposAparelhoNasEtapas) => void;
  onTentarCarregarDeNovo: () => void;
}

interface BlocoDispositivoEtapaProps {
  titulo: string;
  children: ReactNode;
  /** Campos visíveis, mas sem edição. */
  bloqueado?: boolean;
}

/** Cartão "Dispositivo N — marca modelo" com os campos daquele aparelho. */
export function BlocoDispositivoEtapa({ titulo, children, bloqueado = false }: BlocoDispositivoEtapaProps) {
  return (
    <div className="rounded-xl border p-3 sm:p-4" data-bloco-dispositivo-etapa>
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-3 min-w-0">
        <Smartphone className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{titulo}</span>
      </h4>
      <fieldset disabled={bloqueado} className={cn("space-y-5 min-w-0", bloqueado && "pointer-events-none opacity-70")}>
        {children}
      </fieldset>
    </div>
  );
}

/** Aviso no lugar dos blocos enquanto os outros aparelhos carregam ou se a leitura falhou. */
export function AvisoAparelhosNasEtapas({
  exibicao,
  onTentarCarregarDeNovo,
}: {
  exibicao: ExibicaoAparelhosNasEtapas;
  onTentarCarregarDeNovo: () => void;
}) {
  if (exibicao === "carregando") {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground" data-aviso-aparelhos-etapa="carregando">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando outros aparelhos...
      </p>
    );
  }
  if (exibicao !== "erro") return null;
  return (
    <div
      className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      data-aviso-aparelhos-etapa="erro"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Não foi possível carregar os outros aparelhos desta OS.
      </span>
      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onTentarCarregarDeNovo}>
        Tentar de novo
      </Button>
    </div>
  );
}
