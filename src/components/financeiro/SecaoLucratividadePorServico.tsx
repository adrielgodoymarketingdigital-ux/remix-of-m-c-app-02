import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  servico_id: string | null;
  servico_nome: string;
  total: number;
  tempoGastoHoras: number;
  custoMaoDeObra: number;
  lucroReal: number;
}

interface ServicoCatalogo {
  nome: string;
  preco: number;
  tempoEstimadoHoras: number;
}

interface GrupoServico {
  servicoId: string;
  nome: string;
  qtdOS: number;
  qtdOSComTempoReal: number;
  lucroHoraReal: number | null;
  lucroHoraEstimado: number | null;
  ehEstimado: boolean;
  tempoMedioRealHoras: number | null;
  tempoMedioEstimadoHoras: number | null;
  precoMedioReal: number | null;
}

// Serviço pouco compensador: lucro/hora real negativo ou abaixo de 20% do preço médio cobrado
const LIMIAR_LUCRO_BAIXO = 0.2;

export const formatarTempo = (horas: number): string => {
  const totalMinutos = Math.round(horas * 60);
  const h = Math.floor(totalMinutos / 60);
  const min = totalMinutos % 60;

  if (h === 0) return `${min}min`;
  if (min === 0) return `${h}h`;
  return `${h}h${String(min).padStart(2, "0")}`;
};

const QTD_RANKING = 5;

