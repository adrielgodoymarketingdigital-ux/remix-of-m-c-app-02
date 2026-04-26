import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
}

export interface DesempenhoFuncionario {
  ordens: OSFuncionario[];
  tiposServico: Record<string, string>;
  comissoesTipoServico: Record<string, { tipo: string; valor: number }>;
}

export function useDesempenhoFuncionario(funcionarioId: string | null, dataInicio?: string | null, dataFim?: string | null) {
  return useQuery({
    queryKey: ["desempenho-funcionario", funcionarioId, dataInicio, dataFim],
    queryFn: async (): Promise<DesempenhoFuncionario> => {
      if (!funcionarioId) return { ordens: [], tiposServico: {}, comissoesTipoServico: {} };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { ordens: [], tiposServico: {}, comissoesTipoServico: {} };

      // Fetch OS assigned to this employee
      let query = supabase
        .from("ordens_servico")
        .select(`
          id, numero_os, created_at, status, total, defeito_relatado,
          dispositivo_modelo, dispositivo_marca, tipo_servico_id, avarias,
          comissao_tipo_snapshot, comissao_valor_snapshot, comissao_calculada_snapshot,
          tipo_servico_nome_snapshot,
          cliente:clientes!ordens_servico_cliente_fkey(nome)
        `)
        .eq("funcionario_id", funcionarioId)
        .is("deleted_at", null)
        .eq("is_teste", false);

      if (dataInicio) {
        query = query.gte("created_at", dataInicio);
      }
      if (dataFim) {
        query = query.lte("created_at", dataFim);
      }

      const { data: ordens } = await query.order("created_at", { ascending: false });

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

      return {
        ordens: (ordens || []) as OSFuncionario[],
        tiposServico,
        comissoesTipoServico,
      };
    },
    enabled: !!funcionarioId,
  });
}
