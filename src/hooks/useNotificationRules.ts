import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface NotificationRule {
  id: string;
  event_type: string;
  title_template: string;
  body_template: string;
  url_template: string | null;
  target: string;
  active: boolean;
  condition: Record<string, string> | null;
  condition_label: string | null;
  sound: string | null;
  created_at: string;
  updated_at: string;
}

export function useNotificationRules() {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notification_rules")
        .select("*")
        .order("event_type");

      if (error) throw error;
      setRules(data as NotificationRule[]);
    } catch (error) {
      console.error("Erro ao carregar regras:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const updateRule = async (
    id: string,
    fields: Partial<Pick<NotificationRule, "title_template" | "body_template" | "url_template" | "target" | "active" | "sound">>
  ) => {
    try {
      const { error } = await supabase
        .from("notification_rules")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...fields } : r))
      );

      toast({ title: "Regra atualizada com sucesso!" });
    } catch (error) {
      console.error("Erro ao atualizar regra:", error);
      toast({
        title: "Erro ao atualizar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const toggleRule = async (id: string, active: boolean) => {
    await updateRule(id, { active });
  };

  return { rules, loading, updateRule, toggleRule, refetch: fetchRules };
}
