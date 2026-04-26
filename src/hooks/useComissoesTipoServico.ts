import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ComissaoTipoServico {
  id: string;
  funcionario_id: string;
  tipo_servico_id: string;
  comissao_tipo: string; // 'porcentagem' | 'valor_fixo'
  comissao_valor: number;
}

export function useComissoesTipoServico() {
  const [comissoes, setComissoes] = useState<ComissaoTipoServico[]>([]);
  const [loading, setLoading] = useState(false);

  const carregarPorFuncionario = useCallback(async (funcionarioId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("comissoes_tipo_servico")
        .select("*")
        .eq("funcionario_id", funcionarioId);

      if (error) throw error;
      setComissoes((data || []) as ComissaoTipoServico[]);
      return (data || []) as ComissaoTipoServico[];
    } catch (error) {
      console.error("Erro ao carregar comissões:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const salvarComissoes = async (
    funcionarioId: string,
    novasComissoes: { tipo_servico_id: string; comissao_tipo: string; comissao_valor: number }[]
  ) => {
    try {
      // Delete existing
      await supabase
        .from("comissoes_tipo_servico")
        .delete()
        .eq("funcionario_id", funcionarioId);

      // Insert new ones (only with value > 0)
      const validas = novasComissoes.filter(c => c.comissao_valor > 0);
      if (validas.length > 0) {
        const { error } = await supabase
          .from("comissoes_tipo_servico")
          .insert(
            validas.map(c => ({
              funcionario_id: funcionarioId,
              tipo_servico_id: c.tipo_servico_id,
              comissao_tipo: c.comissao_tipo,
              comissao_valor: c.comissao_valor,
            })) as any
          );

        if (error) throw error;
      }

      toast.success("Comissões por tipo de serviço salvas!");
    } catch (error) {
      console.error("Erro ao salvar comissões:", error);
      toast.error("Erro ao salvar comissões por tipo de serviço");
    }
  };

  const buscarComissao = useCallback(async (funcionarioId: string, tipoServicoId: string) => {
    try {
      const { data, error } = await supabase
        .from("comissoes_tipo_servico")
        .select("*")
        .eq("funcionario_id", funcionarioId)
        .eq("tipo_servico_id", tipoServicoId)
        .maybeSingle();

      if (error) throw error;
      return data as ComissaoTipoServico | null;
    } catch {
      return null;
    }
  }, []);

  return { comissoes, loading, carregarPorFuncionario, salvarComissoes, buscarComissao };
}
