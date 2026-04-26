import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FunnelStep {
  id: string;
  label: string;
  count: number;
  percentage: number;
}

export interface FunnelData {
  assistencia: FunnelStep[];
  vendas: FunnelStep[];
}

export interface FunnelMetrics {
  total: number;
  completaram: number;
  taxaCompletacao: number;
  pularam: number;
  taxaPulou: number;
  emAndamento: number;
  tempoMedioCompletacao: number | null;
  etapaMaiorAbandono: string | null;
}

export interface OnboardingUser {
  id: string;
  user_id: string;
  tipo_negocio: string | null;
  step_cliente_cadastrado: boolean;
  step_cliente_cadastrado_at: string | null;
  step_dispositivo_cadastrado: boolean;
  step_dispositivo_cadastrado_at: string | null;
  step_peca_cadastrada: boolean;
  step_peca_cadastrada_at: string | null;
  step_os_criada: boolean;
  step_os_criada_at: string | null;
  step_lucro_visualizado: boolean;
  step_lucro_visualizado_at: string | null;
  aha_moment_reached: boolean;
  onboarding_completed: boolean;
  onboarding_skipped: boolean;
  onboarding_dismissed: boolean;
  created_at: string;
}

export type PeriodoFiltro = '7d' | '30d' | '90d' | 'all';

export function useOnboardingFunnel(periodo: PeriodoFiltro = '30d') {
  const [users, setUsers] = useState<OnboardingUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('user_onboarding')
        .select('*');

      // Filtrar por período
      if (periodo !== 'all') {
        const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - dias);
        query = query.gte('created_at', dataLimite.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('[OnboardingFunnel] Erro ao carregar:', error);
        return;
      }

      setUsers((data || []) as OnboardingUser[]);
    } catch (err) {
      console.error('[OnboardingFunnel] Erro inesperado:', err);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const funnelData = useMemo((): FunnelData => {
    const assistenciaUsers = users.filter(u => u.tipo_negocio === 'assistencia');
    const vendasUsers = users.filter(u => u.tipo_negocio === 'vendas');

    const calcPercentage = (count: number, total: number) => 
      total > 0 ? Math.round((count / total) * 100) : 0;

    // Funil Assistência Técnica
    const assistenciaTotal = assistenciaUsers.length;
    const assistenciaCliente = assistenciaUsers.filter(u => u.step_cliente_cadastrado).length;
    const assistenciaPeca = assistenciaUsers.filter(u => u.step_peca_cadastrada).length;
    const assistenciaOS = assistenciaUsers.filter(u => u.step_os_criada).length;
    const assistenciaLucro = assistenciaUsers.filter(u => u.step_lucro_visualizado).length;

    const assistencia: FunnelStep[] = [
      { id: 'tipo', label: 'Selecionou Tipo', count: assistenciaTotal, percentage: 100 },
      { id: 'cliente', label: 'Cadastrou Cliente', count: assistenciaCliente, percentage: calcPercentage(assistenciaCliente, assistenciaTotal) },
      { id: 'peca', label: 'Cadastrou Peça', count: assistenciaPeca, percentage: calcPercentage(assistenciaPeca, assistenciaTotal) },
      { id: 'os', label: 'Criou OS', count: assistenciaOS, percentage: calcPercentage(assistenciaOS, assistenciaTotal) },
      { id: 'lucro', label: 'Aha Moment!', count: assistenciaLucro, percentage: calcPercentage(assistenciaLucro, assistenciaTotal) },
    ];

    // Funil Vendas
    const vendasTotal = vendasUsers.length;
    const vendasCliente = vendasUsers.filter(u => u.step_cliente_cadastrado).length;
    const vendasDispositivo = vendasUsers.filter(u => u.step_dispositivo_cadastrado).length;
    const vendasLucro = vendasUsers.filter(u => u.step_lucro_visualizado).length;

    const vendas: FunnelStep[] = [
      { id: 'tipo', label: 'Selecionou Tipo', count: vendasTotal, percentage: 100 },
      { id: 'cliente', label: 'Cadastrou Cliente', count: vendasCliente, percentage: calcPercentage(vendasCliente, vendasTotal) },
      { id: 'dispositivo', label: 'Cadastrou Aparelho', count: vendasDispositivo, percentage: calcPercentage(vendasDispositivo, vendasTotal) },
      { id: 'lucro', label: 'Viu Lucro', count: vendasLucro, percentage: calcPercentage(vendasLucro, vendasTotal) },
    ];

    return { assistencia, vendas };
  }, [users]);

  const metrics = useMemo((): FunnelMetrics => {
    const total = users.length;
    const completaram = users.filter(u => u.onboarding_completed).length;
    const pularam = users.filter(u => u.onboarding_skipped || u.onboarding_dismissed).length;
    const emAndamento = total - completaram - pularam;

    // Calcular tempo médio de completação
    const usersComTempo = users.filter(u => 
      u.onboarding_completed && u.created_at && u.step_lucro_visualizado_at
    );
    
    let tempoMedioCompletacao: number | null = null;
    if (usersComTempo.length > 0) {
      const tempos = usersComTempo.map(u => {
        const inicio = new Date(u.created_at).getTime();
        const fim = new Date(u.step_lucro_visualizado_at!).getTime();
        return (fim - inicio) / (1000 * 60 * 60 * 24); // Dias
      });
      tempoMedioCompletacao = tempos.reduce((a, b) => a + b, 0) / tempos.length;
    }

    // Identificar etapa com maior abandono
    let etapaMaiorAbandono: string | null = null;
    const assistenciaUsers = users.filter(u => u.tipo_negocio === 'assistencia');
    const vendasUsers = users.filter(u => u.tipo_negocio === 'vendas');

    if (assistenciaUsers.length > 0) {
      const abandonos = [
        { etapa: 'Cliente', taxa: 1 - (assistenciaUsers.filter(u => u.step_cliente_cadastrado).length / assistenciaUsers.length) },
        { etapa: 'Peça', taxa: assistenciaUsers.filter(u => u.step_cliente_cadastrado && !u.step_peca_cadastrada).length / assistenciaUsers.length },
        { etapa: 'OS', taxa: assistenciaUsers.filter(u => u.step_peca_cadastrada && !u.step_os_criada).length / assistenciaUsers.length },
      ];
      const maiorAbandono = abandonos.reduce((a, b) => a.taxa > b.taxa ? a : b);
      if (maiorAbandono.taxa > 0) {
        etapaMaiorAbandono = `Cadastrar ${maiorAbandono.etapa}`;
      }
    }

    return {
      total,
      completaram,
      taxaCompletacao: total > 0 ? Math.round((completaram / total) * 100) : 0,
      pularam,
      taxaPulou: total > 0 ? Math.round((pularam / total) * 100) : 0,
      emAndamento,
      tempoMedioCompletacao,
      etapaMaiorAbandono
    };
  }, [users]);

  return {
    funnelData,
    metrics,
    loading,
    reload: loadData
  };
}