export function SecaoLucratividadePorServico({ filtros }: SecaoLucratividadePorServicoProps) {
  const { userId, empresaId, carregando: identidadeCarregando, isFilial } = useIdentidade();
  const { config: configuracaoLoja } = useConfiguracaoLoja();
  const [ordensComTempo, setOrdensComTempo] = useState<OSComTempo[]>([]);
  const [catalogoServicos, setCatalogoServicos] = useState<Map<string, ServicoCatalogo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [servicoSelecionadoId, setServicoSelecionadoId] = useState<string>("");

  useEffect(() => {
    if (identidadeCarregando || !userId) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, empresaId, identidadeCarregando, filtros.dataInicio, filtros.dataFim, configuracaoLoja?.valor_hora_referencia]);

  const carregar = async () => {
    const valorHora = configuracaoLoja?.valor_hora_referencia;
    if (!valorHora || valorHora <= 0) {
      setOrdensComTempo([]);
      setCatalogoServicos(new Map());
      return;
    }

    setLoading(true);
    try {
      // Tempos médios estimados cadastrados no catálogo de serviços (para fallback
      // quando um tipo de serviço ainda não tem nenhuma OS com tempo real). O preço
      // de catálogo serve de referência de receita para estimar o lucro/hora quando
      // não há nenhuma OS real desse serviço no período.
      let queryServicos = supabase
        .from("servicos")
        .select("id, nome, preco, tempo_medio_estimado_horas")
        .eq("user_id", userId)
        .not("tempo_medio_estimado_horas", "is", null);
      queryServicos = applyEmpresaFilter(queryServicos, empresaId, isFilial);

      let query = supabase
        .from("ordens_servico")
        .select(`
          id,
          numero_os,
          total,
          tempo_gasto_horas,
          servico_id,
          servico:servicos!ordens_servico_servico_id_fkey(id, nome)
        `)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .in("status", ["finalizado", "entregue", "garantia"])
        .not("tempo_gasto_horas", "is", null)
        .gt("tempo_gasto_horas", 0);

      if (filtros.dataInicio) query = query.gte("data_saida", filtros.dataInicio);
      if (filtros.dataFim) query = query.lte("data_saida", `${filtros.dataFim}T23:59:59`);

      query = applyEmpresaFilter(query, empresaId, isFilial);

      const [{ data, error }, { data: servicosData, error: servicosError }] = await Promise.all([
        query,
        queryServicos,
      ]);
      if (error) throw error;
      if (servicosError) throw servicosError;

      const mapaCatalogo = new Map<string, ServicoCatalogo>();
      (servicosData || []).forEach((s: any) => {
        if (s.tempo_medio_estimado_horas != null) {
          mapaCatalogo.set(s.id, {
            nome: s.nome,
            preco: Number(s.preco || 0),
            tempoEstimadoHoras: Number(s.tempo_medio_estimado_horas),
          });
        }
      });
      setCatalogoServicos(mapaCatalogo);

      const processadas: OSComTempo[] = (data || []).map((ordem: any) => {
        const tempoGastoHoras = Number(ordem.tempo_gasto_horas || 0);
        const total = Number(ordem.total || 0);
        const custoMaoDeObra = tempoGastoHoras * valorHora;
        const lucroReal = total - custoMaoDeObra;

        return {
          id: ordem.id,
          numero_os: ordem.numero_os,
          servico_id: ordem.servico_id || null,
          servico_nome: ordem.servico?.nome || "Sem tipo de serviço definido",
          total,
          tempoGastoHoras,
          custoMaoDeObra,
          lucroReal,
        };
      });

      setOrdensComTempo(processadas);
    } catch (error) {
      console.error("Erro ao carregar lucratividade por serviço:", error);
    } finally {
      setLoading(false);
    }
  };

  const valorHora = configuracaoLoja?.valor_hora_referencia || 0;

  // Agrupa as OS com tempo real por tipo de serviço. Serviços cadastrados com
  // tempo estimado mas SEM nenhuma OS real ainda também entram na lista (para
  // aparecerem no filtro de busca e no detalhamento), marcados como estimativa,
  // usando o preço de venda cadastrado no catálogo como referência de receita.
  const gruposServico = useMemo<GrupoServico[]>(() => {
    const porServico = new Map<string, OSComTempo[]>();
    ordensComTempo.forEach((os) => {
      if (!os.servico_id) return;
      const lista = porServico.get(os.servico_id) || [];
      lista.push(os);
      porServico.set(os.servico_id, lista);
    });

    const idsConhecidos = new Set<string>([...porServico.keys(), ...catalogoServicos.keys()]);
    const nomesPorId = new Map<string, string>();
    ordensComTempo.forEach((os) => {
      if (os.servico_id) nomesPorId.set(os.servico_id, os.servico_nome);
    });

    const grupos: GrupoServico[] = [];
    idsConhecidos.forEach((servicoId) => {
      const osDoServico = porServico.get(servicoId) || [];
      const catalogo = catalogoServicos.get(servicoId) || null;
      const tempoEstimado = catalogo?.tempoEstimadoHoras ?? null;

      const somaLucroReal = osDoServico.reduce((acc, o) => acc + o.lucroReal, 0);
      const somaHorasReal = osDoServico.reduce((acc, o) => acc + o.tempoGastoHoras, 0);
      const temDadosReais = osDoServico.length > 0 && somaHorasReal > 0;

      const lucroHoraReal = temDadosReais ? somaLucroReal / somaHorasReal : null;
      const tempoMedioRealHoras = temDadosReais ? somaHorasReal / osDoServico.length : null;
      const precoMedioReal =
        osDoServico.length > 0
          ? osDoServico.reduce((acc, o) => acc + o.total, 0) / osDoServico.length
          : null;

      // Estimativa: usa o preço médio das OS reais desse serviço quando houver,
      // senão cai para o preço de venda cadastrado no catálogo como referência.
      let lucroHoraEstimado: number | null = null;
      if (!temDadosReais && tempoEstimado != null && tempoEstimado > 0) {
        const precoReferencia = precoMedioReal ?? catalogo?.preco ?? 0;
        const custoEstimado = tempoEstimado * valorHora;
        lucroHoraEstimado = (precoReferencia - custoEstimado) / tempoEstimado;
      }

      grupos.push({
        servicoId,
        nome: nomesPorId.get(servicoId) || catalogo?.nome || "Serviço cadastrado",
        qtdOS: osDoServico.length,
        qtdOSComTempoReal: osDoServico.length,
        lucroHoraReal,
        lucroHoraEstimado,
        ehEstimado: !temDadosReais,
        tempoMedioRealHoras,
        tempoMedioEstimadoHoras: tempoEstimado,
        precoMedioReal,
      });
    });

    return grupos;
  }, [ordensComTempo, catalogoServicos, valorHora]);

  if (!loading && gruposServico.length === 0) return null;

  // Ranking "compensa/não compensa": só considera grupos com pelo menos 1 OS
  // com tempo REAL registrado — nunca ranquear como "não compensa" com base
  // só em estimativa que ninguém validou na prática ainda.
  const gruposComDadoReal = gruposServico.filter((g) => g.lucroHoraReal != null);
  const maisLucrativos = [...gruposComDadoReal]
    .sort((a, b) => (b.lucroHoraReal as number) - (a.lucroHoraReal as number))
    .slice(0, QTD_RANKING);
  const menosLucrativos = [...gruposComDadoReal]
    .sort((a, b) => (a.lucroHoraReal as number) - (b.lucroHoraReal as number))
    .slice(0, QTD_RANKING);

  const gruposOrdenadosParaLista = [...gruposServico].sort((a, b) => {
    const valorA = a.lucroHoraReal ?? a.lucroHoraEstimado ?? 0;
    const valorB = b.lucroHoraReal ?? b.lucroHoraEstimado ?? 0;
    return valorA - valorB;
  });

  const grupoSelecionado = gruposServico.find((g) => g.servicoId === servicoSelecionadoId) || null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Lucratividade por Serviço</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          Mostramos quanto você lucra, em média, por hora trabalhada em cada tipo de serviço.
          Quanto maior o valor, mais vale a pena investir tempo nesse serviço.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : (
          <>
            {/* Cards Compensa / Não compensa */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                    Mais lucrativos
                  </p>
                </div>
                {maisLucrativos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Ainda sem dados reais suficientes.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {maisLucrativos.map((g) => (
                      <li key={g.servicoId} className="flex justify-between text-sm gap-2">
                        <span className="truncate">{g.nome}</span>
                        <span className="font-semibold text-green-700 dark:text-green-400 whitespace-nowrap">
                          {formatCurrency(g.lucroHoraReal as number)}/h
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                    Menos lucrativos
                  </p>
                </div>
                {menosLucrativos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Ainda sem dados reais suficientes.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {menosLucrativos.map((g) => (
                      <li key={g.servicoId} className="flex justify-between text-sm gap-2">
                        <span className="truncate">{g.nome}</span>
                        <span className="font-semibold text-red-700 dark:text-red-400 whitespace-nowrap">
                          {formatCurrency(g.lucroHoraReal as number)}/h
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Filtro de busca por tipo de serviço */}
            <div className="space-y-2">
              <Select value={servicoSelecionadoId} onValueChange={setServicoSelecionadoId}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Buscar um tipo de serviço específico..." />
                </SelectTrigger>
                <SelectContent>
                  {gruposServico.map((g) => (
                    <SelectItem key={g.servicoId} value={g.servicoId}>
                      {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {grupoSelecionado && (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{grupoSelecionado.nome}</p>
                    <span className="text-xs text-muted-foreground">
                      {grupoSelecionado.qtdOS} OS no período
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Lucro/hora</p>
                      {grupoSelecionado.lucroHoraReal != null ? (
                        <p className="font-bold text-primary">
                          {formatCurrency(grupoSelecionado.lucroHoraReal)}
                        </p>
                      ) : grupoSelecionado.lucroHoraEstimado != null ? (
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-primary">
                            {formatCurrency(grupoSelecionado.lucroHoraEstimado)}
                          </p>
                          <Badge variant="secondary" className="text-[10px]">Estimativa</Badge>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-xs">Sem dados suficientes</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Tempo médio</p>
                      <div className="space-y-0.5">
                        {grupoSelecionado.tempoMedioRealHoras != null && (
                          <p>
                            {formatarTempo(grupoSelecionado.tempoMedioRealHoras)}{" "}
                            <span className="text-xs text-muted-foreground">(real)</span>
                          </p>
                        )}
                        {grupoSelecionado.tempoMedioEstimadoHoras != null && (
                          <p>
                            {formatarTempo(grupoSelecionado.tempoMedioEstimadoHoras)}{" "}
                            <span className="text-xs text-muted-foreground">(estimado no cadastro)</span>
                          </p>
                        )}
                        {grupoSelecionado.tempoMedioRealHoras == null &&
                          grupoSelecionado.tempoMedioEstimadoHoras == null && (
                            <p className="text-muted-foreground text-xs">—</p>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Lista agrupada por tipo de serviço */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="pb-2 pr-2 font-medium">Tipo de Serviço</th>
                    <th className="pb-2 pr-2 font-medium text-right">Qtd. OS</th>
                    <th className="pb-2 pr-2 font-medium text-right">Tempo médio</th>
                    <th className="pb-2 font-medium text-right">Lucro/hora</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposOrdenadosParaLista.map((g) => {
                    const lucroExibido = g.lucroHoraReal ?? g.lucroHoraEstimado;
                    // Destaque visual só com base em dado REAL — nunca marcar um
                    // serviço como "pouco compensador" usando apenas estimativa.
                    const destacar =
                      g.lucroHoraReal != null &&
                      (g.lucroHoraReal < 0 ||
                        (g.precoMedioReal != null &&
                          g.precoMedioReal > 0 &&
                          g.lucroHoraReal < g.precoMedioReal * LIMIAR_LUCRO_BAIXO));
                    const tempoExibido = g.tempoMedioRealHoras ?? g.tempoMedioEstimadoHoras;

                    return (
                      <tr
                        key={g.servicoId}
                        className={cn(
                          "border-b last:border-0",
                          destacar && "bg-red-50 dark:bg-red-950/20"
                        )}
                      >
                        <td className="py-2 pr-2 truncate max-w-[180px]">{g.nome}</td>
                        <td className="py-2 pr-2 text-right">{g.qtdOS}</td>
                        <td className="py-2 pr-2 text-right whitespace-nowrap">
                          {tempoExibido != null ? formatarTempo(tempoExibido) : "—"}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {lucroExibido != null ? (
                              <span
                                className={cn(
                                  "font-semibold",
                                  destacar ? "text-red-600 dark:text-red-400" : "text-foreground"
                                )}
                              >
                                {formatCurrency(lucroExibido)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                            {g.ehEstimado && g.lucroHoraEstimado != null && (
                              <Badge variant="secondary" className="text-[10px]">Estimativa</Badge>
                            )}
                          </div>
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
