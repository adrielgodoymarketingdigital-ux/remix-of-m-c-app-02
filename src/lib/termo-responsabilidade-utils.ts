import { TermoResponsabilidadeConfig } from "@/types/configuracao-loja";

export const TERMO_RESPONSABILIDADE_PADRAO: TermoResponsabilidadeConfig = {
  ativo: false,
  titulo: "TERMO DE ENTRADA E RESPONSABILIDADE",
  introducao: "O cliente declara estar ciente e de acordo que:",
  secoes: [
    {
      id: "procedimentos",
      titulo: "",
      clausulas: [
        { id: "1", texto: "O reparo consiste em serviço técnico especializado, não sendo possível garantir a recuperação total do aparelho.", ativo: true },
        { id: "2", texto: "Durante o processo, podem ser identificados defeitos ocultos, falhas adicionais ou agravamento do dano existente, sem que isso caracterize falha da assistência.", ativo: true },
        { id: "3", texto: "Em caso de insucesso no reparo, o aparelho poderá ser devolvido sem funcionamento, não gerando obrigação de restituição além do que foi previamente acordado.", ativo: true },
        { id: "4", texto: "A {{loja}} não se responsabiliza por perda de dados, sendo o backup de inteira responsabilidade do cliente.", ativo: true },
        { id: "5", texto: "A garantia, quando aplicável, limita-se exclusivamente ao ponto reparado, não abrangendo outros componentes ou falhas futuras.", ativo: true },
        { id: "6", texto: "O orçamento será informado após análise técnica, e o serviço somente será executado mediante aprovação expressa do cliente.", ativo: true },
      ]
    },
    {
      id: "prazo_retirada",
      titulo: "PRAZO E RETIRADA:",
      clausulas: [
        { id: "7", texto: "O prazo informado é estimado.", ativo: true },
        { id: "8", texto: "Aparelhos não retirados após 30 dias poderão gerar taxa de armazenagem.", ativo: true },
        { id: "9", texto: "Após 90 dias, o aparelho poderá ser considerado abandonado, conforme art. 1.275 do Código Civil.", ativo: true },
      ]
    }
  ],
  declaracao_final: "Declaro que li, compreendi e concordo integralmente com os termos acima.",
  exibir_na_impressao_os: false,
  imprimir_separado: true,
  cor_primaria: "#6B21A8", // Roxo padrão
};

export const VARIAVEIS_TERMO_RESPONSABILIDADE = [
  { variavel: "{{cliente}}", descricao: "Nome do cliente" },
  { variavel: "{{telefone}}", descricao: "Telefone do cliente" },
  { variavel: "{{dispositivo}}", descricao: "Tipo do dispositivo" },
  { variavel: "{{marca}}", descricao: "Marca do dispositivo" },
  { variavel: "{{modelo}}", descricao: "Modelo do dispositivo" },
  { variavel: "{{defeito}}", descricao: "Defeito relatado" },
  { variavel: "{{loja}}", descricao: "Nome da loja" },
  { variavel: "{{numero_os}}", descricao: "Número da OS" },
  { variavel: "{{data}}", descricao: "Data atual" },
];

export interface DadosSubstituicaoTermo {
  cliente?: string;
  telefone?: string;
  dispositivo?: string;
  marca?: string;
  modelo?: string;
  defeito?: string;
  loja?: string;
  numero_os?: string;
  data?: string;
}

export function formatarTextoComVariaveis(
  texto: string,
  dados: DadosSubstituicaoTermo
): string {
  let resultado = texto;
  
  if (dados.cliente) resultado = resultado.replace(/\{\{cliente\}\}/g, dados.cliente);
  if (dados.telefone) resultado = resultado.replace(/\{\{telefone\}\}/g, dados.telefone);
  if (dados.dispositivo) resultado = resultado.replace(/\{\{dispositivo\}\}/g, dados.dispositivo);
  if (dados.marca) resultado = resultado.replace(/\{\{marca\}\}/g, dados.marca);
  if (dados.modelo) resultado = resultado.replace(/\{\{modelo\}\}/g, dados.modelo);
  if (dados.defeito) resultado = resultado.replace(/\{\{defeito\}\}/g, dados.defeito);
  if (dados.loja) resultado = resultado.replace(/\{\{loja\}\}/g, dados.loja);
  if (dados.numero_os) resultado = resultado.replace(/\{\{numero_os\}\}/g, dados.numero_os);
  if (dados.data) resultado = resultado.replace(/\{\{data\}\}/g, dados.data);
  
  return resultado;
}

export function gerarIdUnico(): string {
  return Math.random().toString(36).substring(2, 9);
}
