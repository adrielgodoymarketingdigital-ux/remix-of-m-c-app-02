import { Info, Settings, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CabecalhoFidelidadeDesktopProps {
  /** Abre o mesmo diálogo de Configurações do layout do celular. */
  onAbrirConfiguracoes: () => void;
}

/**
 * Cabeçalho e aviso do programa de Fidelidade, só no layout do computador.
 * Os textos são os mesmos do celular; no aviso, o ícone ⓘ substitui o emoji 💡.
 */
export function CabecalhoFidelidadeDesktop({ onAbrirConfiguracoes }: CabecalhoFidelidadeDesktopProps) {
  return (
    <div className="space-y-5">
      {/* pt-6: o olho flutuante do layout (BotaoOcultarValores, fixed top-4 right-4)
          ficaria por cima de "Configurações". */}
      <div className="flex items-center justify-between gap-4 pt-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20">
            <Trophy className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[28px] font-bold leading-9 tracking-tight">Fidelidade de Clientes</h1>
            <p className="text-sm leading-5 text-muted-foreground">Gerencie pontos e recompensas</p>
          </div>
        </div>
        <Button variant="outline" onClick={onAbrirConfiguracoes} className="h-11 shrink-0 rounded-xl px-5 shadow-sm">
          <Settings className="w-4 h-4 mr-2" />
          Configurações
        </Button>
      </div>

      <div className="flex items-start gap-4 rounded-2xl border border-blue-500/25 bg-blue-500/[0.06] px-5 py-4">
        <Info className="mt-0.5 h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <p className="min-w-0 text-sm leading-6 text-muted-foreground">
          <span className="block font-medium text-foreground">
            O programa já vem configurado com um modelo de pontuação padrão.
          </span>
          <span className="block">
            Clique em <strong className="text-foreground">Configurações</strong> para personalizar pontos,
            níveis e tipo de resgate conforme sua loja.
          </span>
        </p>
      </div>
    </div>
  );
}
