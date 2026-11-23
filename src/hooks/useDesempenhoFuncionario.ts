import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type LinhaTecnicoComissao, participacaoNaOS } from "@/lib/comissao/comissaoOsDoSnapshot";

/** Colunas da OS lidas no Perfil (principal e por serviço usam as mesmas). */
const COLUNAS_OS = `
          id, numero_os, created_at, status, total, defeito_relatado,
          dispositivo_modelo, dispositivo_marca, tipo_servico_id, avarias,
          comissao_tipo_snapshot, comissao_valor_snapshot, comissao_calculada_snapshot,
          tipo_servico_nome_snapshot,
          cliente:clientes!ordens_servico_cliente_fkey(nome)
        `;
/** Nas OS por serviço também é preciso saber quem é o principal. */
const COLUNAS_OS_POR_SERVICO = `${COLUNAS_OS.trimEnd()}, funcionario_id`;
const TAMANHO_LOTE_IDS = 150;

export interface OSFuncionario {
  id: string;
  numero_os: string;
  created_at: string;
  status: string | null;
  total: number | null;
  defeito_relatado: string;
  dispositivo_modelo: string;
  dispositivo_marca: string;
  tipo_servico_id: string | null;
  tipo_servico_nome_snapshot: string | null;
  comissao_tipo_snapshot: string | null;
  comissao_valor_snapshot: number | null;
  comissao_calculada_snapshot: number | null;
  avarias: any;
  cliente: { nome: string } | null;
  /**
   * true = ele é o Técnico Principal (ordens_servico.funcionario_id);
   * false = está só em "Técnicos por Serviço" e ganha só pelo serviço dele.
   */
  tecnico_principal: boolean;
  tecnicos_os: {
    descricao_servico: string | null;
    servico_id?: string | null;
    servico_nome_snapshot: string | null;
    preco_servico_snapshot: number | null;
    comissao_calculada_snapshot: number | null;
  }[];
}

export interface DesempenhoFuncionario {
  ordens: OSFuncionario[];
  tiposServico: Record<string, string>;
  comissoesTipoServico: Record<string, { tipo: string; valor: number }>;
  /** "faturamento" (padrão) | "lucro" — base da Comissão por Tipo de Serviço */
  comissaoCalculo: "faturamento" | "lucro";
}

export function useDesempenhoFuncionario(funcionarioId: string | null, dataInicio?: string | null, dataFim?: string | null) {
  return useQuery({
    queryKey: ["desempenho-funcionario", funcionarioId, dataInicio, dataFim],
    queryFn: async (): Promise<DesempenhoFuncionario> => {
      if (!funcionarioId) return { ordens: [], tiposServico: {}, comissoesTipoServico: {}, comissaoCalculo: "faturamento" };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { ordens: [], tiposServico: {}, comissoesTipoServico: {}, comissaoCalculo: "faturamento" };

      // Fetch employee's commission date base + calculation base config
      const { data: funcData } = await supabase
        .from("loja_funcionarios")
        .select("base_comissao, comissao_calculo")
        .eq("id", funcionarioId)
        .maybeSingle();

      const campoData = funcData?.base_comissao === "entrega" ? "data_saida" : "created_at";
      const comissaoCalculo: "faturamento" | "lucro" = funcData?.comissao_calculo === "lucro" ? "lucro" : "faturamento";

      // Fetch OS assigned to this employee
      let query = supabase
        .from("ordens_servico")
        .select(COLUNAS_OS)
        .eq("funcionario_id", funcionarioId)
        .is("deleted_at", null)
        .eq("is_teste", false);

      if (dataInicio) {
        query = query.gte(campoData, dataInicio);
      }
      if (dataFim) {
        query = query.lte(campoData, dataFim);
      }

      const { data: ordens } = await query.order("created_at", { ascending: false });

      // Fetch multi-técnico rows for this employee (OS with 2+ serviços lançados
      // via os_tecnicos têm uma comissão própria por linha, que não aparece no
      // snapshot único de ordens_servico e precisa ser somada por OS).
      const osIds = (ordens || []).map((o: any) => o.id);
      const { data: tecnicosOS } = osIds.length > 0
        ? await supabase
            .from("os_tecnicos")
            .select("os_id, descricao_servico, servico_nome_snapshot, preco_servico_snapshot, comissao_calculada_snapshot")
            .eq("funcionario_id", funcionarioId)
            .in("os_id", osIds)
        : { data: [] as any[] };

      const tecnicosPorOS: Record<string, {
        descricao_servico: string | null;
        servico_nome_snapshot: string | null;
        preco_servico_snapshot: number | null;
        comissao_calculada_snapshot: number | null;
      }[]> = {};
      (tecnicosOS || []).forEach((t: any) => {
        if (!tecnicosPorOS[t.os_id]) tecnicosPorOS[t.os_id] = [];
        tecnicosPorOS[t.os_id].push({
          descricao_servico: t.descricao_servico,
          servico_nome_snapshot: t.servico_nome_snapshot,
          preco_servico_snapshot: t.preco_servico_snapshot,
          comissao_calculada_snapshot: t.comissao_calculada_snapshot,
        });
      });

      // Fetch tipos_servico for name mapping (fallback for old OS without snapshot)
      const { data: tipos } = await supabase
        .from("tipos_servico")
        .select("id, nome");

      const tiposServico: Record<string, string> = {};
      (tipos || []).forEach((t: any) => { tiposServico[t.id] = t.nome; });

      // Fetch commission config for this employee (fallback for old OS without snapshot)
      const { data: comissoes } = await supabase
        .from("comissoes_tipo_servico")
        .select("tipo_servico_id, comissao_tipo, comissao_valor")
        .eq("funcionario_id", funcionarioId);

      const comissoesTipoServico: Record<string, { tipo: string; valor: number }> = {};
      (comissoes || []).forEach((c: any) => {
        comissoesTipoServico[c.tipo_servico_id] = {
          tipo: c.comissao_tipo,
          valor: c.comissao_valor,
        };
      });

      const ordensComTecnicos: OSFuncionario[] = (ordens || []).map((o: any) => ({
        ...o,
        tecnico_principal: true,
        tecnicos_os: tecnicosPorOS[o.id] || [],
      }));

      // OS em que ele NÃO é o principal, mas está em "Técnicos por Serviço"
      // ligado a um serviço: entram com só as linhas dele (regra "a").
      const extras = await buscarOSPorServico(funcionarioId, new Set(osIds), campoData, dataInicio, dataFim);
      const ordensTodas = extras.length > 0
        ? [...ordensComTecnicos, ...extras].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
        : ordensComTecnicos;

      return {
        ordens: ordensTodas,
        tiposServico,
        comissoesTipoServico,
        comissaoCalculo,
      };
    },
    enabled: !!funcionarioId,
  });
}

