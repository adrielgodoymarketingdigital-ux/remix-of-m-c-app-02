import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Funcionario, ComissaoTipo, ComissaoEscopo, ComissaoCargo } from "@/types/funcionario";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export interface ComissaoFuncionario {
  funcionarioId: string;
  nome: string;
  cargo: string | null;
  comissaoTipo: ComissaoTipo | null;
  comissaoValor: number;
  comissaoEscopo: ComissaoEscopo | null;
  comissoesPorCargo: Record<string, ComissaoCargo> | null;
  totalVendasProdutos: number;
  totalVendasDispositivos: number;
  totalVendas: number;
  totalServicos: number;
  quantidadeVendas: number;
  quantidadeOS: number;
  comissaoCalculada: number;
  detalhePorCargo: { cargo: string; comissao: number; base: number }[];
}

function calcularComissaoEscopo(
  escopo: ComissaoEscopo | string,
  tipo: ComissaoTipo | string,
  valor: number,
  vendasProdutos: number,
  vendasDispositivos: number,
  totalServicos: number,
  qtdVendas: number,
  qtdOS: number,
): number {
  let base = 0;
  let quantidade = 0;

  switch (escopo) {
    case "vendas_produtos":
      base = vendasProdutos;
      quantidade = qtdVendas;
      break;
    case "vendas_dispositivos":
      base = vendasDispositivos;
      quantidade = qtdVendas;
      break;
    case "vendas_todos":
      base = vendasProdutos + vendasDispositivos;
      quantidade = qtdVendas;
      break;
    case "servicos_os":
      base = totalServicos;
      quantidade = qtdOS;
      break;
    case "tudo":
    default:
      base = vendasProdutos + vendasDispositivos + totalServicos;
      quantidade = qtdVendas + qtdOS;
      break;
  }

  if (tipo === "porcentagem") {
    return base * (valor / 100);
  }
  return quantidade * valor;
}

function calcularComissao(
  f: Funcionario,
  vendasProdutos: number,
  vendasDispositivos: number,
  totalServicos: number,
  qtdVendas: number,
  qtdOS: number,
): { total: number; detalhes: { cargo: string; comissao: number; base: number }[] } {
  const detalhes: { cargo: string; comissao: number; base: number }[] = [];

  // Use per-cargo commissions if available
  if (f.comissoes_por_cargo && Object.keys(f.comissoes_por_cargo).length > 0) {
    let total = 0;
    Object.entries(f.comissoes_por_cargo).forEach(([cargo, config]) => {
      if (!config.tipo || !config.valor) return;
      const comissao = calcularComissaoEscopo(
        config.escopo, config.tipo, config.valor,
        vendasProdutos, vendasDispositivos, totalServicos, qtdVendas, qtdOS,
      );
      total += comissao;
      detalhes.push({ cargo, comissao, base: config.valor });
    });
    return { total, detalhes };
  }

  // Legacy: single commission
  if (!f.comissao_tipo || !f.comissao_valor) return { total: 0, detalhes: [] };

  const comissao = calcularComissaoEscopo(
    f.comissao_escopo || "tudo", f.comissao_tipo, f.comissao_valor,
    vendasProdutos, vendasDispositivos, totalServicos, qtdVendas, qtdOS,
  );
  detalhes.push({ cargo: f.cargo?.split(",")[0]?.trim() || "Geral", comissao, base: f.comissao_valor });
  return { total: comissao, detalhes };
}

