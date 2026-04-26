import { TermoGarantiaConfig, LayoutOSConfig } from "@/types/configuracao-loja";

// Valores padrão para os termos de garantia
export const TERMOS_PADRAO: TermoGarantiaConfig = {
  termo_90_dias:
    "Este serviço possui garantia de {{dias}} ({{dias_extenso}}) dias contados a partir da data de entrega do equipamento, conforme previsto no Código de Defesa do Consumidor (CDC - Lei 8.078/90). A garantia cobre defeitos relacionados ao serviço executado. Não estão cobertos: danos causados por mau uso, queda, contato com líquidos, modificações não autorizadas, ou desgaste natural. Para acionamento da garantia, é obrigatória a apresentação desta ordem de serviço.",
  termo_outros_dias:
    "Este serviço possui garantia de {{dias}} ({{dias_extenso}}) dias contados a partir da data de entrega do equipamento. A garantia cobre defeitos relacionados ao serviço executado. Não estão cobertos: danos causados por mau uso, queda, contato com líquidos, modificações não autorizadas, ou desgaste natural. Para acionamento da garantia, é obrigatória a apresentação desta ordem de serviço.",
  termo_sem_garantia:
    "Este serviço não possui garantia. O cliente declara estar ciente das condições do equipamento conforme checklist e avarias registradas neste documento.",
};

// Valores padrão para o layout
export const LAYOUT_PADRAO: LayoutOSConfig = {
  mostrar_logo_impressao: true,
  mostrar_logo_whatsapp: true,
  mostrar_checklist: true,
  mostrar_avarias: true,
  mostrar_senha: true,
  mostrar_assinaturas: true,
  mostrar_termos_condicoes: true,
  cor_primaria: "#000000",
  tamanho_fonte: "normal",
  formato_papel: 'a4',
  config_80mm: {
    mostrar_logo: true,
    mostrar_dados_loja: true,
    mostrar_dados_cliente: true,
    mostrar_dados_dispositivo: true,
    mostrar_defeito: true,
    mostrar_servicos: true,
    mostrar_valor: true,
    mostrar_checklist: false,
    mostrar_avarias: false,
    mostrar_senha: true,
    mostrar_assinaturas: true,
    mostrar_termos_condicoes: false,
    mostrar_forma_pagamento: true,
  },
};

// Converter número de dias para texto por extenso
export const formatGarantiaPorExtenso = (dias: number): string => {
  const extenso: Record<number, string> = {
    7: "sete",
    15: "quinze",
    30: "trinta",
    60: "sessenta",
    90: "noventa",
    180: "cento e oitenta",
    365: "trezentos e sessenta e cinco",
  };
  return extenso[dias] || dias.toString();
};

interface FormatarTermoParams {
  texto: string;
  dias: number;
  nomeLoja?: string;
  nomeCliente?: string;
  dispositivo?: string;
}

// Formatar termo substituindo variáveis
export const formatarTermo = ({
  texto,
  dias,
  nomeLoja = "Loja",
  nomeCliente = "Cliente",
  dispositivo = "Dispositivo",
}: FormatarTermoParams): string => {
  return texto
    .replace(/\{\{dias\}\}/g, dias.toString())
    .replace(/\{\{dias_extenso\}\}/g, formatGarantiaPorExtenso(dias))
    .replace(/\{\{loja\}\}/g, nomeLoja)
    .replace(/\{\{cliente\}\}/g, nomeCliente)
    .replace(/\{\{dispositivo\}\}/g, dispositivo);
};

interface ObterTermoGarantiaParams {
  tempoGarantia: number | null | undefined;
  termoConfig?: TermoGarantiaConfig;
  nomeLoja?: string;
  nomeCliente?: string;
  dispositivo?: string;
}

// Obter o termo de garantia apropriado baseado no tempo
export const obterTermoGarantia = ({
  tempoGarantia,
  termoConfig,
  nomeLoja,
  nomeCliente,
  dispositivo,
}: ObterTermoGarantiaParams): string => {
  const config = termoConfig || TERMOS_PADRAO;
  const dias = tempoGarantia || 0;

  let textoBase: string;

  if (dias === 0) {
    textoBase = config.termo_sem_garantia || TERMOS_PADRAO.termo_sem_garantia!;
  } else if (dias === 90) {
    textoBase = config.termo_90_dias || TERMOS_PADRAO.termo_90_dias!;
  } else {
    textoBase = config.termo_outros_dias || TERMOS_PADRAO.termo_outros_dias!;
  }

  return formatarTermo({
    texto: textoBase,
    dias,
    nomeLoja,
    nomeCliente,
    dispositivo,
  });
};
