import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Funcionario, ComissaoTipo, ComissaoEscopo, ComissaoCargo } from "@/types/funcionario";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { comissaoOsDoSnapshot } from "@/lib/comissao/comissaoOsDoSnapshot";

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
  /** true quando a parte de OS veio do snapshot do Sistema B (tem "Comissão por Tipo de Serviço") */
  comissaoOSViaSnapshot: boolean;
  detalhePorCargo: { cargo: string; comissao: number; base: number }[];
}

const ESCOPOS_DE_OS = new Set(["servicos_os", "tudo"]);

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

interface DetalheComissao {
  cargo: string;
  comissao: number;
  base: number;
  escopo: ComissaoEscopo | string;
}

interface ResultadoSistemaA {
  total: number;
  /** parte da comissão que incide só sobre vendas (serviços/OS zerados) */
  parteVendas: number;
  /** parte da comissão que incide só sobre serviços/OS (vendas zeradas) */
  parteOS: number;
  detalhes: DetalheComissao[];
}

/**
 * Sistema A (escopo/cargo). Devolve `total` e as duas metades `parteVendas` /
 * `parteOS` — obtidas zerando o outro lado. A separação é algebricamente
 * idêntica ao total: `(vP+vD+tS)×% = vP×% + vD×% + tS×%` e
 * `(qV+qOS)×fixo = qV×fixo + qOS×fixo`. A Fase 2 substitui a `parteOS` pelo
 * snapshot do Sistema B para quem tem "Comissão por Tipo de Serviço".
 */
function calcularComissaoSistemaA(
  f: Funcionario,
  vendasProdutos: number,
  vendasDispositivos: number,
  totalServicos: number,
  qtdVendas: number,
  qtdOS: number,
): ResultadoSistemaA {
  const detalhes: DetalheComissao[] = [];

  const um = (
    escopo: ComissaoEscopo | string,
    tipo: ComissaoTipo | string,
    valor: number,
    vp: number, vd: number, ts: number, qv: number, qos: number,
  ) => calcularComissaoEscopo(escopo, tipo, valor, vp, vd, ts, qv, qos);

  // comissões por cargo (formato atual)
  if (f.comissoes_por_cargo && Object.keys(f.comissoes_por_cargo).length > 0) {
    let total = 0, parteVendas = 0, parteOS = 0;
    Object.entries(f.comissoes_por_cargo).forEach(([cargo, config]) => {
      if (!config.tipo || !config.valor) return;
      total += um(config.escopo, config.tipo, config.valor, vendasProdutos, vendasDispositivos, totalServicos, qtdVendas, qtdOS);
      parteVendas += um(config.escopo, config.tipo, config.valor, vendasProdutos, vendasDispositivos, 0, qtdVendas, 0);
      parteOS += um(config.escopo, config.tipo, config.valor, 0, 0, totalServicos, 0, qtdOS);
      detalhes.push({ cargo, comissao: um(config.escopo, config.tipo, config.valor, vendasProdutos, vendasDispositivos, totalServicos, qtdVendas, qtdOS), base: config.valor, escopo: config.escopo });
    });
    return { total, parteVendas, parteOS, detalhes };
  }

  // legado: comissão única
  if (!f.comissao_tipo || !f.comissao_valor) {
    return { total: 0, parteVendas: 0, parteOS: 0, detalhes: [] };
  }
  const escopo = f.comissao_escopo || "tudo";
  const total = um(escopo, f.comissao_tipo, f.comissao_valor, vendasProdutos, vendasDispositivos, totalServicos, qtdVendas, qtdOS);
  const parteVendas = um(escopo, f.comissao_tipo, f.comissao_valor, vendasProdutos, vendasDispositivos, 0, qtdVendas, 0);
  const parteOS = um(escopo, f.comissao_tipo, f.comissao_valor, 0, 0, totalServicos, 0, qtdOS);
  detalhes.push({ cargo: f.cargo?.split(",")[0]?.trim() || "Geral", comissao: total, base: f.comissao_valor, escopo });
  return { total, parteVendas, parteOS, detalhes };
}

// --- shape mínimo das linhas que buscamos ---
interface OSRow {
  id: string;
  funcionario_id: string | null;
  status: string | null;
  total: number | null;
  created_at: string | null;
  data_saida: string | null;
  comissao_calculada_snapshot: number | null;
}
interface OSTecnicoRow {
  os_id: string;
  funcionario_id: string;
  comissao_calculada_snapshot: number | null;
}
interface VendaRow {
  funcionario_id: string | null;
  total: number | null;
  tipo: string | null;
  data?: string | null;
}

