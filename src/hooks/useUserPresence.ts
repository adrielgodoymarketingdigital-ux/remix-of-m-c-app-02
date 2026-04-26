import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Marca o usuário atual como "online" via Supabase Realtime Presence.
 * Deve ser chamado uma vez no shell autenticado do app.
 */
export function useUserPresence(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}

/**
 * Observa a contagem de usuários online em tempo real (para o admin).
 */
export function useOnlineUsersCount(
  enabled: boolean,
  onChange: (count: number, userIds: string[]) => void,
) {
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: `admin-observer-${crypto.randomUUID()}` } },
    });

    const recompute = () => {
      const state = channel.presenceState() as Record<string, Array<{ user_id?: string }>>;
      const ids = new Set<string>();
      for (const key of Object.keys(state)) {
        if (key.startsWith("admin-observer-")) continue;
        const metas = state[key];
        const id = metas?.[0]?.user_id || key;
        ids.add(id);
      }
      const arr = Array.from(ids);
      onChange(arr.length, arr);
    };

    channel
      .on("presence", { event: "sync" }, recompute)
      .on("presence", { event: "join" }, recompute)
      .on("presence", { event: "leave" }, recompute)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, onChange]);
}
