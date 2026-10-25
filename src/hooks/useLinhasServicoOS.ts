import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lerLinhasServicoOS, type LinhaServicoLista } from "@/lib/ordemServico/aparelhosServicosListaOS";
import { consultarRelatandoErro } from "@/lib/ordemServico/formularioDispositivosAdicionaisOS";

/**
 * Linhas de serviço de UMA OS para a linha expandida da lista (etapa 6d).
 * Busca SÓ avarias->servicos_realizados — nunca o avarias inteiro, que carrega
 * fotos e assinaturas. Só roda com `habilitado` (linha aberta); o resultado
 * fica 30 s em cache, então abrir a mesma linha de novo não consulta.
 */
export const chaveLinhasServicoOS = (osId: string | null | undefined) => ["os-linhas-servico", osId ?? null] as const;

// `string` (e não o literal): o parser de tipos do supabase-js não dá conta do caminho JSON.
const COLUNAS_LINHAS_SERVICO: string = "servicos:avarias->servicos_realizados";

export function useLinhasServicoOS(osId: string, habilitado: boolean) {
  return useQuery({
    queryKey: chaveLinhasServicoOS(osId),
    queryFn: async (): Promise<LinhaServicoLista[]> => {
      const r = await consultarRelatandoErro(
        () => supabase.from("ordens_servico").select(COLUNAS_LINHAS_SERVICO).eq("id", osId).maybeSingle(),
        lerLinhasServicoOS,
      );
      if (!r.ok) throw new Error("Não foi possível carregar os serviços da OS");
      return r.dados;
    },
    enabled: habilitado && !!osId,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
