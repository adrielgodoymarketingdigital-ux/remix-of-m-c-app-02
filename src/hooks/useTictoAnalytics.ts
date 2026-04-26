import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Preços mensais para cálculo de MRR (valor recorrente normalizado)
const PRECOS_MENSAL: Record<string, number> = {
  basico_mensal: 19.90,
  intermediario_mensal: 39.90,
  profissional_mensal: 79.90,
  basico_anual: 15.90, // 190.80 / 12
  intermediario_anual: 31.90, // 382.80 / 12
  profissional_anual: 74.90, // 898.80 / 12
};

// Preço cheio cobrado por ciclo (mensal cobra 1x/mês; anual cobra 1x/ano valor cheio)
const PRECO_CICLO_CHEIO: Record<string, number> = {
  basico_mensal: 19.90,
  intermediario_mensal: 39.90,
  profissional_mensal: 79.90,
  basico_anual: 190.80,
  intermediario_anual: 382.80,
  profissional_anual: 898.80,
};

// Taxa Ticto: 6,99% + R$ 2,49 por venda aprovada
const TICTO_TAXA_PERCENTUAL = 0.0699;
const TICTO_TAXA_FIXA = 2.49;

const aplicarTaxaTicto = (valorBruto: number): number => {
  if (valorBruto <= 0) return 0;
  return Math.max(0, valorBruto * (1 - TICTO_TAXA_PERCENTUAL) - TICTO_TAXA_FIXA);
};

const PLANO_NOMES: Record<string, string> = {
  basico_mensal: "Básico Mensal",
  intermediario_mensal: "Intermediário Mensal",
  profissional_mensal: "Profissional Mensal",
  basico_anual: "Básico Anual",
  intermediario_anual: "Intermediário Anual",
  profissional_anual: "Profissional Anual",
};

export interface TictoSubscription {
  user_id: string;
  plano_tipo: string;
  status: string;
  data_proxima_cobranca: string | null;
  payment_method: string | null;
  nome?: string;
  email?: string;
}

export interface TictoEvent {
  id: string;
  tipo: string;
  email_usuario: string | null;
  plano_tipo: string | null;
  created_at: string | null;
  dados: any;
}

export interface TictoAnalyticsData {
  // Assinaturas
  assinaturasAtivas: TictoSubscription[];
  totalAtivas: number;
  // MRR (recorrência mensal normalizada)
  mrr: number;
  mrrLiquido: number; // descontado taxas Ticto
  // Faturamento bruto do mês corrente (cobranças efetivas: mensais + anuais com renovação no mês)
  faturamentoMes: number;
  faturamentoMesLiquido: number;
  // Distribuição por plano
  planBreakdown: Record<string, { count: number; mrr: number; mrrLiquido: number; nome: string }>;
  // Renovações do mês
  renovacoesMes: {
    total: number;
    pendentes: TictoSubscription[];
    totalPendentes: number;
  };
  // Inadimplentes
  inadimplentes: TictoSubscription[];
  // Histórico de eventos
  eventos: TictoEvent[];
  // Timestamp
  lastUpdate: string;
}