export function useComissoes(funcionarios: Funcionario[], mes?: Date) {
  const mesRef = mes || new Date();
  const inicio = startOfMonth(mesRef).toISOString();
  const fim = endOfMonth(mesRef).toISOString();

  const mesAnteriorRef = subMonths(mesRef, 1);
  const inicioAnterior = startOfMonth(mesAnteriorRef).toISOString();
  const fimAnterior = endOfMonth(mesAnteriorRef).toISOString();

  const funcionarioIds = funcionarios.map((f) => f.id);

  const { data, isLoading } = useQuery({
    queryKey: ["comissoes", funcionarioIds, inicio, fim],
    queryFn: async () => {
      if (!funcionarioIds.length) return { atual: [], anterior: [], totalComissoes: 0, totalVendido: 0 };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { atual: [], anterior: [], totalComissoes: 0, totalVendido: 0 };

      const idsCriacao = funcionarios
        .filter((f) => !f.base_comissao || f.base_comissao === "criacao")
        .map((f) => f.id);
      const idsEntrega = funcionarios
        .filter((f) => f.base_comissao === "entrega")
        .map((f) => f.id);

      const { data: vendasMes } = await supabase
        .from("vendas")
        .select("funcionario_id, total, quantidade, tipo")
        .eq("user_id", user.id)
        .in("funcionario_id", funcionarioIds)
        .gte("data", inicio)
        .lte("data", fim)
        .eq("cancelada", false)
        // Exclui registros auxiliares de pagamento duplo (não representam vendas reais)
        .or("observacoes.is.null,observacoes.neq.pagamento_duplo_secundario");

      const [osCriacao, osEntrega] = await Promise.all([
        idsCriacao.length > 0
          ? supabase
              .from("ordens_servico")
              .select("funcionario_id, total")
              .eq("user_id", user.id)
              .is("deleted_at", null)
              .in("funcionario_id", idsCriacao)
              .in("status", ["entregue"])
              .gte("created_at", inicio)
              .lte("created_at", fim)
              .then((r) => r.data || [])
          : Promise.resolve([]),
        idsEntrega.length > 0
          ? supabase
              .from("ordens_servico")
              .select("funcionario_id, total")
              .eq("user_id", user.id)
              .is("deleted_at", null)
              .in("funcionario_id", idsEntrega)
              .in("status", ["entregue"])
              .not("data_saida", "is", null)
              .gte("data_saida", inicio)
              .lte("data_saida", fim)
              .then((r) => r.data || [])
          : Promise.resolve([]),
      ]);

      const osMes = [...osCriacao, ...osEntrega];

      const { data: vendasAnterior } = await supabase
        .from("vendas")
        .select("funcionario_id, total, quantidade, tipo")
        .eq("user_id", user.id)
        .in("funcionario_id", funcionarioIds)
        .gte("data", inicioAnterior)
        .lte("data", fimAnterior)
        .eq("cancelada", false)
        .or("observacoes.is.null,observacoes.neq.pagamento_duplo_secundario");

      const processar = (vendas: any[], ordens: any[]) => {
        return funcionarios.map((f) => {
          const vendasFunc = (vendas || []).filter((v: any) => v.funcionario_id === f.id);
          const osFunc = (ordens || []).filter((o: any) => o.funcionario_id === f.id);

          const totalVendasProdutos = vendasFunc
            .filter((v: any) => v.tipo === "produto" || v.tipo === "peca")
            .reduce((acc: number, v: any) => acc + Number(v.total), 0);

          const totalVendasDispositivos = vendasFunc
            .filter((v: any) => v.tipo === "dispositivo")
            .reduce((acc: number, v: any) => acc + Number(v.total), 0);

          const totalServicos = osFunc.reduce((acc: number, o: any) => acc + Number(o.total || 0), 0);
          const quantidadeVendas = vendasFunc.length;
          const quantidadeOS = osFunc.length;

          const { total: comissaoCalculada, detalhes: detalhePorCargo } = calcularComissao(
            f, totalVendasProdutos, totalVendasDispositivos, totalServicos, quantidadeVendas, quantidadeOS
          );

          return {
            funcionarioId: f.id,
            nome: f.nome,
            cargo: f.cargo,
            comissaoTipo: f.comissao_tipo,
            comissaoValor: f.comissao_valor,
            comissaoEscopo: f.comissao_escopo,
            comissoesPorCargo: f.comissoes_por_cargo,
            totalVendasProdutos,
            totalVendasDispositivos,
            totalVendas: totalVendasProdutos + totalVendasDispositivos,
            totalServicos,
            quantidadeVendas,
            quantidadeOS,
            comissaoCalculada,
            detalhePorCargo,
          } as ComissaoFuncionario;
        });
      };

      const atual = processar(vendasMes || [], osMes);
      const anterior = processar(vendasAnterior || [], []);

      return {
        atual,
        anterior,
        totalComissoes: atual.reduce((acc, c) => acc + c.comissaoCalculada, 0),
        totalVendido: atual.reduce((acc, c) => acc + c.totalVendas + c.totalServicos, 0),
      };
    },
    enabled: funcionarioIds.length > 0,
  });

  return {
    comissoes: data?.atual || [],
    comissoesAnterior: data?.anterior || [],
    totalComissoes: data?.totalComissoes || 0,
    totalVendido: data?.totalVendido || 0,
    carregando: isLoading,
  };
}

export interface PontoSerieMensalComissoes {
  mes: string; // yyyy-MM
  totalVendido: number;
  totalComissoes: number;
}

/**
 * Série mensal (últimos `meses` meses, incluindo o mês de referência) de
 * Total Vendido e Comissões a Pagar da equipe — para sparkline e variação
 * percentual na aba Desempenho. Busca vendas/OS do período inteiro numa
 * query só (mais barato que N queries de 1 mês) e agrega em memória por mês,
 * reaproveitando calcularComissao para não duplicar a regra de comissão.
 */
