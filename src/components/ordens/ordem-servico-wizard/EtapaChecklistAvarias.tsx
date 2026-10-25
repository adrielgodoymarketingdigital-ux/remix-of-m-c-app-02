import { ListChecks } from "lucide-react";
import { ChecklistDispositivo } from "../ChecklistDispositivo";
import { MarcacaoAvarias } from "../MarcacaoAvarias";
import { EtapaCabecalho } from "./EtapaCabecalho";
import { AparelhosNasEtapas, AvisoAparelhosNasEtapas, BlocoDispositivoEtapa, BlocoDispositivoRecolhivel } from "./BlocoDispositivoEtapa";
import { FormData } from "./tipos";
import {
  exibicaoAparelhosNasEtapas,
  prefixoIdAparelho,
  tituloBlocoDispositivo,
} from "@/lib/ordemServico/formularioDispositivosAdicionaisOS";
import { numeroAdicional } from "@/lib/ordemServico/dispositivosAdicionaisOS";

interface EtapaChecklistAvariasProps {
  formData: FormData;
  setFormData: (formData: FormData) => void;
  /** Só para quem vê os adicionais; undefined = etapa como sempre foi. */
  dispositivosAdicionais?: AparelhosNasEtapas;
}

export function EtapaChecklistAvarias({ formData, setFormData, dispositivosAdicionais }: EtapaChecklistAvariasProps) {
  const exibicaoAdicionais = exibicaoAparelhosNasEtapas(dispositivosAdicionais?.estado);

  const camposDispositivo1 = (
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
  );

  return (
    <div>
      <EtapaCabecalho
        icone={ListChecks}
        titulo="Checklist e Avarias"
        descricao="Registre as condições de entrada e saída do aparelho."
      />

      {exibicaoAdicionais === "blocos" && dispositivosAdicionais ? (
        <div className="space-y-4">
          <BlocoDispositivoEtapa
            titulo={tituloBlocoDispositivo(1, {
              dispositivo_tipo: formData.dispositivoTipo,
              dispositivo_marca: formData.dispositivoMarca,
              dispositivo_modelo: formData.dispositivoModelo,
            })}
          >
            {camposDispositivo1}
          </BlocoDispositivoEtapa>
          {dispositivosAdicionais.estado.dispositivos.map((d, i) => {
            const alterar = dispositivosAdicionais.onAlterar;
            return (
              <BlocoDispositivoRecolhivel
                key={d.id}
                titulo={tituloBlocoDispositivo(numeroAdicional(i), d)}
                bloqueado={dispositivosAdicionais.bloqueada}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Checklist de Entrada e Saída</h4>
                    <ChecklistDispositivo
                      idPrefixo={prefixoIdAparelho(d.id)}
                      tipoDispositivo={d.dispositivo_tipo}
                      sistema={d.dispositivo_sistema}
                      fabricante={d.dispositivo_fabricante}
                      subtipo={d.dispositivo_subtipo}
                      value={d.checklist}
                      onChange={(checklist) => alterar(d.id, { checklist })}
                      onSistemaChange={(sistema) => alterar(d.id, { dispositivo_sistema: sistema })}
                      onFabricanteChange={(fabricante) => alterar(d.id, { dispositivo_fabricante: fabricante })}
                      onSubtipoChange={(subtipo) => alterar(d.id, { dispositivo_subtipo: subtipo })}
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Marcação de Avarias</h4>
                    <MarcacaoAvarias
                      tipoDispositivo={d.dispositivo_tipo}
                      value={d.avarias_visuais}
                      onChange={(avarias) => alterar(d.id, { avarias_visuais: avarias })}
                      subtipoRelogio={d.dispositivo_subtipo}
                    />
                  </div>
                </div>
              </BlocoDispositivoRecolhivel>
            );
          })}
        </div>
      ) : (
        camposDispositivo1
      )}

      {dispositivosAdicionais && exibicaoAdicionais !== "blocos" && exibicaoAdicionais !== "nenhuma" && (
        <div className="mt-4">
          <AvisoAparelhosNasEtapas
            exibicao={exibicaoAdicionais}
            onTentarCarregarDeNovo={dispositivosAdicionais.onTentarCarregarDeNovo}
          />
        </div>
      )}
    </div>
  );
}