type LinhaTecnicoPerfil = OSFuncionario["tecnicos_os"][number] & LinhaTecnicoComissao;

/**
 * OS do período em que o funcionário está em os_tecnicos ligado a um serviço
 * mas não é o Técnico Principal. Mesmos filtros da lista principal (período
 * pela base de comissão dele, sem apagadas, sem teste).
 */
async function buscarOSPorServico(
  funcionarioId: string,
  idsComoPrincipal: Set<string>,
  campoData: "data_saida" | "created_at",
  dataInicio?: string | null,
  dataFim?: string | null,
): Promise<OSFuncionario[]> {
  const { data: linhas } = await supabase
    .from("os_tecnicos")
    .select("os_id, funcionario_id, descricao_servico, servico_id, servico_nome_snapshot, preco_servico_snapshot, comissao_calculada_snapshot")
    .eq("funcionario_id", funcionarioId);

  const linhasPorOS = new Map<string, LinhaTecnicoPerfil[]>();
  for (const l of (linhas || []) as LinhaTecnicoPerfil[]) {
    if (idsComoPrincipal.has(l.os_id)) continue;
    if (!linhasPorOS.has(l.os_id)) linhasPorOS.set(l.os_id, []);
    linhasPorOS.get(l.os_id)!.push(l);
  }
  const ids = [...linhasPorOS.keys()];
  if (ids.length === 0) return [];

  const resultado: OSFuncionario[] = [];
  for (let i = 0; i < ids.length; i += TAMANHO_LOTE_IDS) {
    let q = supabase
      .from("ordens_servico")
      .select(COLUNAS_OS_POR_SERVICO)
      .in("id", ids.slice(i, i + TAMANHO_LOTE_IDS))
      .or(`funcionario_id.is.null,funcionario_id.neq.${funcionarioId}`)
      .is("deleted_at", null)
      .eq("is_teste", false);
    if (dataInicio) q = q.gte(campoData, dataInicio);
    if (dataFim) q = q.lte(campoData, dataFim);
    const { data: ordens } = await q;
    for (const o of (ordens || []) as unknown as Omit<OSFuncionario, "tecnico_principal" | "tecnicos_os">[]) {
      const p = participacaoNaOS(funcionarioId, (o as { funcionario_id?: string | null }).funcionario_id, linhasPorOS.get(o.id) || []);
      if (!p || p.ehPrincipal) continue;
      resultado.push({
        ...o,
        tecnico_principal: false,
        tecnicos_os: p.linhas.map((l) => ({
          descricao_servico: l.descricao_servico,
          servico_id: l.servico_id,
          servico_nome_snapshot: l.servico_nome_snapshot ?? null,
          preco_servico_snapshot: l.preco_servico_snapshot,
          comissao_calculada_snapshot: l.comissao_calculada_snapshot ?? null,
        })),
      });
    }
  }
  return resultado;
}
