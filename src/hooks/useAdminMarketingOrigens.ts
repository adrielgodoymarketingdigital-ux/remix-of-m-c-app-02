import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";
import { calcularPeriodos, type IntervaloDatas, type PeriodoMarketing } from "@/lib/marketing/cadastrosPorDia";
import type { LinhaOrigem } from "@/lib/marketing/origens";

export interface OrigensMarketing {
  intervalo: IntervaloDatas;
  linhas: LinhaOrigem[];
}

/** A função ainda não foi criada no banco (PostgREST: PGRST202; Postgres: 42883). */
export class FuncaoOrigensIndisponivel extends Error {}

/**
 * Cadastros e conversão por origem do painel Marketing (só admin; a RPC recusa
 * quem não é). Mesmo período do seletor da página. A RPC ainda não está em
 * src/integrations/supabase/types.ts, por isso o `as never` (mesmo padrão de
 * useAdminMarketingCadastros).
 */
export function useAdminMarketingOrigens(periodo: PeriodoMarketing) {
  const { atual } = calcularPeriodos(periodo, dataBrasiliaISO());

  return useQuery({
    queryKey: ["admin-mkt-origens", atual.inicio, atual.fim],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (tentativas, erro) => !(erro instanceof FuncaoOrigensIndisponivel) && tentativas < 1,
    queryFn: async (): Promise<OrigensMarketing> => {
      const { data, error } = await supabase.rpc(
        "admin_mkt_origens" as never,
        { p_inicio: atual.inicio, p_fim: atual.fim } as never,
      );
      if (error) {
        if (error.code === "PGRST202" || error.code === "42883") throw new FuncaoOrigensIndisponivel(error.message);
        throw error;
      }
      return { intervalo: atual, linhas: (data ?? []) as unknown as LinhaOrigem[] };
    },
  });
}
