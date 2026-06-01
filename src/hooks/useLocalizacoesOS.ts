import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LocalizacaoOS {
  id: string;
  nome: string;
  ordem: number;
}

export function useLocalizacoesOS() {
  const [localizacoes, setLocalizacoes] = useState<LocalizacaoOS[]>([]);

  useEffect(() => {
    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("os_localizacoes")
        .select("id, nome, ordem")
        .order("ordem", { ascending: true });
      setLocalizacoes(data || []);
    }
    carregar();
  }, []);

  return { localizacoes };
}
