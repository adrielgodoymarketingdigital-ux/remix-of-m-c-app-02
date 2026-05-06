import { LayoutOSConfig } from "@/types/configuracao-loja";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { ImpressaoA4Padrao } from "./ImpressaoA4Padrao";
import { ImpressaoA4Tech } from "./ImpressaoA4Tech";

// Largura real do container de impressão em pixels (194mm @ 96dpi ≈ 733px)
const A4_WIDTH_PX = 733;
// Largura do preview no dialog (px)
const PREVIEW_WIDTH_PX = 186;
const SCALE = PREVIEW_WIDTH_PX / A4_WIDTH_PX;

const ORDEM_MOCK: OrdemServico = {
  id: "preview",
  numero_os: "0001",
  created_at: new Date().toISOString(),
  data_saida: null,
  defeito_relatado: "Tela quebrada, não liga",
  total: 250,
  status: "Aberta",
  dispositivo_modelo: "iPhone 14 Pro",
  dispositivo_imei: "123456789012345",
  dispositivo_tipo: "Smartphone",
  dispositivo_marca: "Apple",
  dispositivo_cor: "Preto",
  dispositivo_numero_serie: null,
  cliente_id: "preview",
  funcionario_id: null,
  tipo_servico_id: null,
  tempo_garantia: 90,
  cliente: {
    id: "preview",
    nome: "João da Silva",
    telefone: "11999999999",
    cpf: "12345678901",
  },
  avarias: {
    servicos_realizados: [
      { id: "s1", nome: "Troca de Tela", preco: 200, custo: 0, lucro: 200 },
      { id: "s2", nome: "Limpeza Interna", preco: 50, custo: 0, lucro: 50 },
    ],
    produtos_utilizados: [],
    custos_adicionais: [],
    avarias_visuais: [],
    checklist: {
      entrada: { tela: true, bateria: false, camera: true },
      saida: {},
    },
    dados_pagamento: { desconto: 0 },
  },
};

interface PreviewA4Props {
  config: LayoutOSConfig;
  nomeLoja?: string;
  versao?: "padrao" | "tech";
}

export function PreviewA4({ config, nomeLoja = "Minha Loja", versao }: PreviewA4Props) {
  const v = versao ?? config.versao_layout_a4 ?? "padrao";

  const configuracaoLoja = {
    id: "preview",
    nome_loja: nomeLoja,
    cnpj: "00.000.000/0001-00",
    endereco: "Rua Exemplo, 123 - São Paulo",
    telefone: "11999999999",
    logo_url: undefined,
    layout_os_config: config,
  } as any;

  const ComponenteImpressao = v === "tech" ? ImpressaoA4Tech : ImpressaoA4Padrao;

  // Altura estimada do A4 em px (297mm @ 96dpi ≈ 1122px), mas o conteúdo varia
  // Usamos altura proporcional ao scale para o wrapper externo não cortar
  const previewHeight = Math.round(520 * SCALE);

  return (
    <div
      style={{
        width: PREVIEW_WIDTH_PX,
        height: previewHeight,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: A4_WIDTH_PX,
          transformOrigin: "top left",
          transform: `scale(${SCALE})`,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <ComponenteImpressao
          ordem={ORDEM_MOCK}
          configuracaoLoja={configuracaoLoja}
          layoutConfig={config}
          termoGarantia="Garantia de 90 dias para serviços realizados, conforme o Código de Defesa do Consumidor."
        />
      </div>
    </div>
  );
}
