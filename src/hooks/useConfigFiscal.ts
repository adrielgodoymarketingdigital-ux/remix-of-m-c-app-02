import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ConfigFiscal = Tables<"fiscal_config">;

/** Campos que a tela envia; a Edge Function aceita só estes. */
export interface DadosConfigFiscal {
  regime_tributario: string | null;
  cnae: string | null;
  codigo_ibge_municipio: string | null;
  serie_nfse: string | null;
  serie_nfe: string | null;
  serie_nfce: string | null;
}

/** Extrai a mensagem de erro do corpo JSON de uma resposta não-2xx de Edge Function. */
async function mensagemDoErro(error: unknown): Promise<string | null> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      return body?.error ?? null;
    } catch {
      return null;
    }
  }
  return error instanceof Error ? error.message : null;
}

/**
 * Configuração fiscal da MATRIZ (empresa_id nulo) do usuário logado.
 * Leitura direta (RLS: SELECT do dono); gravação só pela Edge Function
 * fiscal-config-salvar (service role) — o navegador nunca grava em tabela fiscal.
 * Usa o id do próprio usuário, o mesmo que a função tira do token.
 */
export function useConfigFiscal(habilitado: boolean) {
  const queryClient = useQueryClient();

  const consulta = useQuery({
    queryKey: ["fiscal-config-matriz"],
    enabled: habilitado,
    queryFn: async (): Promise<ConfigFiscal | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("fiscal_config")
        .select("*")
        .eq("user_id", user.id)
        .is("empresa_id", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const salvar = useMutation({
    mutationFn: async (dados: DadosConfigFiscal): Promise<ConfigFiscal> => {
      const { data, error } = await supabase.functions.invoke("fiscal-config-salvar", { body: dados });
      if (error) throw new Error((await mensagemDoErro(error)) ?? "Não foi possível salvar a configuração fiscal.");
      return (data as { config: ConfigFiscal }).config;
    },
    onSuccess: (config) => {
      queryClient.setQueryData(["fiscal-config-matriz"], config);
    },
  });

  return { config: consulta.data ?? null, carregando: consulta.isLoading, erro: consulta.error, salvar };
}
