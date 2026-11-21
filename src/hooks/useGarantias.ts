import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { applyEmpresaFilter, useIdentidadeLeitura } from "@/hooks/useResolvedUserId";
import {
  type AcaoGarantia,
  type GarantiaLoja,
  garantiasParaExibir,
  planoGravacao,
} from "@/lib/garantias/garantias";

/**
 * Garantias da loja (public.garantias_loja) para a tela "Minhas garantias".
 *
 * Leitura: mesma regra das telas por loja (useIdentidadeLeitura +
 * applyEmpresaFilter): matriz = matriz + registros sem loja; filial = só a
 * filial; funcionário = as do dono na loja dele. Lê TODAS as linhas (inclusive
 * apagadas) só para saber se a loja já teve alguma: sem nenhuma → padrões
 * virtuais (garantiasParaExibir).
 * Gravação: user_id do dono + empresa_id da loja em uso (como tipos_garantia).
 *
 * `ativo` = false não consulta nada (diálogo fechado / usuário sem acesso).
 * Fase A: ninguém fora da tela usa este hook.
 */

// A tabela ainda não está nos tipos gerados do Supabase (fase A).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabela = () => (supabase as any).from("garantias_loja");

export const CHAVE_GARANTIAS = "garantias-loja";

export function useGarantias(ativo: boolean) {
  const { userId, empresaId, isFilial, carregando } = useIdentidadeLeitura();
  const queryClient = useQueryClient();
  const habilitado = ativo && !carregando && !!userId;
  const chave = [CHAVE_GARANTIAS, userId, empresaId, isFilial] as const;

  const consulta = useQuery({
    queryKey: chave,
    enabled: habilitado,
    staleTime: 60_000,
    queryFn: async (): Promise<GarantiaLoja[]> => {
      let q = tabela()
        .select("id, user_id, empresa_id, nome, meses, texto, ativo, ordem, revisar, origem, origem_ref, created_at, updated_at, deleted_at")
        .eq("user_id", userId);
      q = applyEmpresaFilter(q, empresaId, isFilial);
      const { data, error } = await q.order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as GarantiaLoja[];
    },
  });

  const linhas = consulta.data ?? [];
  const { lista, virtual } = garantiasParaExibir(linhas);

  const gravar = useMutation({
    mutationFn: async (acao: AcaoGarantia) => {
      if (!userId) throw new Error("Usuário não identificado");
      const plano = planoGravacao(linhas, acao, { user_id: userId, empresa_id: empresaId });
      if (plano.inserir.length > 0) {
        const { error } = await tabela().insert(plano.inserir);
        if (error) throw error;
      }
      for (const u of plano.atualizar) {
        const { error } = await tabela().update(u.campos).eq("id", u.id).eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [CHAVE_GARANTIAS] }),
  });

  return {
    lista,
    virtual,
    // Sem saber ainda quem é o usuário, a lista NÃO é a definitiva (seriam os
    // padrões virtuais): conta como carregando.
    carregando: ativo && (carregando || !userId || consulta.isLoading),
    erro: consulta.error as Error | null,
    recarregar: consulta.refetch,
    gravar: gravar.mutateAsync,
    gravando: gravar.isPending,
  };
}
