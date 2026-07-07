import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentidade, applyEmpresaFilter } from "@/hooks/useResolvedUserId";
import { formatCurrency } from "@/lib/formatters";
import { agruparVendasPorFormaPagamento, CORES_BADGE_FORMA_PAGAMENTO, BreakdownFormaPagamento } from "@/lib/formaPagamento";
import { FiltrosPeriodo } from "./FiltroPeriodoAvancado";

interface SecaoVendasPorFormaPagamentoProps {
  filtros: FiltrosPeriodo;
}

export function SecaoVendasPorFormaPagamento({ filtros }: SecaoVendasPorFormaPagamentoProps) {
  const { userId, empresaId, carregando: identidadeCarregando, isFilial } = useIdentidade();
  const [vendasPorForma, setVendasPorForma] = useState<BreakdownFormaPagamento[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (identidadeCarregando || !userId) return;
    carregar();
  }, [userId, empresaId, identidadeCarregando, filtros.dataInicio, filtros.dataFim]);

  const carregar = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("vendas")
        .select("forma_pagamento, total, observacoes, segunda_forma_pagamento, valor_segunda_forma")
        .eq("user_id", userId)
        .or("cancelada.is.null,cancelada.eq.false");

      if (filtros.dataInicio) query = query.gte("data", filtros.dataInicio);
      if (filtros.dataFim) query = query.lte("data", `${filtros.dataFim}T23:59:59`);

      query = applyEmpresaFilter(query, empresaId, isFilial);

      const { data: vendas, error } = await query;
      if (error) throw error;

      setVendasPorForma(agruparVendasPorFormaPagamento(vendas ?? []));
    } catch (error) {
      console.error("Erro ao carregar vendas por forma de pagamento:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!loading && vendasPorForma.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Wallet className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Vendas por Forma de Pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {vendasPorForma.map((vf) => (
              <div key={vf.chave} className="flex justify-between items-center text-sm rounded-lg border p-3">
                <span className={CORES_BADGE_FORMA_PAGAMENTO[vf.cor]}>
                  {vf.nome}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({vf.quantidade} venda{vf.quantidade !== 1 ? "s" : ""})
                  </span>
                </span>
                <span className={`font-semibold ${CORES_BADGE_FORMA_PAGAMENTO[vf.cor]}`}>
                  {formatCurrency(vf.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