export function useComissoesSerieMensal(funcionarios: Funcionario[], mesRef: Date, meses: number = 6) {
  const funcionarioIds = funcionarios.map((f) => f.id);
  const inicioSerie = startOfMonth(subMonths(mesRef, meses - 1)).toISOString();
  const fimSerie = endOfMonth(mesRef).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["comissoes-serie-mensal", funcionarioIds, inicioSerie, fimSerie],
    queryFn: async (): Promise<PontoSerieMensalComissoes[]> => {
      if (!funcionarioIds.length) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const idsCriacao = funcionarios
        .filter((f) => !f.base_comissao || f.base_comissao === "criacao")
        .map((f) => f.id);
      const idsEntrega = funcionarios
        .filter((f) => f.base_comissao === "entrega")
        .map((f) => f.id);

      const { data: vendasPeriodo } = await supabase
        .from("vendas")
        .select("funcionario_id, total, quantidade, tipo, data")
        .eq("user_id", user.id)
        .in("funcionario_id", funcionarioIds)
        .gte("data", inicioSerie)
        .lte("data", fimSerie)
        .eq("cancelada", false)
        .or("observacoes.is.null,observacoes.neq.pagamento_duplo_secundario");

      const [osCriacaoPeriodo, osEntregaPeriodo] = await Promise.all([
        idsCriacao.length > 0
          ? supabase
              .from("ordens_servico")
              .select("funcionario_id, total, created_at")
              .eq("user_id", user.id)
              .is("deleted_at", null)
              .in("funcionario_id", idsCriacao)
              .in("status", ["entregue"])
              .gte("created_at", inicioSerie)
              .lte("created_at", fimSerie)
              .then((r) => r.data || [])
          : Promise.resolve([]),
        idsEntrega.length > 0
          ? supabase
              .from("ordens_servico")
              .select("funcionario_id, total, data_saida")
              .eq("user_id", user.id)
              .is("deleted_at", null)
              .in("funcionario_id", idsEntrega)
              .in("status", ["entregue"])
              .not("data_saida", "is", null)
              .gte("data_saida", inicioSerie)
              .lte("data_saida", fimSerie)
              .then((r) => r.data || [])
          : Promise.resolve([]),
      ]);

      const pontos: PontoSerieMensalComissoes[] = [];
      for (let i = meses - 1; i >= 0; i--) {
        const mesAtualRef = subMonths(mesRef, i);
        const inicioMes = startOfMonth(mesAtualRef);
        const fimMes = endOfMonth(mesAtualRef);

        const vendasMes = (vendasPeriodo || []).filter((v: any) => {
          const d = new Date(v.data);
          return d >= inicioMes && d <= fimMes;
        });
        const osMes = [
          ...osCriacaoPeriodo.filter((o: any) => {
            const d = new Date(o.created_at);
            return d >= inicioMes && d <= fimMes;
          }),
          ...osEntregaPeriodo.filter((o: any) => {
            const d = new Date(o.data_saida);
            return d >= inicioMes && d <= fimMes;
          }),
        ];

        let totalVendidoMes = 0;
        let totalComissoesMes = 0;

        funcionarios.forEach((f) => {
          const vendasFunc = vendasMes.filter((v: any) => v.funcionario_id === f.id);
          const osFunc = osMes.filter((o: any) => o.funcionario_id === f.id);

          const totalVendasProdutos = vendasFunc
            .filter((v: any) => v.tipo === "produto" || v.tipo === "peca")
            .reduce((acc: number, v: any) => acc + Number(v.total), 0);
          const totalVendasDispositivos = vendasFunc
            .filter((v: any) => v.tipo === "dispositivo")
            .reduce((acc: number, v: any) => acc + Number(v.total), 0);
          const totalServicos = osFunc.reduce((acc: number, o: any) => acc + Number(o.total || 0), 0);
          const quantidadeVendas = vendasFunc.length;
          const quantidadeOS = osFunc.length;

          const { total: comissaoCalculada } = calcularComissao(
            f, totalVendasProdutos, totalVendasDispositivos, totalServicos, quantidadeVendas, quantidadeOS
          );

          totalVendidoMes += totalVendasProdutos + totalVendasDispositivos + totalServicos;
          totalComissoesMes += comissaoCalculada;
        });

        pontos.push({
          mes: format(mesAtualRef, "yyyy-MM"),
          totalVendido: totalVendidoMes,
          totalComissoes: totalComissoesMes,
        });
      }

      return pontos;
    },
    enabled: funcionarioIds.length > 0,
  });

  return {
    serieMensal: data || [],
    carregando: isLoading,
  };
}
