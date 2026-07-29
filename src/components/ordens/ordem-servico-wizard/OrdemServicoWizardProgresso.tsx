import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EtapaWizard } from "./tipos";

const TOTAL_ETAPAS = 7;

const NOMES_ETAPAS: Record<EtapaWizard, string> = {
  1: "Origem",
  2: "Cliente",
  3: "Dispositivo",
  4: "Serviço",
  5: "Checklist",
  6: "Itens",
  7: "Resumo",
};

interface OrdemServicoWizardProgressoProps {
  etapaAtual: EtapaWizard;
  etapaMaximaAlcancada: EtapaWizard;
  onEtapaClick: (etapa: EtapaWizard) => void;
  etapasComPendencia?: EtapaWizard[];
}

export function OrdemServicoWizardProgresso({
  etapaAtual,
  etapaMaximaAlcancada,
  onEtapaClick,
  etapasComPendencia = [],
}: OrdemServicoWizardProgressoProps) {
  const percent = Math.round(((etapaAtual - 1) / (TOTAL_ETAPAS - 1)) * 100);

  return (
    <div>
      {/* Mobile/PWA: barra compacta com nome da etapa atual */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-foreground">
            <span className="font-bold text-primary">Passo {etapaAtual}</span> de {TOTAL_ETAPAS} — {NOMES_ETAPAS[etapaAtual]}
          </span>
          <span className="text-foreground font-medium">{percent}%</span>
        </div>
        <div className="flex items-center">
          {(Array.from({ length: TOTAL_ETAPAS }, (_, i) => (i + 1) as EtapaWizard)).map((etapa, index) => {
            const alcancada = etapa <= etapaMaximaAlcancada;
            const concluida = etapa < etapaAtual;
            const atual = etapa === etapaAtual;
            const tracoPreenchido = etapa < etapaAtual;

            return (
              <div key={etapa} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  disabled={!alcancada}
                  onClick={() => onEtapaClick(etapa)}
                  title={NOMES_ETAPAS[etapa]}
                  className={cn(
                    "rounded-full shrink-0 transition-all flex items-center justify-center",
                    atual ? "h-4 w-4 border-2 border-primary bg-background" : "h-2 w-2",
                    !atual && (concluida || alcancada) && "bg-primary",
                    !atual && !alcancada && "bg-muted cursor-not-allowed",
                    alcancada && !atual && "cursor-pointer",
                  )}
                >
                  {atual && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </button>
                {index < TOTAL_ETAPAS - 1 && (
                  <div className={cn("h-0.5 flex-1 mx-1", tracoPreenchido ? "bg-primary" : "bg-muted")} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop: círculos numerados com nome de cada etapa abaixo — navegação livre, clique direto em qualquer etapa */}
      <div className="hidden sm:flex items-center gap-4">
        <div className="flex items-center flex-1">
          {(Array.from({ length: TOTAL_ETAPAS }, (_, i) => (i + 1) as EtapaWizard)).map((etapa, index) => {
            const concluida = etapa < etapaAtual;
            const atual = etapa === etapaAtual;
            const tracoPreenchido = etapa < etapaAtual;
            const pendente = etapasComPendencia.includes(etapa) && etapa !== etapaAtual;

            return (
              <div key={etapa} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => onEtapaClick(etapa)}
                  title={pendente ? `${NOMES_ETAPAS[etapa]} — há campos obrigatórios pendentes` : NOMES_ETAPAS[etapa]}
                  className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
                >
                  <span
                    className={cn(
                      "h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold transition-all group-hover:border-primary/60",
                      atual && "border-2 border-primary bg-primary text-primary-foreground",
                      !atual && pendente && "border border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                      !atual && !pendente && concluida && "bg-primary text-primary-foreground",
                      !atual && !pendente && !concluida && "border border-input bg-background text-foreground",
                    )}
                  >
                    {pendente && !atual ? (
                      <AlertCircle className="h-3.5 w-3.5" />
                    ) : concluida ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      etapa
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] whitespace-nowrap",
                      atual ? "font-semibold text-primary" : pendente ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                    )}
                  >
                    {NOMES_ETAPAS[etapa]}
                  </span>
                </button>
                {index < TOTAL_ETAPAS - 1 && (
                  <div className={cn("h-0.5 flex-1 mx-1.5 mb-4", tracoPreenchido ? "bg-primary" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>

        <div className="text-right shrink-0 mb-4">
          <span className="text-xs text-foreground font-medium">{percent}% concluído</span>
        </div>
      </div>
    </div>
  );
}