const OS_SELECT = "id, funcionario_id, status, total, created_at, data_saida, comissao_calculada_snapshot";

function campoDataDe(f: Funcionario): "data_saida" | "created_at" {
  return f.base_comissao === "entrega" ? "data_saida" : "created_at";
}

/**
 * Comissão de OS de um funcionário num intervalo:
 *  - tem config de Tipo de Serviço → soma os snapshots (Sistema B), EXATAMENTE
 *    como o Perfil de Desempenho (useDesempenhoFuncionario + resolverComissaoOS):
 *    só OS em que o funcionário é o Técnico Principal (funcionario_id), com as
 *    linhas de os_tecnicos DELE naquela OS. OS em que ele é só os_tecnico de
 *    terceiros ficam de fora aqui e no Perfil — é lacuna pré-existente, medida
 *    como R$ 0 de impacto (R2).
 *  - não tem                       → usa a parteOS do Sistema A (escopo/cargo).
 */
function comissaoOSNoPeriodo(
  f: Funcionario,
  temConfig: boolean,
  parteOSSistemaA: number,
  osPrincipalNoMes: OSRow[],
  tecnicosPorFuncOS: Map<string, OSTecnicoRow[]>,
): number {
  if (!temConfig) return parteOSSistemaA;

  let total = 0;
  for (const o of osPrincipalNoMes) {
    const tec = tecnicosPorFuncOS.get(`${f.id}:${o.id}`) || [];
    total += comissaoOsDoSnapshot({
      status: o.status,
      comissao_calculada_snapshot: o.comissao_calculada_snapshot,
      tecnicosDoFuncionario: tec,
    }) || 0;
  }
  return total;
}

function indexarOsTecnicos(osTecnicos: OSTecnicoRow[]): Map<string, OSTecnicoRow[]> {
  const tecnicosPorFuncOS = new Map<string, OSTecnicoRow[]>();
  osTecnicos.forEach((t) => {
    const k = `${t.funcionario_id}:${t.os_id}`;
    if (!tecnicosPorFuncOS.has(k)) tecnicosPorFuncOS.set(k, []);
    tecnicosPorFuncOS.get(k)!.push(t);
  });
  return tecnicosPorFuncOS;
}

function ajustarDetalhePorCargo(detalhes: DetalheComissao[], temConfig: boolean, comissaoOS: number): { cargo: string; comissao: number; base: number }[] {
  const strip = ({ cargo, comissao, base }: DetalheComissao) => ({ cargo, comissao, base });
  if (!temConfig) return detalhes.map(strip);
  // Com config: a parte de OS vem do snapshot; troca as linhas de escopo de OS
  // por uma única linha "Comissão por Tipo de Serviço".
  const semOS = detalhes.filter((d) => !ESCOPOS_DE_OS.has(String(d.escopo))).map(strip);
  if (comissaoOS > 0.005) semOS.push({ cargo: "Comissão por Tipo de Serviço", comissao: comissaoOS, base: 0 });
  return semOS;
}

