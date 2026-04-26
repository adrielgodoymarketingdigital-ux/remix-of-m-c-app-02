import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Funcionario, ComissaoTipo, ComissaoEscopo, ComissaoCargo } from "@/types/funcionario";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

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

      const { data: vendasMes } = await supabase
        .from("vendas")
        .select("funcionario_id, total, quantidade, tipo")
        .eq("user_id", user.id)
        .in("funcionario_id", funcionarioIds)
        .gte("data", inicio)
        .lte("data", fim)
        .eq("cancelada", false);

      const { data: osMes } = await supabase
        .from("ordens_servico")
        .select("funcionario_id, total")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .in("funcionario_id", funcionarioIds)
        .in("status", ["finalizado", "entregue"])
        .gte("updated_at", inicio)
        .lte("updated_at", fim);

      const { data: vendasAnterior } = await supabase
        .from("vendas")
        .select("funcionario_id, total, quantidade, tipo")
        .eq("user_id", user.id)
        .in("funcionario_id", funcionarioIds)
        .gte("data", inicioAnterior)
        .lte("data", fimAnterior)
        .eq("cancelada", false);

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

      const atual = processar(vendasMes || [], osMes || []);
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
