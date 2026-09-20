import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentidade } from "@/hooks/useResolvedUserId";
import { isCustoNaoConfirmado, MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO } from "@/lib/vendasFinanceiras";

export interface ParcelaCustoNaoConfirmado {
  id: string;
  total: number;
  dataRecebimento: string | null;
  descricao: string;
}

/**
 * Parcelas de pagamento duplo já recebidas mas sem custo confirmado. Usa a MESMA
 * regra (isCustoNaoConfirmado) que tira a parcela do lucro/faturamento, então o
 * aviso e a exclusão nunca divergem.
 */
export function useCustoNaoConfirmado() {
  const { userId, empresaId, isFilial, carregando } = useIdentidade();

  const { data: parcelas = [] } = useQuery({
    queryKey: ["custo-nao-confirmado", userId, empresaId, isFilial],
    enabled: !!userId && !carregando,
    staleTime: 60_000,
    queryFn: async (): Promise<ParcelaCustoNaoConfirmado[]> => {
      let query = supabase
        .from("vendas")
        .select("id, total, custo_unitario, recebido, cancelada, forma_pagamento, observacoes, data_recebimento, dispositivos(marca, modelo), produtos(nome)")
        .eq("user_id", userId as string)
        .eq("observacoes", MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO)
        .eq("recebido", true)
        .in("forma_pagamento", ["a_receber", "a_prazo"])
        .is("deleted_at", null);
      if (empresaId) {
        query = isFilial
          ? query.eq("empresa_id", empresaId)
          : query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;

      return (data || [])
        .filter((v) => v.cancelada !== true && isCustoNaoConfirmado(v))
        .map((v) => ({
          id: v.id,
          total: Number(v.total || 0),
          dataRecebimento: v.data_recebimento,
          descricao:
            [v.dispositivos?.marca, v.dispositivos?.modelo].filter(Boolean).join(" ") ||
            v.produtos?.nome ||
            "Item",
        }));
    },
  });

  return {
    parcelas,
    quantidade: parcelas.length,
    total: parcelas.reduce((acc, p) => acc + p.total, 0),
  };
}