// ===========================================================================
export function useComissoes(funcionarios: Funcionario[], mes?: Date) {
  const mesRef = mes || new Date();
  const inicioDate = startOfMonth(mesRef);
  const fimDate = endOfMonth(mesRef);
  const inicio = inicioDate.toISOString();
  const fim = fimDate.toISOString();

  const funcionarioIds = funcionarios.map((f) => f.id);

  const { data, isLoading } = useQuery({
    queryKey: ["comissoes", funcionarioIds, inicio, fim],
    queryFn: async () => {
      if (!funcionarioIds.length) return { atual: [], totalComissoes: 0, totalVendido: 0 };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { atual: [], totalComissoes: 0, totalVendido: 0 };

      const { data: vendasMes } = await supabase
        .from("vendas")
        .select("funcionario_id, total, quantidade, tipo")
        .eq("user_id", user.id)
        .in("funcionario_id", funcionarioIds)
        .gte("data", inicio)
        .lte("data", fim)
        .eq("cancelada", false)
        .is("deleted_at", null)
        // Exclui registros auxiliares de pagamento duplo (não representam vendas reais)
        .or("observacoes.is.null,observacoes.neq.pagamento_duplo_secundario");

      // OS entregues do período — uma busca por data de criação, outra por
      // data de saída; a base de data certa é aplicada por funcionário em JS.
      const [osPorCriacao, osPorEntrega] = await Promise.all([
        supabase.from("ordens_servico").select(OS_SELECT)
          .eq("user_id", user.id).is("deleted_at", null).eq("is_teste", false)
          .eq("status", "entregue").gte("created_at", inicio).lte("created_at", fim)
          .then((r) => (r.data || []) as OSRow[]),
        supabase.from("ordens_servico").select(OS_SELECT)
          .eq("user_id", user.id).is("deleted_at", null).eq("is_teste", false)
          .eq("status", "entregue").not("data_saida", "is", null)
          .gte("data_saida", inicio).lte("data_saida", fim)
          .then((r) => (r.data || []) as OSRow[]),
      ]);
      const osById0 = new Map<string, OSRow>();
      [...osPorCriacao, ...osPorEntrega].forEach((o) => osById0.set(o.id, o));
      const osTodas = [...osById0.values()];

      const osIds = osTodas.map((o) => o.id);
      const { data: osTecnicos } = osIds.length > 0
        ? await supabase.from("os_tecnicos")
            .select("os_id, funcionario_id, comissao_calculada_snapshot")
            .in("os_id", osIds).in("funcionario_id", funcionarioIds)
        : { data: [] as OSTecnicoRow[] };

      const { data: cfgTipo } = await supabase
        .from("comissoes_tipo_servico")
        .select("funcionario_id")
        .in("funcionario_id", funcionarioIds);
      const funcIdsComConfig = new Set((cfgTipo || []).map((c: { funcionario_id: string }) => c.funcionario_id));

      const tecnicosPorFuncOS = indexarOsTecnicos((osTecnicos || []) as OSTecnicoRow[]);

      const atual = funcionarios.map((f) => {
        const vendasFunc = (vendasMes || []).filter((v: VendaRow) => v.funcionario_id === f.id);
        const totalVendasProdutos = vendasFunc
          .filter((v: VendaRow) => v.tipo === "produto" || v.tipo === "peca")
          .reduce((acc: number, v: VendaRow) => acc + Number(v.total), 0);
        const totalVendasDispositivos = vendasFunc
          .filter((v: VendaRow) => v.tipo === "dispositivo")
          .reduce((acc: number, v: VendaRow) => acc + Number(v.total), 0);
        const quantidadeVendas = vendasFunc.length;

        const campo = campoDataDe(f);
        const dentroMes = (o: OSRow) => {
          const raw = o[campo];
          if (!raw) return false;
          const d = new Date(raw);
          return d >= inicioDate && d <= fimDate;
        };
        const osPrincipal = osTodas.filter((o) => o.funcionario_id === f.id && dentroMes(o));
        const totalServicos = osPrincipal.reduce((acc, o) => acc + Number(o.total || 0), 0);
        const quantidadeOS = osPrincipal.length;

        const sa = calcularComissaoSistemaA(
          f, totalVendasProdutos, totalVendasDispositivos, totalServicos, quantidadeVendas, quantidadeOS,
        );
        const temConfig = funcIdsComConfig.has(f.id);
        const comissaoOS = comissaoOSNoPeriodo(f, temConfig, sa.parteOS, osPrincipal, tecnicosPorFuncOS);
        const comissaoCalculada = sa.parteVendas + comissaoOS;

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
          comissaoOSViaSnapshot: temConfig,
          detalhePorCargo: ajustarDetalhePorCargo(sa.detalhes, temConfig, comissaoOS),
        } as ComissaoFuncionario;
      });

      return {
        atual,
        totalComissoes: atual.reduce((acc, c) => acc + c.comissaoCalculada, 0),
        totalVendido: atual.reduce((acc, c) => acc + c.totalVendas + c.totalServicos, 0),
      };
    },
    enabled: funcionarioIds.length > 0,
  });

  return {
    comissoes: data?.atual || [],
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
 * percentual na aba Desempenho. Busca o período inteiro numa query só e
 * agrega em memória por mês, reaproveitando a MESMA regra de comissão de
 * useComissoes (Sistema B por snapshot para quem tem config; Sistema A para o
 * resto).
 */
export function useComissoesSerieMensal(funcionarios: Funcionario[], mesRef: Date, meses: number = 6) {
  const funcionarioIds = funcionarios.map((f) => f.id);
  const inicioSerieDate = startOfMonth(subMonths(mesRef, meses - 1));
  const fimSerieDate = endOfMonth(mesRef);
  const inicioSerie = inicioSerieDate.toISOString();
  const fimSerie = fimSerieDate.toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["comissoes-serie-mensal", funcionarioIds, inicioSerie, fimSerie],
    queryFn: async (): Promise<PontoSerieMensalComissoes[]> => {
      if (!funcionarioIds.length) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: vendasPeriodo } = await supabase
        .from("vendas")
        .select("funcionario_id, total, quantidade, tipo, data")
        .eq("user_id", user.id)
        .in("funcionario_id", funcionarioIds)
        .gte("data", inicioSerie)
        .lte("data", fimSerie)
        .eq("cancelada", false)
        .is("deleted_at", null)
        .or("observacoes.is.null,observacoes.neq.pagamento_duplo_secundario");

      const [osPorCriacao, osPorEntrega] = await Promise.all([
        supabase.from("ordens_servico").select(OS_SELECT)
          .eq("user_id", user.id).is("deleted_at", null).eq("is_teste", false)
          .eq("status", "entregue").gte("created_at", inicioSerie).lte("created_at", fimSerie)
          .then((r) => (r.data || []) as OSRow[]),
        supabase.from("ordens_servico").select(OS_SELECT)
          .eq("user_id", user.id).is("deleted_at", null).eq("is_teste", false)
          .eq("status", "entregue").not("data_saida", "is", null)
          .gte("data_saida", inicioSerie).lte("data_saida", fimSerie)
          .then((r) => (r.data || []) as OSRow[]),
      ]);
      const osById0 = new Map<string, OSRow>();
      [...osPorCriacao, ...osPorEntrega].forEach((o) => osById0.set(o.id, o));
      const osTodas = [...osById0.values()];

      const osIds = osTodas.map((o) => o.id);
      const { data: osTecnicos } = osIds.length > 0
        ? await supabase.from("os_tecnicos")
            .select("os_id, funcionario_id, comissao_calculada_snapshot")
            .in("os_id", osIds).in("funcionario_id", funcionarioIds)
        : { data: [] as OSTecnicoRow[] };

      const { data: cfgTipo } = await supabase
        .from("comissoes_tipo_servico")
        .select("funcionario_id")
        .in("funcionario_id", funcionarioIds);
      const funcIdsComConfig = new Set((cfgTipo || []).map((c: { funcionario_id: string }) => c.funcionario_id));

      const tecnicosPorFuncOS = indexarOsTecnicos((osTecnicos || []) as OSTecnicoRow[]);

      const pontos: PontoSerieMensalComissoes[] = [];
      for (let i = meses - 1; i >= 0; i--) {
        const mesAtualRef = subMonths(mesRef, i);
        const inicioMes = startOfMonth(mesAtualRef);
        const fimMes = endOfMonth(mesAtualRef);

        const vendasMes = (vendasPeriodo || []).filter((v: VendaRow) => {
          if (!v.data) return false;
          const d = new Date(v.data);
          return d >= inicioMes && d <= fimMes;
        });

        let totalVendidoMes = 0;
        let totalComissoesMes = 0;

        funcionarios.forEach((f) => {
          const vendasFunc = vendasMes.filter((v: VendaRow) => v.funcionario_id === f.id);
          const totalVendasProdutos = vendasFunc
            .filter((v: VendaRow) => v.tipo === "produto" || v.tipo === "peca")
            .reduce((acc: number, v: VendaRow) => acc + Number(v.total), 0);
          const totalVendasDispositivos = vendasFunc
            .filter((v: VendaRow) => v.tipo === "dispositivo")
            .reduce((acc: number, v: VendaRow) => acc + Number(v.total), 0);
          const quantidadeVendas = vendasFunc.length;

          const campo = campoDataDe(f);
          const dentroMes = (o: OSRow) => {
            const raw = o[campo];
            if (!raw) return false;
            const d = new Date(raw);
            return d >= inicioMes && d <= fimMes;
          };
          const osPrincipal = osTodas.filter((o) => o.funcionario_id === f.id && dentroMes(o));
          const totalServicos = osPrincipal.reduce((acc, o) => acc + Number(o.total || 0), 0);
          const quantidadeOS = osPrincipal.length;

          const sa = calcularComissaoSistemaA(
            f, totalVendasProdutos, totalVendasDispositivos, totalServicos, quantidadeVendas, quantidadeOS,
          );
          const temConfig = funcIdsComConfig.has(f.id);
          const comissaoOS = comissaoOSNoPeriodo(f, temConfig, sa.parteOS, osPrincipal, tecnicosPorFuncOS);

          totalVendidoMes += totalVendasProdutos + totalVendasDispositivos + totalServicos;
          totalComissoesMes += sa.parteVendas + comissaoOS;
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
