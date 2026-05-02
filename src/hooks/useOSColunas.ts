import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface ConfiguracaoColunas {
  colunas: string[];
  acoes_principais: string[];
}

const COLUNAS_DISPONIVEIS = [
  { key: "numero_os", label: "Número da OS" },
  { key: "cliente", label: "Cliente" },
  { key: "dispositivo", label: "Dispositivo" },
  { key: "defeito", label: "Defeito Relatado" },
  { key: "status", label: "Status" },
  { key: "data_saida", label: "Data de Saída" },
  { key: "valor", label: "Valor" },
  { key: "tecnico", label: "Técnico" },
];

const ACOES_DISPONIVEIS = [
  { key: "visualizar", label: "Visualizar", icone: "Eye" },
  { key: "editar", label: "Editar", icone: "Pencil" },
  { key: "imprimir", label: "Imprimir", icone: "Printer" },
  { key: "whatsapp", label: "WhatsApp", icone: "MessageSquare" },
  { key: "compartilhar", label: "Compartilhar", icone: "RadioTower" },
  { key: "etiqueta", label: "Etiqueta", icone: "Tag" },
  { key: "termo", label: "Termo", icone: "FileText" },
  { key: "excluir", label: "Excluir", icone: "Trash2" },
];

const CONFIG_PADRAO: ConfiguracaoColunas = {
  colunas: ["numero_os", "cliente", "dispositivo", "status", "valor"],
  acoes_principais: ["visualizar", "editar", "whatsapp", "excluir"],
};

export { COLUNAS_DISPONIVEIS, ACOES_DISPONIVEIS, CONFIG_PADRAO };

export function useOSColunas() {
  const [config, setConfig] = useState<ConfiguracaoColunas>(CONFIG_PADRAO);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsLoading(false); return; }

        const { data } = await supabase
          .from('profiles')
          .select('preferencias_os')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.preferencias_os) {
          setConfig(data.preferencias_os as unknown as ConfiguracaoColunas);
        }
      } catch {
        // silently fall back to defaults
      } finally {
        setIsLoading(false);
      }
    };
    carregar();
  }, []);

  const salvar = async (novaConfig: ConfiguracaoColunas) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({ preferencias_os: novaConfig as unknown as Json })
        .eq('user_id', user.id);

      setConfig(novaConfig);
    } catch {
      // silently ignore save errors
    }
  };

  return { config, isLoading, salvar, COLUNAS_DISPONIVEIS, ACOES_DISPONIVEIS };
}
