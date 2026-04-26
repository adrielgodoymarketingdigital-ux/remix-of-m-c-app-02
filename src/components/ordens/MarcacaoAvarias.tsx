import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";
import { AvariaVisual } from "@/types/ordem-servico";
import { SilhuetaCelular } from "./silhuetas/SilhuetaCelular";
import { SilhuetaTablet } from "./silhuetas/SilhuetaTablet";
import { SilhuetaNotebook } from "./silhuetas/SilhuetaNotebook";
import { SilhuetaComputador } from "./silhuetas/SilhuetaComputador";
import { SilhuetaRelogioSmart } from "./silhuetas/SilhuetaRelogioSmart";

export interface MarcacaoAvariasProps {
  tipoDispositivo: string;
  value: AvariaVisual[];
  onChange: (avarias: AvariaVisual[]) => void;
  subtipoRelogio?: string;
}

const tipoAvariaCores: Record<string, string> = {
  riscos: 'bg-red-500',
  trinca: 'bg-orange-500',
  amassado: 'bg-yellow-500',
  quebrado: 'bg-purple-500',
  outro: 'bg-blue-500'
};

const tipoAvariaLabels: Record<string, string> = {
  riscos: '🔴 Riscos',
  trinca: '🟠 Trinca',
  amassado: '🟡 Amassado',
  quebrado: '🟣 Quebrado',
  outro: '🔵 Outro'
};

export const MarcacaoAvarias = ({ 
  tipoDispositivo, 
  value, 
  onChange,
  subtipoRelogio 
}: MarcacaoAvariasProps) => {
  const [lado, setLado] = useState<'frente' | 'traseira'>('frente');
  const [tipoSelecionado, setTipoSelecionado] = useState<AvariaVisual['tipo']>('riscos');

  const normalizarTipo = (tipo: string): string => {
    return tipo.toLowerCase().replace(/ /g, '_');
  };

  const renderSilhueta = () => {
    const tipoNormalizado = normalizarTipo(tipoDispositivo);
    
    if (tipoNormalizado === 'celular') {
      return <SilhuetaCelular lado={lado} />;
    } else if (tipoNormalizado === 'tablet') {
      return <SilhuetaTablet lado={lado} />;
    } else if (tipoNormalizado === 'notebook') {
      return <SilhuetaNotebook />;
    } else if (tipoNormalizado === 'computador') {
      return <SilhuetaComputador />;
    } else if (tipoNormalizado === 'relogio_smart') {
      return <SilhuetaRelogioSmart lado={lado} subtipo={subtipoRelogio} />;
    }
    
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg border-2 border-dashed border-border">
        <p className="text-muted-foreground text-sm">Selecione um dispositivo</p>
      </div>
    );
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const novaAvaria: AvariaVisual = {
      x,
      y,
      tipo: tipoSelecionado,
      lado
    };

    onChange([...value, novaAvaria]);
  };

  const removerAvaria = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const avariasLado = value.filter(a => a.lado === lado);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label className="text-xs font-medium mb-1 block">Lado</label>
          <Select value={lado} onValueChange={(v) => setLado(v as 'frente' | 'traseira')}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="frente">Frente</SelectItem>
              <SelectItem value="traseira">Traseira</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="text-xs font-medium mb-1 block">Tipo de Avaria</label>
          <Select value={tipoSelecionado} onValueChange={(v) => setTipoSelecionado(v as AvariaVisual['tipo'])}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="riscos">🔴 Riscos</SelectItem>
              <SelectItem value="trinca">🟠 Trinca</SelectItem>
              <SelectItem value="amassado">🟡 Amassado</SelectItem>
              <SelectItem value="quebrado">🟣 Quebrado</SelectItem>
              <SelectItem value="outro">🔵 Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-2">
        <div 
          className="relative w-full aspect-[9/16] max-w-[200px] sm:max-w-xs mx-auto bg-muted rounded-lg cursor-crosshair overflow-hidden border-2 border-border"
          onClick={handleClick}
        >
          <div className="absolute inset-0">
            {renderSilhueta()}
          </div>

          {/* Marcações */}
          {avariasLado.map((avaria, index) => (
            <div
              key={index}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
              style={{ left: `${avaria.x}%`, top: `${avaria.y}%` }}
            >
              <div className={`w-8 h-8 sm:w-6 sm:h-6 rounded-full ${tipoAvariaCores[avaria.tipo]} opacity-80 flex items-center justify-center`}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removerAvaria(value.indexOf(avaria));
                  }}
                  className="w-5 h-5 sm:w-4 sm:h-4 bg-white rounded-full flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-red-500" />
                </button>
              </div>
              <div className="absolute top-10 sm:top-8 left-1/2 transform -translate-x-1/2 bg-popover text-popover-foreground px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10">
                {tipoAvariaLabels[avaria.tipo]}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Legenda compacta */}
      <div className="space-y-1">
        <p className="text-xs font-medium">Legenda:</p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(tipoAvariaLabels).map(([tipo, label]) => (
            <Badge key={tipo} variant="outline" className="text-xs py-0 h-5">
              {label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};
