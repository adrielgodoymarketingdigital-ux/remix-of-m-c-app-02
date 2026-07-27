import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentidade, applyEmpresaFilter } from "@/hooks/useResolvedUserId";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { FiltrosPeriodo } from "./FiltroPeriodoAvancado";

interface SecaoLucratividadePorServicoProps {
  filtros: FiltrosPeriodo;
}

interface OSComTempo {
  id: string;
  numero_os: string;
  cliente_nome: string;
  total: number;
  tempoGastoHoras: number;
  custoMaoDeObra: number;
  lucroReal: number;
}

const formatarTempo = (horas: number): string => {
  const totalMinutos = Math.round(horas * 60);
  const h = Math.floor(totalMinutos / 60);
  const min = totalMinutos % 60;

  if (h === 0) return `${min}min`;
  if (min === 0) return `${h}h`;
  return `${h}h${String(min).padStart(2, "0")}`;
};

// Serviço pouco compensador: lucro real negativo ou abaixo de 20% do valor cobrado
const LIMIAR_LUCRO_BAIXO = 0.2;

export function SecaoLucratividadePorServico({ filtros }: SecaoLucratividadePorServicoProps) {
  const { userId, empresaId, carregando: identidadeCarregando, isFilial } = useIdentidade();
  const { config: configuracaoLoja } = useConfiguracaoLoja();
  const [ordensComTempo, setOrdensComTempo] = useState<OSComTempo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (identidadeCarregando || !userId) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, empresaId, identidadeCarregando, filtros.dataInicio, filtros.dataFim, configuracaoLoja?.valor_hora_referencia]);

  const carregar = async () => {
    const valorHora = configuracaoLoja?.valor_hora_referencia;
    if (!valorHora || valorHora <= 0) {
      setOrdensComTempo([]);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("ordens_servico")
        .select(`
          id,
          numero_os,
          total,
          tempo_gasto_horas,
          cliente:clientes!ordens_servico_cliente_fkey(nome)
        `)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .in("status", ["finalizado", "entregue", "garantia"])
        .not("tempo_gasto_horas", "is", null)
        .gt("tempo_gasto_horas", 0);

      if (filtros.dataInicio) query = query.gte("data_saida", filtros.dataInicio);
      if (filtros.dataFim) query = query.lte("data_saida", `${filtros.dataFim}T23:59:59`);

      query = applyEmpresaFilter(query, empresaId, isFilial);

      const { data, error } = await query;
      if (error) throw error;

      const processadas: OSComTempo[] = (data || []).map((ordem: any) => {
        const tempoGastoHoras = Number(ordem.tempo_gasto_horas || 0);
        const total = Number(ordem.total || 0);
        const custoMaoDeObra = tempoGastoHoras * valorHora;
        const lucroReal = total - custoMaoDeObra;

        return {
          id: ordem.id,
          numero_os: ordem.numero_os,
          cliente_nome: ordem.cliente?.nome || "—",
          total,
          tempoGastoHoras,
          custoMaoDeObra,
          lucroReal,
        };
      });

      processadas.sort((a, b) => a.lucroReal - b.lucroReal);
      setOrdensComTempo(processadas);
    } catch (error) {
      console.error("Erro ao carregar lucratividade por serviço:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!loading && ordensComTempo.length === 0) return null;

  const somaLucroReal = ordensComTempo.reduce((acc, o) => acc + o.lucroReal, 0);
  const somaHoras = ordensComTempo.reduce((acc, o) => acc + o.tempoGastoHoras, 0);
  const lucroRealMedioPorHora = somaHoras > 0 ? somaLucroReal / somaHoras : 0;

  const ehPoucoCompensador = (os: OSComTempo) =>
    os.lucroReal < 0 || (os.total > 0 && os.lucroReal < os.total * LIMIAR_LUCRO_BAIXO);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Lucratividade por Serviço</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : (
          <>
            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">Lucro real médio por hora trabalhada</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(lucroRealMedioPorHora)}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="pb-2 pr-2 font-medium">OS</th>
                    <th className="pb-2 pr-2 font-medium">Cliente</th>
                    <th className="pb-2 pr-2 font-medium text-right">Valor</th>
                    <th className="pb-2 pr-2 font-medium text-right">Tempo</th>
                    <th className="pb-2 pr-2 font-medium text-right">Custo M.O.</th>
                    <th className="pb-2 font-medium text-right">Lucro Real</th>
                  </tr>
                </thead>
                <tbody>
                  {ordensComTempo.map((os) => {
                    const destacar = ehPoucoCompensador(os);
                    return (
                      <tr
                        key={os.id}
                        className={cn(
                          "border-b last:border-0",
                          destacar && "bg-red-50 dark:bg-red-950/20"
                        )}
                      >
                        <td className="py-2 pr-2 font-mono text-xs">#{os.numero_os}</td>
                        <td className="py-2 pr-2 truncate max-w-[140px]">{os.cliente_nome}</td>
                        <td className="py-2 pr-2 text-right">{formatCurrency(os.total)}</td>
                        <td className="py-2 pr-2 text-right whitespace-nowrap">
                          {formatarTempo(os.tempoGastoHoras)}
                        </td>
                        <td className="py-2 pr-2 text-right">{formatCurrency(os.custoMaoDeObra)}</td>
                        <td
                          className={cn(
                            "py-2 text-right font-semibold flex items-center justify-end gap-1",
                            destacar ? "text-red-600 dark:text-red-400" : "text-foreground"
                          )}
                        >
                          {destacar && <TrendingDown className="h-3 w-3 shrink-0" />}
                          {formatCurrency(os.lucroReal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
