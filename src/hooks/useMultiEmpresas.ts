import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EmpresaUsuario, EmpresaMeta, EmpresaDashboard } from "@/types/multiempresas";

export interface MatrizMetricas {
  faturamento_mes: number;
  os_mes: number;
  vendas_mes: number;
  ultimas_vendas: import("@/types/multiempresas").VendaFilial[];
  vendas_por_tipo: import("@/types/multiempresas").VendaPorTipo[];
}

export function useMultiEmpresas() {
  const [empresas, setEmpresas] = useState<EmpresaDashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string | null>(null);
  const [matrizMetricas, setMatrizMetricas] = useState<MatrizMetricas>({ faturamento_mes: 0, os_mes: 0, vendas_mes: 0, ultimas_vendas: [], vendas_por_tipo: [] });

  const carregarEmpresas = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-filiais-metricas');

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.info(`Logado como: ${data._debug_email}`);
      setEmpresas(data.empresas || []);
      setMatrizMetricas(data.matrizMetricas || { faturamento_mes: 0, os_mes: 0, vendas_mes: 0 });
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao carregar empresas: " + (error?.message || String(error)));
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
