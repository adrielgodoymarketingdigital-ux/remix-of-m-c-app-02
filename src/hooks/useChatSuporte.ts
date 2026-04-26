import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ConversaSuporte, ConversaSuporteComUsuario, MensagemSuporte, StatusConversaSuporte } from '@/types/chat-suporte';

export const useChatSuporte = (isAdmin: boolean = false) => {
  const [loading, setLoading] = useState(false);
  const [conversas, setConversas] = useState<ConversaSuporteComUsuario[]>([]);
  const [mensagens, setMensagens] = useState<MensagemSuporte[]>([]);
  const [conversaAtiva, setConversaAtiva] = useState<ConversaSuporte | null>(null);
  const { toast } = useToast();

  const carregarConversas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('conversas_suporte')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (isAdmin && data) {
        // Buscar informações dos usuários para admin
        const userIds = [...new Set(data.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, nome, email')
          .in('user_id', userIds);

        const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        // Buscar última mensagem e contagem de não lidas
        const conversasComInfo = await Promise.all(
          data.map(async (conversa) => {
            const { data: ultimaMensagem } = await supabase
              .from('mensagens_suporte')
              .select('mensagem')
              .eq('conversa_id', conversa.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const { count } = await supabase
              .from('mensagens_suporte')
              .select('*', { count: 'exact', head: true })
              .eq('conversa_id', conversa.id)
              .eq('lida', false)
              .eq('is_admin', false);

            return {
              ...conversa,
              usuario: profilesMap.get(conversa.user_id),
              ultima_mensagem: ultimaMensagem?.mensagem,
              mensagens_nao_lidas: count || 0,
            };
          })
        );

        setConversas(conversasComInfo as ConversaSuporteComUsuario[]);
      } else {
        setConversas((data || []) as ConversaSuporteComUsuario[]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar conversas:', error);
    }
  }, [isAdmin]);

  const carregarMensagens = useCallback(async (conversaId: string) => {
    try {
      const { data, error } = await supabase
        .from('mensagens_suporte')
        .select('*')
        .eq('conversa_id', conversaId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMensagens((data || []) as MensagemSuporte[]);

      // Marcar mensagens como lidas
      if (isAdmin) {
        await supabase
          .from('mensagens_suporte')
          .update({ lida: true })
          .eq('conversa_id', conversaId)
          .eq('is_admin', false);
      } else {
        await supabase
          .from('mensagens_suporte')
          .update({ lida: true })
          .eq('conversa_id', conversaId)
          .eq('is_admin', true);
      }
    } catch (error: any) {
      console.error('Erro ao carregar mensagens:', error);
    }
  }, [isAdmin]);

  const criarConversa = async (assunto: string): Promise<ConversaSuporte | null> => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('conversas_suporte')
        .insert({
          user_id: userData.user.id,
          assunto,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Conversa iniciada!',
        description: 'Envie sua primeira mensagem.',
      });

      await carregarConversas();
      return data as ConversaSuporte;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar conversa',
        description: error.message,
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const enviarMensagem = async (conversaId: string, mensagem: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('mensagens_suporte')
        .insert({
          conversa_id: conversaId,
          remetente_id: userData.user.id,
          mensagem,
          is_admin: isAdmin,
        });

      if (error) throw error;

      // Atualizar updated_at da conversa
      await supabase
        .from('conversas_suporte')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversaId);

      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar mensagem',
        description: error.message,
      });
      return false;
    }
  };

  const atualizarStatusConversa = async (conversaId: string, status: StatusConversaSuporte) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const updateData: any = { status };
      if (status === 'em_atendimento' && userData.user) {
        updateData.atendido_por = userData.user.id;
      }

      const { error } = await supabase
        .from('conversas_suporte')
        .update(updateData)
        .eq('id', conversaId);

      if (error) throw error;

      toast({
        title: 'Status atualizado!',
      });

      await carregarConversas();
      return true;
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: error.message,
      });
      return false;
    }
  };

  // Realtime subscription
  useEffect(() => {
    if (!conversaAtiva) return;

    const channel = supabase
      .channel(`mensagens_${conversaAtiva.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens_suporte',
          filter: `conversa_id=eq.${conversaAtiva.id}`,
        },
        (payload) => {
          setMensagens((prev) => [...prev, payload.new as MensagemSuporte]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversaAtiva]);

  // Carregar conversas ao montar
  useEffect(() => {
    carregarConversas();
  }, [carregarConversas]);

  return {
    loading,
    conversas,
    mensagens,
    conversaAtiva,
    setConversaAtiva,
    carregarConversas,
    carregarMensagens,
    criarConversa,
    enviarMensagem,
    atualizarStatusConversa,
  };
};
