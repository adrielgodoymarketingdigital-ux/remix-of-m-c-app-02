import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  agruparResumoPorOS,
  consultarSemFalhar,
  COLUNAS_RESUMO_ADICIONAIS,
  LIMITE_RESUMO_ADICIONAIS,
  lerDispositivosAdicionais,
  type AdicionaisPorOS,
  type DispositivoAdicionalOS,
} from "@/lib/ordemServico/dispositivosAdicionaisOS";

/**
 * Leitura dos dispositivos adicionais da OS (os_dispositivos_adicionais).
 * Só LEITURA. Qualquer falha (tabela ausente, RLS, rede) vira lista vazia, sem
 * toast nem console — a tela fica como sem adicionais.
 */

const SEM_ADICIONAIS: DispositivoAdicionalOS[] = [];

export const chaveDispositivosAdicionaisOS = (osId: string | null | undefined) =>
  ["os-dispositivos-adicionais", osId ?? null] as const;

export function buscarDispositivosAdicionaisOS(osId: string): Promise<DispositivoAdicionalOS[]> {
  return consultarSemFalhar(
    () => supabase.from("os_dispositivos_adicionais").select("*").eq("os_id", osId),
    lerDispositivosAdicionais,
    SEM_ADICIONAIS,
  );
}

/**
 * Carrega para o cache do React Query os adicionais da OS. Chamado por
 * buscarOrdemCompleta em paralelo à OS, para que detalhes, impressão, recibo e
 * WhatsApp já abram com eles (sem piscar e sem imprimir antes de chegarem).
 * Nunca rejeita.
 */
export function precarregarDispositivosAdicionaisOS(queryClient: QueryClient, osId: string, forcarAtualizacao = false): Promise<void> {
  return queryClient
    .prefetchQuery({
      queryKey: chaveDispositivosAdicionaisOS(osId),
      queryFn: () => buscarDispositivosAdicionaisOS(osId),
      staleTime: forcarAtualizacao ? 0 : 30_000,
    })
    .catch(() => undefined);
}

/** Adicionais de uma OS, em ordem. `carregando` só é true na 1ª busca sem cache. */
export function useOsDispositivosAdicionais(osId: string | null | undefined): {
  adicionais: DispositivoAdicionalOS[];
  carregando: boolean;
} {
  const { data, isPending } = useQuery({
    queryKey: chaveDispositivosAdicionaisOS(osId),
    queryFn: () => buscarDispositivosAdicionaisOS(osId as string),
    enabled: !!osId,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return { adicionais: data ?? SEM_ADICIONAIS, carregando: !!osId && isPending };
}

/**
 * Resumo dos adicionais de TODAS as OS da loja, em uma consulta (selo "+1
 * aparelho" e busca da lista). `donoUserId` é o user_id do DONO da loja — o
 * mesmo que a lista de OS usa (resolverUserId em useOrdensServico), também
 * para funcionário e gerente de filial; nunca o auth.uid() de quem está logado.
 * Limite: LIMITE_RESUMO_ADICIONAIS linhas, as mais novas.
 */
export function buscarResumoAdicionaisLoja(donoUserId: string): Promise<AdicionaisPorOS> {
  return consultarSemFalhar(
    () =>
      supabase
        .from("os_dispositivos_adicionais")
        .select(COLUNAS_RESUMO_ADICIONAIS)
        .eq("user_id", donoUserId)
        .order("created_at", { ascending: false })
        .limit(LIMITE_RESUMO_ADICIONAIS),
    agruparResumoPorOS,
    {},
  );
}
