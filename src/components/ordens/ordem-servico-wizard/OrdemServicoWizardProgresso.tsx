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
}

export function OrdemServicoWizardProgresso({
  etapaAtual,
  etapaMaximaAlcancada,
  onEtapaClick,
}: OrdemServicoWizardProgressoProps) {
  const percent = Math.round(((etapaAtual - 1) / (TOTAL_ETAPAS - 1)) * 100);

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
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
                  atual ? "h-5 w-5 border-2 border-primary bg-background" : "h-2.5 w-2.5",
                  !atual && (concluida || alcancada) && "bg-primary",
                  !atual && !alcancada && "bg-muted cursor-not-allowed",
                  alcancada && !atual && "cursor-pointer",
                )}
              >
                {atual && <span className="h-2 w-2 rounded-full bg-primary" />}
              </button>
              {index < TOTAL_ETAPAS - 1 && (
                <div className={cn("h-0.5 flex-1 mx-1", tracoPreenchido ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
