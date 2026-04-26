export type TipoFeedback = 'sugestao' | 'reclamacao' | 'melhoria';
export type StatusFeedback = 'pendente' | 'em_analise' | 'resolvido' | 'arquivado';

export interface Feedback {
  id: string;
  user_id: string;
  tipo: TipoFeedback;
  titulo: string;
  descricao: string;
  status: StatusFeedback;
  resposta_admin: string | null;
  respondido_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackComUsuario extends Feedback {
  usuario?: {
    nome: string;
    email: string;
  };
}
