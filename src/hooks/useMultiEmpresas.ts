import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Empresa, EmpresaUsuario, EmpresaMeta, EmpresaDashboard } from "@/types/multiempresas";

export interface MatrizMetricas {
  faturamento_mes: number;
  os_mes: number;
  vendas_mes: number;
}

export function useMultiEmpresas() {
  const [empresas, setEmpresas] = useState<EmpresaDashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string | null>(null);
  const [matrizMetricas, setMatrizMetricas] = useState<MatrizMetricas>({ faturamento_mes: 0, os_mes: 0, vendas_mes: 0 });

  const carregarEmpresas = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const { data: empresasData, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('proprietario_id', user.id)
        .eq('ativa', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const empresasComDados = await Promise.all(
        (empresasData || []).map(async (empresa) => {
          const { data: gerentesData } = await supabase
            .from('empresa_usuarios')
            .select('*')
            .eq('empresa_id', empresa.id)
            .eq('ativa', true);

          const { data: metasData } = await supabase
            .from('empresa_metas')
            .select('*')
            .eq('empresa_id', empresa.id);

          // Buscar user_id do gerente desta filial para filtrar dados corretamente
          const gerenteUserId = gerentesData?.[0]?.gerente_id ?? null;
          const userIdFilial = gerenteUserId || user.id;

          const [vendasRes, osRes] = await Promise.all([
            supabase
              .from('vendas')
              .select('total')
              .eq('user_id', userIdFilial)
              .eq('cancelada', false)
              .gte('data', inicioMes.toISOString()),
            supabase
              .from('ordens_servico')
              .select('valor_total')
              .eq('user_id', userIdFilial)
              .gte('created_at', inicioMes.toISOString()),
          ]);

          const faturamento = [
            ...(vendasRes.data || []).map(v => v.total || 0),
            ...(osRes.data || []).map(o => o.valor_total || 0),
          ].reduce((sum, v) => sum + v, 0);

          return {
            ...empresa,
            gerentes: gerentesData || [],
            metas: metasData || [],
            metricas: {
              faturamento_mes: faturamento,
              os_mes: osRes.data?.length || 0,
              vendas_mes: vendasRes.data?.length || 0,
              clientes_ativos: 0,
            },
          };
        })
      );

      // Métricas da matriz (proprietário)
      const [vendasMatrizRes, osMatrizRes] = await Promise.all([
        supabase
          .from('vendas')
          .select('total')
          .eq('user_id', user.id)
          .eq('cancelada', false)
          .gte('data', inicioMes.toISOString()),
        supabase
          .from('ordens_servico')
          .select('valor_total')
          .eq('user_id', user.id)
          .gte('created_at', inicioMes.toISOString()),
      ]);

      const faturamentoMatriz = [
        ...(vendasMatrizRes.data || []).map(v => v.total || 0),
        ...(osMatrizRes.data || []).map(o => o.valor_total || 0),
      ].reduce((sum, v) => sum + v, 0);

      setMatrizMetricas({
        faturamento_mes: faturamentoMatriz,
        os_mes: osMatrizRes.data?.length || 0,
        vendas_mes: vendasMatrizRes.data?.length || 0,
      });

      setEmpresas(empresasComDados);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const criarEmpresa = async (dados: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await supabase.functions.invoke('criar-filial', {
        body: dados,
      });

      if (response.error) {
        toast.error(response.error.message || "Erro ao criar filial");
        return null;
      }

      if (response.data?.error) {
        toast.error(response.data.error);
        return null;
      }

      toast.success(response.data.mensagem || "Filial criada com sucesso!");
      await carregarEmpresas();
      return response.data.empresa;
    } catch (error: any) {
      toast.error("Erro ao criar filial: " + error.message);
      return null;
    }
  };

  const salvarMeta = async (meta: Partial<EmpresaMeta>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const agora = new Date();
    const { error } = meta.id
      ? await supabase.from('empresa_metas').update(meta).eq('id', meta.id)
      : await supabase.from('empresa_metas').insert({
          ...meta,
          proprietario_id: user.id,
          mes: agora.getMonth() + 1,
          ano: agora.getFullYear(),
        });

    if (error) { toast.error("Erro ao salvar meta"); return; }
    toast.success("Meta salva!");
    await carregarEmpresas();
  };

  const atualizarPermissoes = async (
    empresaUsuarioId: string,
    permissoes: EmpresaUsuario['permissoes']
  ) => {
    const { error } = await supabase
      .from('empresa_usuarios')
      .update({ permissoes })
      .eq('id', empresaUsuarioId);

    if (error) { toast.error("Erro ao atualizar permissões"); return; }
    toast.success("Permissões atualizadas!");
    await carregarEmpresas();
  };

  useEffect(() => { carregarEmpresas(); }, [carregarEmpresas]);

  return {
    empresas,
    isLoading,
    empresaSelecionada,
    setEmpresaSelecionada,
    matrizMetricas,
    criarEmpresa,
    salvarMeta,
    atualizarPermissoes,
    recarregar: carregarEmpresas,
  };
}
