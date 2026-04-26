import { AvariaVisual } from "@/types/ordem-servico";
import { SilhuetaCelular } from "./silhuetas/SilhuetaCelular";
import { SilhuetaNotebook } from "./silhuetas/SilhuetaNotebook";
import { SilhuetaTablet } from "./silhuetas/SilhuetaTablet";
import { SilhuetaComputador } from "./silhuetas/SilhuetaComputador";
import { SilhuetaRelogioSmart } from "./silhuetas/SilhuetaRelogioSmart";

interface SilhuetaComAvariasProps {
  tipoDispositivo: string;
  subtipoRelogio?: string;
  lado: 'frente' | 'traseira';
  avarias: AvariaVisual[];
  printMode?: boolean;
}

const tipoAvariaCores: Record<string, string> = {
  riscos: "bg-red-500",
  trinca: "bg-orange-500",
  amassado: "bg-yellow-500",
  quebrado: "bg-purple-500",
  outro: "bg-blue-500",
};

const tipoAvariaLabels: Record<string, string> = {
  riscos: "Riscos",
  trinca: "Trinca",
  amassado: "Amassado",
  quebrado: "Quebrado",
  outro: "Outro",
};

export const SilhuetaComAvarias = ({
  tipoDispositivo,
  subtipoRelogio,
  lado,
  avarias,
  printMode = false
}: SilhuetaComAvariasProps) => {
  const renderSilhueta = () => {
    switch (tipoDispositivo?.toLowerCase()) {
      case "celular":
      case "smartphone":
        return <SilhuetaCelular lado={lado} />;
      case "notebook":
        return <SilhuetaNotebook />;
      case "tablet":
        return <SilhuetaTablet lado={lado} />;
      case "computador":
      case "desktop":
        return <SilhuetaComputador />;
      case "relogio":
      case "smartwatch":
        return <SilhuetaRelogioSmart lado={lado} subtipo={subtipoRelogio} />;
      default:
        return <SilhuetaCelular lado={lado} />;
    }
  };

  return (
    <div className={printMode ? "space-y-0.5" : "space-y-4"}>
      {!printMode && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold capitalize">
            {lado === "frente" ? "Frente" : "Traseira"}
          </h4>
          {avarias.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {avarias.length} {avarias.length === 1 ? "avaria" : "avarias"}
            </span>
          )}
        </div>
      )}
      
      <div className={`relative border rounded-lg bg-muted/20 ${printMode ? 'p-2' : 'p-4'}`}>
        <div className={printMode ? 'scale-[0.85] origin-top-left' : ''}>
          {renderSilhueta()}
        </div>
        
        {/* Marcações de avarias */}
        {avarias.map((avaria, index) => (
          <div
            key={index}
            className={`absolute ${printMode ? 'w-2.5 h-2.5' : 'w-4 h-4'} rounded-full ${tipoAvariaCores[avaria.tipo]} opacity-80 border-2 border-white cursor-help flex items-center justify-center`}
            style={{
              left: printMode ? `${avaria.x * 0.85}%` : `${avaria.x}%`,
              top: printMode ? `${avaria.y * 0.85}%` : `${avaria.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
            title={`${tipoAvariaLabels[avaria.tipo]}${avaria.descricao ? `: ${avaria.descricao}` : ''}`}
          >
            {printMode && (
              <span className="text-[6px] font-bold text-white leading-none">
                {index + 1}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legenda */}
      {avarias.length > 0 && (
        <div className={`flex flex-wrap ${printMode ? 'gap-0.5 text-[6px] mt-0.5' : 'gap-2 text-xs'}`}>
          {avarias.map((avaria, index) => (
            <div key={index} className="flex items-center gap-0.5">
              {printMode && (
                <span className="font-bold">{index + 1}.</span>
              )}
              <div className={`${printMode ? 'w-1.5 h-1.5' : 'w-3 h-3'} rounded-full ${tipoAvariaCores[avaria.tipo]}`} />
              <span>{tipoAvariaLabels[avaria.tipo]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
