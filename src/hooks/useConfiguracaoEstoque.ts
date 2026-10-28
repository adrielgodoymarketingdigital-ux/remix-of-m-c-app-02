import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentidade } from "@/hooks/useResolvedUserId";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import {
  interpretarLeitura,
  SEM_CONFIGURACAO,
  type LeituraConfiguracaoEstoque,
} from "@/lib/estoque/configuracaoEstoque";

export const CHAVE_CONFIGURACAO_ESTOQUE = "configuracao-estoque";

/**
 * Limite de estoque baixo da loja (tabela configuracao_estoque).
 * Lê pelo id do DONO: funcionário e gerente de filial herdam o limite dele
 * (filial usa o da matriz). Só o dono salva.
 *
 * Tolerante: se a tabela ainda não existir (front antes da migration) ou a
 * leitura falhar, devolve "sem configuração" (cada tela usa o padrão de hoje),
 * sem erro na tela e sem toast.
 */
export function useConfiguracaoEstoque() {
  const queryClient = useQueryClient();
  const { userId, carregando: identidadeCarregando, isGerenteFilial } = useIdentidade();
  const { isFuncionario, carregando: permissoesCarregando } = useFuncionarioPermissoes();
  const identidadePronta = !identidadeCarregando && !permissoesCarregando && !!userId;
  const ehDono = identidadePronta && !isFuncionario && !isGerenteFilial;

  const consulta = useQuery({
    queryKey: [CHAVE_CONFIGURACAO_ESTOQUE, userId],
    enabled: identidadePronta,
    retry: false,
    queryFn: async (): Promise<LeituraConfiguracaoEstoque> => {
      const { data, error } = await supabase
        .from("configuracao_estoque")
        .select("limite_baixo")
        .eq("user_id", userId as string)
        .maybeSingle();
      return interpretarLeitura(data, error);
    },
  });

  const mutacao = useMutation({
    mutationFn: async (limiteBaixo: number | null) => {
      if (!ehDono || !userId) throw new Error("Só o dono da loja altera o limite de estoque baixo.");
      const { error } = await supabase
        .from("configuracao_estoque")
        .upsert({ user_id: userId, limite_baixo: limiteBaixo }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CHAVE_CONFIGURACAO_ESTOQUE] }),
  });

  const leitura = consulta.data ?? SEM_CONFIGURACAO;
  const salvar = useCallback((limiteBaixo: number | null) => mutacao.mutateAsync(limiteBaixo), [mutacao]);

  return {
    /** Limite da loja; null = padrão de cada tela (também enquanto carrega). */
    limiteBaixo: leitura.limiteBaixo,
    tabelaDisponivel: leitura.tabelaDisponivel,
    carregando: !identidadePronta || consulta.isLoading,
    ehDono,
    salvar,
    salvando: mutacao.isPending,
  };
}