export function useTictoAnalytics() {
  const [data, setData] = useState<TictoAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Buscar assinaturas Ticto e eventos em paralelo
      const [assinaturasRes, eventosRes, profilesRes] = await Promise.all([
        supabase
          .from("assinaturas")
          .select("user_id, plano_tipo, status, data_proxima_cobranca, payment_method")
          .eq("payment_provider", "ticto"),
        supabase
          .from("kirvano_eventos")
          .select("id, tipo, email_usuario, plano_tipo, created_at, dados")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("profiles")
          .select("user_id, nome, email"),
      ]);

      if (assinaturasRes.error) throw assinaturasRes.error;
      if (eventosRes.error) throw eventosRes.error;

      const assinaturas = assinaturasRes.data || [];
      const eventos = eventosRes.data || [];
      const profiles = profilesRes.data || [];

      // Mapear profiles para lookup rápido
      const profileMap = new Map(profiles.map(p => [p.user_id, p]));

      // Enriquecer assinaturas com nome/email
      const assinaturasEnriquecidas: TictoSubscription[] = assinaturas.map(a => {
        const profile = profileMap.get(a.user_id);
        return {
          ...a,
          nome: profile?.nome || undefined,
          email: profile?.email || undefined,
        };
      });

      // Filtrar ativas (active, trialing) excluindo free/demo
      const ativas = assinaturasEnriquecidas.filter(
        a => (a.status === "active" || a.status === "trialing") &&
             a.plano_tipo !== "free" &&
             a.plano_tipo !== "demonstracao"
      );

      // Calcular MRR (recorrência mensal normalizada) e MRR Líquido (descontando taxas Ticto)
      let mrr = 0;
      let mrrLiquido = 0;
      const planBreakdown: Record<string, { count: number; mrr: number; mrrLiquido: number; nome: string }> = {};

      for (const a of ativas) {
        const mrrPlano = PRECOS_MENSAL[a.plano_tipo] || 0;
        const cicloCheio = PRECO_CICLO_CHEIO[a.plano_tipo] || mrrPlano;
        // Taxa é cobrada por transação no ciclo cheio; rateamos a taxa proporcionalmente ao mês para anuais
        const liquidoCiclo = aplicarTaxaTicto(cicloCheio);
        const mrrLiquidoPlano = a.plano_tipo.includes("anual") ? liquidoCiclo / 12 : liquidoCiclo;

        mrr += mrrPlano;
        mrrLiquido += mrrLiquidoPlano;

        if (!planBreakdown[a.plano_tipo]) {
          planBreakdown[a.plano_tipo] = {
            count: 0,
            mrr: 0,
            mrrLiquido: 0,
            nome: PLANO_NOMES[a.plano_tipo] || a.plano_tipo,
          };
        }
        planBreakdown[a.plano_tipo].count++;
        planBreakdown[a.plano_tipo].mrr += mrrPlano;
        planBreakdown[a.plano_tipo].mrrLiquido += mrrLiquidoPlano;
      }

      // Renovações do mês atual
      const now = new Date();
      const mesAtual = now.getMonth();
      const anoAtual = now.getFullYear();

      const pendentes = ativas.filter(a => {
        if (!a.data_proxima_cobranca) return false;
        const data = new Date(a.data_proxima_cobranca);
        return data.getMonth() === mesAtual && data.getFullYear() === anoAtual && data >= now;
      });

      // Faturamento bruto do mês: mensais cobram todo mês; anuais só quando data_proxima_cobranca cai neste mês
      let faturamentoMes = 0;
      let faturamentoMesLiquido = 0;
      for (const a of ativas) {
        const cicloCheio = PRECO_CICLO_CHEIO[a.plano_tipo] || 0;
        const isAnual = a.plano_tipo.includes("anual");
        let cobraEsteMes = false;
        if (isAnual) {
          if (a.data_proxima_cobranca) {
            const d = new Date(a.data_proxima_cobranca);
            cobraEsteMes = d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
          }
        } else {
          cobraEsteMes = true;
        }
        if (cobraEsteMes) {
          faturamentoMes += cicloCheio;
          faturamentoMesLiquido += aplicarTaxaTicto(cicloCheio);
        }
      }

      // Inadimplentes (past_due)
      const inadimplentes = assinaturasEnriquecidas.filter(a => a.status === "past_due");

      setData({
        assinaturasAtivas: ativas,
        totalAtivas: ativas.length,
        mrr,
        mrrLiquido,
        faturamentoMes,
        faturamentoMesLiquido,
        planBreakdown,
        renovacoesMes: {
          total: pendentes.length,
          pendentes,
          totalPendentes: pendentes.reduce((acc, p) => acc + (PRECOS_MENSAL[p.plano_tipo] || 0), 0),
        },
        inadimplentes,
        eventos: eventos as TictoEvent[],
        lastUpdate: new Date().toISOString(),
      });

      return data;
    } catch (err: any) {
      setError(err.message || "Erro ao carregar dados Ticto");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, fetchData, refetch: fetchData };
}
