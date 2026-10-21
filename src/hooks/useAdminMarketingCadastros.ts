import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";
import {
  calcularPeriodos,
  preencherDias,
  somarTotais,
  type CadastrosDia,
  type IntervaloDatas,
  type LinhaCadastrosDia,
  type PeriodoMarketing,
  type TotaisCadastros,
} from "@/lib/marketing/cadastrosPorDia";

export interface CadastrosMarketing {
  atual: IntervaloDatas;
  anterior: IntervaloDatas;
  dias: CadastrosDia[];
  totais: TotaisCadastros;
  totaisAnterior: TotaisCadastros;
}

/**
 * Cadastros por dia do painel Marketing (só admin; a RPC recusa quem não é).
 * Uma chamada cobre o período anterior + o atual, separados no client.
 * A RPC é nova e ainda não está em src/integrations/supabase/types.ts, por
 * isso o `as never` (mesmo padrão de EmpresaContext/MultiEmpresas).
 */
export function useAdminMarketingCadastros(periodo: PeriodoMarketing) {
  const hoje = dataBrasiliaISO();
  const { atual, anterior } = calcularPeriodos(periodo, hoje);

  return useQuery({
    queryKey: ["admin-mkt-cadastros-por-dia", anterior.inicio, atual.fim],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async (): Promise<CadastrosMarketing> => {
      const { data, error } = await supabase.rpc(
        "admin_mkt_cadastros_por_dia" as never,
        { p_inicio: anterior.inicio, p_fim: atual.fim } as never,
      );
      if (error) throw error;
      const linhas = (data ?? []) as unknown as LinhaCadastrosDia[];
      const dias = preencherDias(linhas, atual);
      return {
        atual,
        anterior,
        dias,
        totais: somarTotais(dias),
        totaisAnterior: somarTotais(preencherDias(linhas, anterior)),
      };
    },
  });
}
