import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EventType =
  | "SALE_CREATED"
  | "SERVICE_ORDER_CREATED"
  | "SERVICE_ORDER_DELIVERED"
  | "SERVICE_ORDER_UPDATED"
  | "PAYMENT_CONFIRMED";

export type OSStatus =
  | "pendente"
  | "em_andamento"
  | "concluida"
  | "aguardando_aprovacao"
  | "finalizado"
  | "entregue"
  | "aguardando_retirada"
  | "garantia"
  | "cancelada"
  | "estornado";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  SALE_CREATED: "Novas vendas",
  SERVICE_ORDER_CREATED: "OS cadastrada",
  SERVICE_ORDER_DELIVERED: "OS entregue",
  SERVICE_ORDER_UPDATED: "Status da OS alterado",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
};

export const OS_STATUS_LABELS: Record<OSStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  aguardando_aprovacao: "Aguardando aprovação",
  finalizado: "Finalizada",
  entregue: "Entregue",
  aguardando_retirada: "Aguardando retirada",
  garantia: "Garantia",
  cancelada: "Cancelada",
  estornado: "Estornada",
};

export const ALL_OS_STATUSES: OSStatus[] = [
  "pendente",
  "em_andamento",
  "concluida",
  "aguardando_aprovacao",
  "finalizado",
  "entregue",
  "aguardando_retirada",
  "garantia",
  "cancelada",
  "estornado",
];

export const EVENT_TYPE_ICONS: Record<EventType, string> = {
  SALE_CREATED: "shopping-cart",
  SERVICE_ORDER_CREATED: "clipboard-plus",
  SERVICE_ORDER_DELIVERED: "package-check",
  SERVICE_ORDER_UPDATED: "refresh-cw",
  PAYMENT_CONFIRMED: "credit-card",
};

export type PreferenceKey = EventType | `SERVICE_ORDER_STATUS_${OSStatus}`;

const DEFAULT_PREFERENCES: Record<string, boolean> = {
  SALE_CREATED: true,
  SERVICE_ORDER_CREATED: true,
  SERVICE_ORDER_DELIVERED: true,
  SERVICE_ORDER_UPDATED: true,
  PAYMENT_CONFIRMED: true,
  ...Object.fromEntries(ALL_OS_STATUSES.map((s) => [`SERVICE_ORDER_STATUS_${s}`, true])),
};

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<Record<string, boolean>>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  const loadPreferences = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("user_notification_preferences")
        .select("preferences")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar preferências:", error);
        return;
      }

      if (data?.preferences) {
        const prefs = data.preferences as Record<string, boolean>;
        setPreferences({
          ...DEFAULT_PREFERENCES,
          ...prefs,
        });
      }
    } catch (err) {
      console.error("Erro ao carregar preferências:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const savePreferences = useCallback(async (newPrefs: Record<string, boolean>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const prefsJson = JSON.parse(JSON.stringify(newPrefs));

      const { data: existing } = await supabase
        .from("user_notification_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("user_notification_preferences")
          .update({ preferences: prefsJson })
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("user_notification_preferences")
          .insert([{
            user_id: user.id,
            preferences: prefsJson,
          }]);
      }
    } catch (err) {
      console.error("Erro ao salvar preferências:", err);
    }
  }, []);

  const togglePreference = useCallback(async (key: string, enabled: boolean) => {
    const newPrefs = { ...preferences, [key]: enabled };
    setPreferences(newPrefs);
    await savePreferences(newPrefs);
  }, [preferences, savePreferences]);

  const setAllPreferences = useCallback(async (enabled: boolean) => {
    const newPrefs = Object.keys(DEFAULT_PREFERENCES).reduce((acc, key) => {
      acc[key] = enabled;
      return acc;
    }, {} as Record<string, boolean>);
    setPreferences(newPrefs);
    await savePreferences(newPrefs);
  }, [savePreferences]);

  const allEnabled = Object.values(preferences).every(Boolean);
  const allDisabled = Object.values(preferences).every((v) => !v);

  return {
    preferences,
    isLoading,
    togglePreference,
    setAllPreferences,
    allEnabled,
    allDisabled,
  };
}
