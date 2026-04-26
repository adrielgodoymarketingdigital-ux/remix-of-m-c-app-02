import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CoresPersonalizadas {
  primary_from: string;
  primary_via: string;
  primary_to: string;
  card_faturamento_from: string;
  card_faturamento_via: string;
  card_faturamento_to: string;
}

const DEFAULT_CORES: CoresPersonalizadas = {
  primary_from: "#1e40af",
  primary_via: "#1d4ed8",
  primary_to: "#0891b2",
  card_faturamento_from: "#1e3a8a",
  card_faturamento_via: "#1d4ed8",
  card_faturamento_to: "#0891b2",
};

export function useCoresPersonalizadas() {
  const [cores, setCores] = useState<CoresPersonalizadas>(DEFAULT_CORES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarCores();
  }, []);

  const carregarCores = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("configuracoes_loja")
        .select("cores_personalizadas")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Erro ao carregar cores:", error);
        setLoading(false);
        return;
      }

      if (data?.cores_personalizadas) {
        const coresDB = data.cores_personalizadas as unknown as CoresPersonalizadas;
        const coresFinal = { ...DEFAULT_CORES, ...coresDB };
        setCores(coresFinal);
        aplicarCoresNoDOM(coresFinal);
      }
    } catch (error) {
      console.error("Erro ao carregar cores:", error);
    } finally {
      setLoading(false);
    }
  };

  const aplicarCoresNoDOM = (coresConfig: CoresPersonalizadas) => {
    document.documentElement.style.setProperty("--custom-primary-from", coresConfig.primary_from);
    document.documentElement.style.setProperty("--custom-primary-via", coresConfig.primary_via);
    document.documentElement.style.setProperty("--custom-primary-to", coresConfig.primary_to);
    document.documentElement.style.setProperty("--custom-card-from", coresConfig.card_faturamento_from);
    document.documentElement.style.setProperty("--custom-card-via", coresConfig.card_faturamento_via);
    document.documentElement.style.setProperty("--custom-card-to", coresConfig.card_faturamento_to);
  };

  return { cores, loading, DEFAULT_CORES };
}
