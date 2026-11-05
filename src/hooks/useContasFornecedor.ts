import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Conta } from "@/types/conta";
import { useResolvedUserId, useEmpresaInfo } from "./useResolvedUserId";

export interface PeriodoFicha {
  /** "YYYY-MM-DD" (dia de Brasília, calculado pelo FiltroPeriodoAvancado). */
  inicio: string;
  /** "YYYY-MM-DD", inclusivo: `data` é coluna date, então o último dia entra inteiro. */
  fim: string;
}

/**
 * Contas a pagar de um fornecedor num período, só leitura (ficha do fornecedor).
 * Filtro no servidor: dono, tipo "pagar", fornecedor_id e `data` (vencimento,
 * o mesmo critério do menu Contas). Filial: mesma regra do useContas.
 * Contas ligadas a OS excluída ficam de fora, como no useContas.
 */
export function useContasFornecedor(fornecedorId: string | null, periodo: PeriodoFicha | null) {
  const resolvedUserId = useResolvedUserId();
  const { empresaId, isFilial } = useEmpresaInfo();

  return useQuery({
    queryKey: ["contas-fornecedor", resolvedUserId, empresaId, isFilial, fornecedorId, periodo?.inicio, periodo?.fim],
    enabled: !!fornecedorId && !!periodo?.inicio && !!periodo?.fim,
    staleTime: 30_000,
    queryFn: async (): Promise<Conta[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      const targetUserId = resolvedUserId ?? session?.user?.id;
      if (!targetUserId || !fornecedorId || !periodo) return [];

      let query = supabase
        .from("contas")
        .select("*")
        .eq("user_id", targetUserId)
        .eq("tipo", "pagar")
        .eq("fornecedor_id", fornecedorId)
        .gte("data", periodo.inicio)
        .lte("data", periodo.fim)
        .order("data", { ascending: false });
      if (empresaId) {
        query = isFilial
          ? query.eq("empresa_id", empresaId)
          : query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const contas = (data || []) as unknown as Conta[];

      const numerosOS = [...new Set(contas.map((c) => c.os_numero).filter((n): n is string => !!n))];
      if (numerosOS.length === 0) return contas;

      const { data: osExcluidas, error: erroOS } = await supabase
        .from("ordens_servico")
        .select("numero_os")
        .eq("user_id", targetUserId)
        .in("numero_os", numerosOS)
        .not("deleted_at", "is", null);
      if (erroOS) throw erroOS;
      const excluidas = new Set((osExcluidas || []).map((os) => String(os.numero_os)));
      return contas.filter((c) => !c.os_numero || !excluidas.has(c.os_numero));
    },
  });
}
