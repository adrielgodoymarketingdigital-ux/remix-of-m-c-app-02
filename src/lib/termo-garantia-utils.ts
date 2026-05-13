import { TermoGarantiaConfig, LayoutOSConfig } from "@/types/configuracao-loja";

export interface TermoDispositivoVars {
  cliente?: string;
  cpf?: string;
  telefone?: string;
  dispositivo?: string;
  imei?: string;
  numero_serie?: string;
  cor?: string;
  capacidade?: string;
  condicao?: string;
  garantia_meses?: string;
  valor?: string;
  data_venda?: string;
  loja?: string;
  loja_telefone?: string;
  loja_cnpj?: string;
  loja_endereco?: string;
}

export const formatarTermoDispositivo = (texto: string, vars: TermoDispositivoVars): string => {
  return texto
    .replace(/\{\{cliente\}\}/g, vars.cliente || 'Cliente')
    .replace(/\{\{cpf\}\}/g, vars.cpf || '—')
    .replace(/\{\{telefone\}\}/g, vars.telefone || '—')
    .replace(/\{\{dispositivo\}\}/g, vars.dispositivo || 'Dispositivo')
    .replace(/\{\{imei\}\}/g, vars.imei || '—')
    .replace(/\{\{numero_serie\}\}/g, vars.numero_serie || '—')
    .replace(/\{\{cor\}\}/g, vars.cor || '—')
    .replace(/\{\{capacidade\}\}/g, vars.capacidade || '—')
    .replace(/\{\{condicao\}\}/g, vars.condicao || '—')
    .replace(/\{\{garantia_meses\}\}/g, vars.garantia_meses || '—')
    .replace(/\{\{valor\}\}/g, vars.valor || '—')
    .replace(/\{\{data_venda\}\}/g, vars.data_venda || '—')
    .replace(/\{\{loja\}\}/g, vars.loja || 'Loja')
    .replace(/\{\{loja_telefone\}\}/g, vars.loja_telefone || '—')
    .replace(/\{\{loja_cnpj\}\}/g, vars.loja_cnpj || '—')
    .replace(/\{\{loja_endereco\}\}/g, vars.loja_endereco || '—');
};

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
