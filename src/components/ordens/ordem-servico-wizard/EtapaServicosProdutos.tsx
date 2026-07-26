import { Wrench } from "lucide-react";
import { SelecionadorServico } from "../SelecionadorServico";
import { SelecionadorProduto } from "../SelecionadorProduto";
import { EtapaCabecalho } from "./EtapaCabecalho";
import { FormData } from "./tipos";

interface EtapaServicosProdutosProps {
  formData: FormData;
  setFormData: (formData: FormData) => void;
}

export function EtapaServicosProdutos({ formData, setFormData }: EtapaServicosProdutosProps) {
  return (
    <div>
      <EtapaCabecalho
        icone={Wrench}
        titulo="Serviços, Produtos e Peças"
        descricao="Selecione o que será utilizado neste atendimento."
      />

      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Serviços</h4>
          <SelecionadorServico
            value={formData.servicos}
            onChange={(servicos) => setFormData({ ...formData, servicos })}
          />
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Produtos e Peças</h4>
          <SelecionadorProduto
            value={formData.produtos}
            onChange={(produtos) => setFormData({ ...formData, produtos })}
          />
        </div>
      </div>
    </div>
  );
}
