import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function useNotificationTracking() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const notificationId = searchParams.get("notification_id");
    if (!notificationId) return;

    const trackOpening = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/notifications?id=eq.${notificationId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              "Authorization": `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ opened_at: new Date().toISOString() }),
          }
        );
      } catch (error) {
        console.error("Erro ao rastrear abertura de notificação:", error);
      }

      // Remove o parâmetro da URL sem recarregar
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("notification_id");
      setSearchParams(newParams, { replace: true });
    };

    trackOpening();
  }, [searchParams, setSearchParams]);
}
