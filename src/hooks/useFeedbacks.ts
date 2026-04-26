import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Feedback, FeedbackComUsuario, TipoFeedback, StatusFeedback } from '@/types/feedback';

export const useFeedbacks = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const criarFeedback = async (dados: {
    tipo: TipoFeedback;
    titulo: string;
    descricao: string;
  }) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('feedbacks')
        .insert({
          user_id: userData.user.id,
          tipo: dados.tipo,
          titulo: dados.titulo,
          descricao: dados.descricao,
        });

      if (error) throw error;

      toast({
        title: 'Feedback enviado!',
        description: 'Obrigado pela sua contribuição.',
      });

      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar feedback',
        description: error.message,
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const listarMeusFeedbacks = async (): Promise<Feedback[]> => {
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Feedback[];
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar feedbacks',
        description: error.message,
      });
      return [];
    }
  };

  const listarTodosFeedbacks = async (): Promise<FeedbackComUsuario[]> => {
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar informações dos usuários de forma individual para evitar problemas de RLS
      const feedbacksComUsuario: FeedbackComUsuario[] = [];
      
      for (const feedback of data || []) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, nome, email')
          .eq('user_id', feedback.user_id)
          .maybeSingle();
        
        feedbacksComUsuario.push({
          ...feedback,
          usuario: profile || { nome: 'Usuário', email: 'N/A', user_id: feedback.user_id },
        } as FeedbackComUsuario);
      }

      return feedbacksComUsuario;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar feedbacks',
        description: error.message,
      });
      return [];
    }
  };

  const responderFeedback = async (id: string, resposta: string) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('feedbacks')
        .update({
          resposta_admin: resposta,
          respondido_por: userData.user.id,
          status: 'resolvido' as StatusFeedback,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Resposta enviada!',
        description: 'O usuário será notificado.',
      });

      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao responder',
        description: error.message,
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const atualizarStatus = async (id: string, status: StatusFeedback) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('feedbacks')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Status atualizado!',
      });

      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: error.message,
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    criarFeedback,
    listarMeusFeedbacks,
    listarTodosFeedbacks,
    responderFeedback,
    atualizarStatus,
  };
};
