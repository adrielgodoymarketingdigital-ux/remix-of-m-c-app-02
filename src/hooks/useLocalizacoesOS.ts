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
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("os_localizacoes")
        .select("id, nome, ordem")
        .eq("user_id", data.user.id)
        .order("ordem", { ascending: true })
        .then(({ data: rows }) => setLocalizacoes(rows || []));
    });
  }, []);

  return { localizacoes };
}
