import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminBadges {
  feedbacksPendentes: number;
  mensagensNaoLidas: number;
  chatsAbertos: number;
}

export const useAdminBadges = (isAdmin: boolean) => {
  const [badges, setBadges] = useState<AdminBadges>({
    feedbacksPendentes: 0,
    mensagensNaoLidas: 0,
    chatsAbertos: 0,
  });

  const carregarBadges = useCallback(async () => {
    if (!isAdmin) return;

    try {
      // Feedbacks pendentes
      const { count: feedbacksPendentes } = await supabase
        .from('feedbacks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente');

      // Mensagens não lidas do chat (enviadas por usuários, não por admin)
      const { count: mensagensNaoLidas } = await supabase
        .from('mensagens_suporte')
        .select('*', { count: 'exact', head: true })
        .eq('lida', false)
        .eq('is_admin', false);

      // Chats abertos
      const { count: chatsAbertos } = await supabase
        .from('conversas_suporte')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'aberta');

      setBadges({
        feedbacksPendentes: feedbacksPendentes || 0,
        mensagensNaoLidas: mensagensNaoLidas || 0,
        chatsAbertos: chatsAbertos || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar badges:', error);
    }
  }, [isAdmin]);

  useEffect(() => {
    carregarBadges();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(carregarBadges, 30000);
    return () => clearInterval(interval);
  }, [carregarBadges]);

  // Realtime subscriptions
  useEffect(() => {
    if (!isAdmin) return;

    const feedbackChannel = supabase
      .channel('admin_badges_feedbacks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedbacks' },
        () => carregarBadges()
      )
      .subscribe();

    const mensagensChannel = supabase
      .channel('admin_badges_mensagens')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mensagens_suporte' },
        () => carregarBadges()
      )
      .subscribe();

    const conversasChannel = supabase
      .channel('admin_badges_conversas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversas_suporte' },
        () => carregarBadges()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(feedbackChannel);
      supabase.removeChannel(mensagensChannel);
      supabase.removeChannel(conversasChannel);
    };
  }, [isAdmin, carregarBadges]);

  return { badges, refetch: carregarBadges };
};
