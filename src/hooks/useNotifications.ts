import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  url: string;
  type: string;
  sent_at: string;
  opened_at: string | null;
  created_at: string;
}

interface DadosNotificacoes {
  notifications: UserNotification[];
  unreadCount: number;
}

const INTERVALO_ATUALIZACAO_MS = 60_000;

export function useNotifications() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelado) setUserId(session?.user.id ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const queryKey = ["notificacoes-usuario", userId];

  // Cache compartilhado: mais de um sino na tela divide a mesma consulta. A lista
  // traz as 50 últimas; o contador é uma contagem à parte, do total de não lidas.
  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: INTERVALO_ATUALIZACAO_MS,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DadosNotificacoes> => {
      const [lista, naoLidas] = await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId!)
          .order("sent_at", { ascending: false })
          .limit(50),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId!)
          .is("opened_at", null),
      ]);
      if (lista.error) throw lista.error;
      if (naoLidas.error) throw naoLidas.error;
      return {
        notifications: (lista.data ?? []) as UserNotification[],
        unreadCount: naoLidas.count ?? 0,
      };
    },
  });

  const atualizarCache = useCallback(
    (alterar: (atual: DadosNotificacoes) => DadosNotificacoes) => {
      queryClient.setQueryData<DadosNotificacoes>(["notificacoes-usuario", userId], (atual) =>
        atual ? alterar(atual) : atual
      );
    },
    [queryClient, userId]
  );

  const markAsRead = useCallback(async (notificationId: string) => {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ opened_at: agora })
      .eq("id", notificationId);
    if (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      return;
    }
    atualizarCache((atual) => ({
      notifications: atual.notifications.map((n) =>
        n.id === notificationId ? { ...n, opened_at: agora } : n
      ),
      unreadCount: Math.max(0, atual.unreadCount - 1),
    }));
  }, [atualizarCache]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const agora = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ opened_at: agora })
      .eq("user_id", userId)
      .is("opened_at", null);
    if (error) {
      console.error("Erro ao marcar todas como lidas:", error);
      return;
    }
    atualizarCache((atual) => ({
      notifications: atual.notifications.map((n) => ({ ...n, opened_at: n.opened_at || agora })),
      unreadCount: 0,
    }));
  }, [atualizarCache, userId]);

  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    fetchNotifications: refetch,
    markAsRead,
    markAllAsRead,
  };
}
