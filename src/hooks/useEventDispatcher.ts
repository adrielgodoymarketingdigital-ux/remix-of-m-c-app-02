import { supabase } from "@/integrations/supabase/client";

type EventType =
  | "SALE_CREATED"
  | "SERVICE_ORDER_CREATED"
  | "SERVICE_ORDER_DELIVERED"
  | "SERVICE_ORDER_UPDATED"
  | "PAYMENT_CONFIRMED"
  | "SUBSCRIPTION_CREATED"
  | "SUBSCRIPTION_RENEWED";

/**
 * Hook para disparar eventos que geram notificações automáticas.
 * Todas as chamadas são fire-and-forget: não bloqueiam a UX.
 */
export const useEventDispatcher = () => {
  const dispatchEvent = async (eventType: EventType, payload: Record<string, unknown> = {}) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log("[EventDispatcher] Sem sessão, ignorando evento:", eventType);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) return;

      // Fire-and-forget com keepalive: garante que a request sobreviva a re-renders/unmounts
      const bodyStr = JSON.stringify({ event_type: eventType, payload });
      fetch(`${supabaseUrl}/functions/v1/dispatch-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: bodyStr,
        keepalive: true, // Mantém a request viva mesmo se o componente desmontar
      }).catch((err) => {
        console.warn("[EventDispatcher] Erro silencioso:", err);
      });

      console.log(`[EventDispatcher] 📤 Evento disparado: ${eventType}`);
    } catch (err) {
      // Erros silenciosos: nunca quebrar a UX
      console.warn("[EventDispatcher] Erro ao disparar evento:", err);
    }
  };

  return { dispatchEvent };
};
