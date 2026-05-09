import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlanBreakdownItem {
  count: number;
  mrr: number;
  nome: string;
}

export interface RenovacaoItem {
  subscription_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  plan_name: string;
  amount: number;
  amount_liquido: number;
  next_billing_at: string;
  payment_method: string;
  expected_payout_at: string;
}

export interface AdminFinanceiroData {
  assinantes_db: number;
  assinantes_inadimplentes: number;
  inadimplentes_detalhes: Array<{
    user_id: string;
    plano_tipo: string;
    plano_nome: string;
    data_vencimento: string | null;
    payment_provider: string | null;
    valor_mensal: number;
    nome: string | null;
    email: string | null;
  }>;
  assinantes_detalhes: Array<{
    user_id: string;
    plano_tipo: string;
    plano_nome: string;
    proxima_cobranca: string | null;
    payment_provider: string | null;
    payment_method: string | null;
    valor_mensal: number;
    nome: string | null;
    email: string | null;
  }>;
  expirados_detalhes: Array<{
    user_id: string;
    plano_tipo: string;
    plano_nome: string;
    status: string;
    data_expiracao: string | null;
    payment_provider: string | null;
    nome: string | null;
    email: string | null;
  }>;
  total_expirados: number;
  assinantes_pagarme: number;
  mrr_db: number;
  mrr_pagarme_bruto: number;
  mrr_pagarme_liquido: number;
  plan_breakdown: Record<string, PlanBreakdownItem>;
  mes: string;
  recebimentos_cartao_mes: RenovacaoItem[];
  total_receber_mes_bruto: number;
  total_receber_mes_liquido: number;
  renovacoes_pendentes_mes: RenovacaoItem[];
  taxas: {
    cartao_percentual: number;
    cartao_fixa: number;
    pix_percentual: number;
    pix_fixa: number;
  };
  pagarme_error: string | null;
  recorrencia_entrou_mes: number;
  recorrencia_falta_mes: number;
  recorrencia_falta_ate: string | null;
  historico_crescimento: {
    snapshots: Array<{
      mes: string;
      data: string;
      cadastros_acumulados: number;
      novos_cadastros: number;
      pagantes_ativos: number;
      novos_pagantes: number;
      crescimento_cadastros_pct: number | null;
      crescimento_pagantes_pct: number | null;
      migracao: boolean;
    }>;
    cadastros: {
      total_atual: number;
      media_novos_por_mes: number;
      crescimento_ultimo_mes_pct: number | null;
      projecoes: Array<{ meses: number; label: string; projetado: number; novos_esperados: number }>;
    };
    pagantes: {
      total_atual: number;
      media_novos_por_mes: number;
      crescimento_ultimo_mes_pct: number | null;
      projecoes: Array<{ meses: number; label: string; projetado: number; novos_esperados: number }>;
    };
    crescimento_absoluto: {
      mes_atual: { label: string; novos_cadastros: number; novos_pagantes: number };
      mes_passado: { label: string; novos_cadastros: number | null; novos_pagantes: number | null };
      ultimos_3_meses: { novos_cadastros: number; novos_pagantes: number; media_mensal_cadastros: number; media_mensal_pagantes: number };
      previsao_proximo_mes: { cadastros: number; pagantes: number };
    };
  } | null;
  last_update: string;
}

export function useAdminFinanceiro() {
  return useQuery({
    queryKey: ["admin-financeiro", "subscribers-and-expired-v8"],
    queryFn: async (): Promise<AdminFinanceiroData> => {
      const { data, error } = await supabase.functions.invoke("admin-financeiro");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as AdminFinanceiroData;
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000, // atualiza a cada 1 minuto em background
    retry: 2,
  });
}