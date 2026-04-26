import type { Node, Edge } from '@xyflow/react';

// Interface para botões de ação dinâmicos
export interface BotaoAcao {
  id: string;
  texto: string;
  estilo: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  destinoNodeId?: string;
  rota?: string;
  icone?: string;
}

export interface FlowNodeData {
  label: string;
  tipo: 'inicio' | 'decisao' | 'acao' | 'fim' | 'conteudo' | 'mensagem' | 'aguardar' | 'celebracao';
  cor: string;
  icone?: string;
  descricao?: string;
  rota?: string;
  botaoTexto?: string;
  condicao?: string;
  // Campos avançados
  subtitulo?: string;
  estiloBotao?: 'primary' | 'secondary' | 'outline' | 'ghost';
  estiloCard?: 'padrao' | 'destaque' | 'minimo';
  corIcone?: string;
  tamanho?: 'pequeno' | 'normal' | 'grande';
  // Para decisões
  opcaoVerdadeira?: string;
  opcaoFalsa?: string;
  
  // Botões dinâmicos
  botoes?: BotaoAcao[];
  layoutBotoes?: 'horizontal' | 'vertical' | 'grid';
  mostrarBotaoPrincipal?: boolean;
  
  // Aparência avançada do card
  bordaArredondada?: 'none' | 'small' | 'medium' | 'large';
  sombra?: 'none' | 'small' | 'medium' | 'large';
  fundoGradiente?: boolean;
  corFundo?: string;
  corTexto?: string;
  animacaoEntrada?: 'fade' | 'slide' | 'scale' | 'none';
  imagemUrl?: string;
  badgeTexto?: string;
  badgeCor?: string;
  
  [key: string]: unknown;
}

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;

export interface OnboardingFlowConfig {
  nodes: FlowNode[];
  edges: FlowEdge[];
  metadata?: {
    nome: string;
    descricao?: string;
    versao?: number;
    criado_em?: string;
    atualizado_em?: string;
  };
}

export const NODE_COLORS = {
  inicio: '#22c55e', // green-500
  decisao: '#eab308', // yellow-500
  acao: '#3b82f6', // blue-500
  fim: '#ef4444', // red-500
  conteudo: '#8b5cf6', // violet-500
  mensagem: '#06b6d4', // cyan-500
  aguardar: '#f97316', // orange-500
  celebracao: '#ec4899', // pink-500
};

export const NODE_LABELS = {
  inicio: 'Início',
  decisao: 'Decisão',
  acao: 'Ação',
  fim: 'Fim',
  conteudo: 'Conteúdo',
  mensagem: 'Mensagem',
  aguardar: 'Aguardar',
  celebracao: 'Celebração',
};

export const NODE_ICONS = {
  inicio: 'play',
  decisao: 'git-branch',
  acao: 'mouse-pointer',
  fim: 'flag',
  conteudo: 'file-text',
  mensagem: 'message-circle',
  aguardar: 'clock',
  celebracao: 'party-popper',
};

export const ESTILOS_BOTAO = [
  { value: 'primary', label: 'Primário' },
  { value: 'secondary', label: 'Secundário' },
  { value: 'outline', label: 'Contorno' },
  { value: 'ghost', label: 'Transparente' },
  { value: 'destructive', label: 'Destrutivo' },
];

export const BORDA_OPTIONS = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'small', label: 'Pequena' },
  { value: 'medium', label: 'Média' },
  { value: 'large', label: 'Grande' },
];

export const SOMBRA_OPTIONS = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'small', label: 'Pequena' },
  { value: 'medium', label: 'Média' },
  { value: 'large', label: 'Grande' },
];

export const ANIMACAO_OPTIONS = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide' },
  { value: 'scale', label: 'Scale' },
];

export const LAYOUT_BOTOES_OPTIONS = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'grid', label: 'Grade' },
];
