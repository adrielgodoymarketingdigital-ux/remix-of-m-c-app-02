export interface AvisoSistema {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  icone?: string | null;
  link_url?: string | null;
  link_texto?: string | null;
  publico_alvo: string[];
  ativo: boolean;
  data_inicio: string;
  data_fim?: string | null;
  prioridade: number;
  cor_fundo?: string | null;
  cor_texto?: string | null;
  cor_icone?: string | null;
  cor_botao?: string | null;
  imagem_url?: string | null;
  imagem_posicao?: 'direita' | 'esquerda' | 'topo' | 'fundo' | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export type AvisoSistemaInsert = Omit<AvisoSistema, 'id' | 'created_at' | 'updated_at'>;
export type AvisoSistemaUpdate = Partial<AvisoSistemaInsert>;

export const TIPOS_PLANO = [
  { value: 'todos', label: 'Todos os usuários' },
  { value: 'trial', label: 'Trial (Teste)' },
  { value: 'trial_expirado', label: 'Trial Expirado' },
  { value: 'basico_mensal', label: 'Básico Mensal' },
  { value: 'basico_anual', label: 'Básico Anual' },
  { value: 'intermediario_mensal', label: 'Intermediário Mensal' },
  { value: 'intermediario_anual', label: 'Intermediário Anual' },
  { value: 'profissional_mensal', label: 'Profissional Mensal' },
  { value: 'profissional_anual', label: 'Profissional Anual' },
] as const;

export const TIPOS_AVISO = [
  { value: 'info', label: 'Informativo', cor: '#3B82F6' },
  { value: 'warning', label: 'Alerta', cor: '#EAB308' },
  { value: 'success', label: 'Sucesso', cor: '#22C55E' },
  { value: 'promo', label: 'Promoção', cor: '#A855F7' },
  { value: 'custom', label: 'Personalizado', cor: '#6B7280' },
] as const;

export const POSICOES_IMAGEM = [
  { value: 'direita', label: 'Direita' },
  { value: 'esquerda', label: 'Esquerda' },
  { value: 'topo', label: 'Topo (Banner)' },
  { value: 'fundo', label: 'Fundo' },
] as const;

export const CORES_PRESET = [
  // Azuis
  { value: '#3B82F6', label: 'Azul' },
  { value: '#0EA5E9', label: 'Azul Céu' },
  { value: '#06B6D4', label: 'Ciano' },
  { value: '#1D4ED8', label: 'Azul Escuro' },
  { value: '#60A5FA', label: 'Azul Claro' },
  // Verdes
  { value: '#22C55E', label: 'Verde' },
  { value: '#10B981', label: 'Esmeralda' },
  { value: '#14B8A6', label: 'Teal' },
  { value: '#84CC16', label: 'Lima' },
  { value: '#16A34A', label: 'Verde Escuro' },
  // Amarelos e Laranjas
  { value: '#EAB308', label: 'Amarelo' },
  { value: '#FACC15', label: 'Amarelo Claro' },
  { value: '#F97316', label: 'Laranja' },
  { value: '#FB923C', label: 'Laranja Claro' },
  { value: '#EA580C', label: 'Laranja Escuro' },
  // Vermelhos e Rosas
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#DC2626', label: 'Vermelho Escuro' },
  { value: '#F87171', label: 'Vermelho Claro' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#F472B6', label: 'Rosa Claro' },
  { value: '#DB2777', label: 'Rosa Escuro' },
  // Roxos
  { value: '#A855F7', label: 'Roxo' },
  { value: '#8B5CF6', label: 'Violeta' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#7C3AED', label: 'Roxo Escuro' },
  { value: '#C084FC', label: 'Roxo Claro' },
  // Neutros
  { value: '#64748B', label: 'Cinza' },
  { value: '#475569', label: 'Cinza Escuro' },
  { value: '#94A3B8', label: 'Cinza Claro' },
  { value: '#1E293B', label: 'Slate' },
  { value: '#0F172A', label: 'Preto' },
  { value: '#FFFFFF', label: 'Branco' },
  // Especiais
  { value: '#78350F', label: 'Marrom' },
  { value: '#854D0E', label: 'Âmbar' },
  { value: '#166534', label: 'Floresta' },
  { value: '#0C4A6E', label: 'Oceano' },
  { value: '#581C87', label: 'Uva' },
] as const;
