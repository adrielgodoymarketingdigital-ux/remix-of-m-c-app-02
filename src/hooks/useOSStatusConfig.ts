import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface OSStatusConfig {
  id: string;
  user_id: string;
  slug: string;
  nome: string;
  cor: string;
  ordem: number;
  gera_conta: boolean;
  tipo_conta: string;
  pedir_data_vencimento: boolean;
  ativo: boolean;
  is_sistema: boolean;
}

const STATUS_PADRAO: Omit<OSStatusConfig, 'id' | 'user_id'>[] = [
  { slug: 'aguardando_aprovacao', nome: 'Aguardando Aprovação', cor: '#eab308', ordem: 0, gera_conta: false, tipo_conta: 'receber', pedir_data_vencimento: false, ativo: true, is_sistema: true },
  { slug: 'em_andamento', nome: 'Serviço em Andamento', cor: '#3b82f6', ordem: 1, gera_conta: true, tipo_conta: 'receber', pedir_data_vencimento: false, ativo: true, is_sistema: true },
  { slug: 'finalizado', nome: 'Serviço Finalizado', cor: '#22c55e', ordem: 2, gera_conta: false, tipo_conta: 'receber', pedir_data_vencimento: false, ativo: true, is_sistema: true },
  { slug: 'aguardando_retirada', nome: 'Aguardando Retirada', cor: '#f97316', ordem: 3, gera_conta: true, tipo_conta: 'receber', pedir_data_vencimento: false, ativo: true, is_sistema: true },
  { slug: 'entregue', nome: 'Serviço Entregue', cor: '#a855f7', ordem: 4, gera_conta: false, tipo_conta: 'receber', pedir_data_vencimento: false, ativo: true, is_sistema: true },
  { slug: 'cancelada', nome: 'Cancelada', cor: '#ef4444', ordem: 5, gera_conta: false, tipo_conta: 'receber', pedir_data_vencimento: false, ativo: true, is_sistema: true },
  { slug: 'garantia', nome: 'Em Garantia', cor: '#d97706', ordem: 6, gera_conta: false, tipo_conta: 'receber', pedir_data_vencimento: false, ativo: true, is_sistema: true },
  { slug: 'estornado', nome: 'Estornado', cor: '#be123c', ordem: 7, gera_conta: false, tipo_conta: 'receber', pedir_data_vencimento: false, ativo: true, is_sistema: true },
];

const resolverUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: funcData } = await supabase
    .from('loja_funcionarios')
    .select('loja_user_id')
    .eq('funcionario_user_id', user.id)
    .eq('ativo', true)
    .maybeSingle();
  if (funcData?.loja_user_id) return funcData.loja_user_id;

  const { data: gerenteData } = await supabase
    .from('empresa_usuarios')
    .select('proprietario_id')
    .eq('gerente_id', user.id)
    .maybeSingle();
  if (gerenteData?.proprietario_id) return gerenteData.proprietario_id;

  return user.id;
};

const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";
const STATUS_INICIAL: OSStatusConfig[] = STATUS_PADRAO.map((s, i) => ({
  ...s,
  id: `${PLACEHOLDER_ID}-${i}`,
  user_id: PLACEHOLDER_ID,
}));

export const useOSStatusConfig = () => {
  const [statusList, setStatusList] = useState<OSStatusConfig[]>(STATUS_INICIAL);
  const [loading, setLoading] = useState(true);
  const carregouRef = useRef(false);
  const { toast } = useToast();

  const carregarStatus = useCallback(async () => {
    try {
      setLoading(true);
      const userId = await resolverUserId();
      if (!userId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('os_status_config')
        .select('*')
        .eq('user_id', userId)
        .order('ordem', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        const inserts = STATUS_PADRAO.map(s => ({ ...s, user_id: userId }));
        const { data: inserted, error: insertError } = await supabase
          .from('os_status_config')
          .insert(inserts)
          .select();

        if (insertError) throw insertError;
        setStatusList((inserted || []) as OSStatusConfig[]);
      } else {
        setStatusList(data as OSStatusConfig[]);
      }
      carregouRef.current = true;
    } catch (error) {
      console.error("Erro ao carregar status config:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Tenta carregar imediatamente
    carregarStatus();

    // Garante carregamento quando a sessão estiver pronta
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        carregarStatus();
      }
    });

    return () => subscription.unsubscribe();
  }, [carregarStatus]);

  // Retry: se após 3s ainda está com placeholders, tenta de novo
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!carregouRef.current) {
        carregarStatus();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [carregarStatus]);

  const criarStatus = async (dados: { nome: string; cor: string; gera_conta: boolean; tipo_conta: string; pedir_data_vencimento: boolean }) => {
    try {
      const userId = await resolverUserId();
      if (!userId) return false;

      const slug = dados.nome
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

      const maxOrdem = statusList.reduce((max, s) => Math.max(max, s.ordem), 0);

      const { error } = await supabase.from('os_status_config').insert({
        user_id: userId,
        slug,
        nome: dados.nome,
        cor: dados.cor,
        ordem: maxOrdem + 1,
        gera_conta: dados.gera_conta,
        tipo_conta: dados.tipo_conta,
        pedir_data_vencimento: dados.pedir_data_vencimento,
        is_sistema: false,
      });

      if (error) throw error;
      await carregarStatus();
      toast({ title: "Status criado", description: `Status "${dados.nome}" criado com sucesso.` });
      return true;
    } catch (error: any) {
      console.error("Erro ao criar status:", error);
      toast({ title: "Erro ao criar status", description: error.message || "Erro desconhecido.", variant: "destructive" });
      return false;
    }
  };

  const atualizarStatusConfig = async (id: string, dados: Partial<OSStatusConfig>) => {
    try {
      const { error } = await supabase
        .from('os_status_config')
        .update(dados)
        .eq('id', id);

      if (error) throw error;
      await carregarStatus();
      toast({ title: "Status atualizado" });
      return true;
    } catch (error: any) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const excluirStatus = async (id: string) => {
    try {
      const { error } = await supabase
        .from('os_status_config')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await carregarStatus();
      toast({ title: "Status excluído" });
      return true;
    } catch (error: any) {
      toast({ title: "Erro ao excluir status", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const activeStatusList = statusList.filter(s => s.ativo);
  const getStatusBySlug = (slug: string) => statusList.find(s => s.slug === slug);
  const getStatusColors = () => Object.fromEntries(activeStatusList.map(s => [s.slug, s.cor]));
  const getStatusLabels = () => Object.fromEntries(activeStatusList.map(s => [s.slug, s.nome]));

  return {
    statusList,
    activeStatusList,
    loading,
    criarStatus,
    atualizarStatusConfig,
    excluirStatus,
    carregarStatus,
    getStatusBySlug,
    getStatusColors,
    getStatusLabels,
  };
};
