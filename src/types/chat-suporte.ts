export type StatusConversaSuporte = 'aberta' | 'em_atendimento' | 'resolvida' | 'fechada';

export interface ConversaSuporte {
  id: string;
  user_id: string;
  assunto: string;
  status: StatusConversaSuporte;
  atendido_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversaSuporteComUsuario extends ConversaSuporte {
  usuario?: {
    nome: string;
    email: string;
  };
  ultima_mensagem?: string;
  mensagens_nao_lidas?: number;
}

export interface MensagemSuporte {
  id: string;
  conversa_id: string;
  remetente_id: string;
  mensagem: string;
  is_admin: boolean;
  lida: boolean;
  created_at: string;
}
