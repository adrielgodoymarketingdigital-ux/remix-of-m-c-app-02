import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Repeat, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentidade, applyEmpresaFilter } from "@/hooks/useResolvedUserId";
import { formatCurrency } from "@/lib/formatters";
import { agruparVendasPorFormaPagamento, CORES_BADGE_FORMA_PAGAMENTO, BreakdownFormaPagamento } from "@/lib/formaPagamento";
import { FiltrosPeriodo } from "./FiltroPeriodoAvancado";
import { limitesDiaBrasilia } from "@/lib/dataBrasilia";
import { TOTAIS_DEVOLUCOES_ZERO, type TotaisDevolucoesTroca } from "@/lib/caixa/devolucoesTroca";
import { carregarDevolucoesDasVendas } from "@/lib/caixa/carregarDevolucoesTroca";

interface SecaoVendasPorFormaPagamentoProps {
  filtros: FiltrosPeriodo;
}

export function SecaoVendasPorFormaPagamento({ filtros }: SecaoVendasPorFormaPagamentoProps) {
  const { userId, empresaId, carregando: identidadeCarregando, isFilial } = useIdentidade();
  const [vendasPorForma, setVendasPorForma] = useState<BreakdownFormaPagamento[]>([]);
  const [loading, setLoading] = useState(false);
  // Devoluções da diferença da troca das vendas do período: à parte, não mexem nos totais acima.
  const [devolucoes, setDevolucoes] = useState<TotaisDevolucoesTroca>(TOTAIS_DEVOLUCOES_ZERO);

  useEffect(() => {
    if (identidadeCarregando || !userId) return;
    carregar();
  }, [userId, empresaId, identidadeCarregando, filtros.dataInicio, filtros.dataFim]);

  const carregar = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("vendas")
        .select("forma_pagamento, total, observacoes, segunda_forma_pagamento, valor_segunda_forma, valor_troca, grupo_venda")
        .eq("user_id", userId)
        .or("cancelada.is.null,cancelada.eq.false");

      // vendas.data é timestamptz — usar limites em UTC precisos (não a string de
      // data pura, que o Postgres interpretaria à meia-noite UTC, 3h adiantada
      // em relação à meia-noite de Brasília). Ver src/lib/dataBrasilia.ts.
      if (filtros.dataInicio) query = query.gte("data", limitesDiaBrasilia(filtros.dataInicio).inicioISO);
      if (filtros.dataFim) query = query.lte("data", limitesDiaBrasilia(filtros.dataFim).fimISO);

      query = applyEmpresaFilter(query, empresaId, isFilial);

      const { data: vendas, error } = await query;
      if (error) throw error;

      setVendasPorForma(agruparVendasPorFormaPagamento(vendas ?? []));

      // Mesmas vendas (período, empresa, não canceladas): só as com troca podem ter devolução.
      const gruposComTroca = (vendas ?? [])
        .filter((v) => v.valor_troca != null && v.grupo_venda)
        .map((v) => v.grupo_venda as string);
      let totaisDevolucao = TOTAIS_DEVOLUCOES_ZERO;
      if (gruposComTroca.length > 0) {
        try {
          totaisDevolucao = await carregarDevolucoesDasVendas(gruposComTroca);
        } catch (erro) {
          console.error("Erro ao carregar devoluções de troca:", erro);
        }
      }
      setDevolucoes(totaisDevolucao);
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
        {!loading && (devolucoes.dinheiro > 0 || devolucoes.pix > 0) && (
          <div className="mt-3 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {([
                ["Dinheiro", devolucoes.dinheiro, devolucoes.quantidadeDinheiro],
                ["Pix", devolucoes.pix, devolucoes.quantidadePix],
              ] as const)
                .filter(([, valor]) => valor > 0)
                .map(([forma, valor, quantidade]) => (
                  <div key={forma} className="flex justify-between items-center text-sm rounded-lg border border-dashed p-3">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Repeat className="h-3.5 w-3.5" />
                      Devoluções de troca ({forma})
                      <span className="ml-1 text-xs">({quantidade})</span>
                    </span>
                    <span className="font-semibold text-red-600">- {formatCurrency(valor)}</span>
                  </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Diferença da troca devolvida ao cliente. Não é receita nem despesa: não muda os totais acima.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
