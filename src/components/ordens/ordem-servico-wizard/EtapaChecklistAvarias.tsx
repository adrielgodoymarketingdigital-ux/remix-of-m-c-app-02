import { ListChecks } from "lucide-react";
import { ChecklistDispositivo } from "../ChecklistDispositivo";
import { MarcacaoAvarias } from "../MarcacaoAvarias";
import { EtapaCabecalho } from "./EtapaCabecalho";
import { FormData } from "./tipos";

interface EtapaChecklistAvariasProps {
  formData: FormData;
  setFormData: (formData: FormData) => void;
}

export function EtapaChecklistAvarias({ formData, setFormData }: EtapaChecklistAvariasProps) {
  return (
    <div>
      <EtapaCabecalho
        icone={ListChecks}
        titulo="Checklist e Avarias"
        descricao="Registre as condições de entrada e saída do aparelho."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Checklist de Entrada e Saída</h4>
          <ChecklistDispositivo
            tipoDispositivo={formData.dispositivoTipo}
            sistema={formData.dispositivoSistema}
            fabricante={formData.dispositivoFabricante}
            subtipo={formData.dispositivoSubtipo}
            value={formData.checklist}
            onChange={(checklist) => setFormData({ ...formData, checklist })}
            onSistemaChange={(sistema) => setFormData({ ...formData, dispositivoSistema: sistema })}
            onFabricanteChange={(fabricante) => setFormData({ ...formData, dispositivoFabricante: fabricante })}
            onSubtipoChange={(subtipo) => setFormData({ ...formData, dispositivoSubtipo: subtipo })}
          />
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Marcação de Avarias</h4>
          <MarcacaoAvarias
            tipoDispositivo={formData.dispositivoTipo}
            value={formData.avarias}
            onChange={(avarias) => setFormData({ ...formData, avarias })}
            subtipoRelogio={formData.dispositivoSubtipo}
          />
        </div>
      </div>
    </div>
  );
}
