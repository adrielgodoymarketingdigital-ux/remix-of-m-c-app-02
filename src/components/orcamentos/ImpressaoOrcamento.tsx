import { Orcamento } from "@/types/orcamento";
import { ConfiguracaoLoja, LayoutOrcamentoConfig } from "@/types/configuracao-loja";
import { ImpressaoOrcamentoA4 } from "./ImpressaoOrcamentoA4";
import { ImpressaoOrcamentoCupom80mm } from "./ImpressaoOrcamentoCupom80mm";

const LAYOUT_PADRAO: LayoutOrcamentoConfig = {
  formato_papel: "a4",
  tamanho_fonte: "normal",
  mostrar_logo: true,
  mostrar_dados_loja: true,
  mostrar_dados_cliente: true,
  mostrar_dados_dispositivo: true,
  mostrar_itens: true,
  mostrar_subtotal: true,
  mostrar_desconto: true,
  mostrar_total: true,
  mostrar_validade: true,
  mostrar_observacoes: true,
  mostrar_termos: true,
  mostrar_assinaturas: true,
};

interface ImpressaoOrcamentoProps {
  orcamento: Orcamento;
  configuracaoLoja?: ConfiguracaoLoja;
  onFecharImpressao: () => void;
}

export function ImpressaoOrcamento({
  orcamento,
  configuracaoLoja,
  onFecharImpressao,
}: ImpressaoOrcamentoProps) {
  const layoutConfig: LayoutOrcamentoConfig = {
    ...LAYOUT_PADRAO,
    ...configuracaoLoja?.layout_orcamento_config,
  };

  const is80mm = layoutConfig.formato_papel === "80mm";

  if (is80mm) {
    return (
      <ImpressaoOrcamentoCupom80mm
        orcamento={orcamento}
        configuracaoLoja={configuracaoLoja}
        layoutConfig={layoutConfig}
        onFecharImpressao={onFecharImpressao}
      />
    );
  }

  return (
    <ImpressaoOrcamentoA4
      orcamento={orcamento}
      configuracaoLoja={configuracaoLoja}
      layoutConfig={layoutConfig}
      onFecharImpressao={onFecharImpressao}
    />
  );
}
