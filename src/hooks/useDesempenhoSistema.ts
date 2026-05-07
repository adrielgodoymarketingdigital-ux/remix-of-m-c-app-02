import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface MesSnapshot {
  mes: string; // "Jan/25"
  data: string; // "2025-01"
  ativos: number;
  novos: number;
  cancelados: number;
  crescimento_pct: number | null; // null no primeiro mês
}

export interface DesempenhoSistema {
  snapshots: MesSnapshot[];
  crescimento_medio_mensal_pct: number;
  crescimento_ultimo_mes_pct: number | null;
  projecoes: {
    meses: number;
    label: string;
    assinantes_projetados: number;
    crescimento_acumulado_pct: number;
  }[];
  total_atual: number;
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function useDesempenhoSistema(mesesHistorico: number = 12) {
  return useQuery({
    queryKey: ["admin-desempenho-sistema", mesesHistorico],
    queryFn: async (): Promise<DesempenhoSistema> => {
      const agora = new Date();

      // Buscar todas as assinaturas relevantes (ativas, canceladas, expiradas)
      const { data: assinaturas, error } = await supabase
        .from("assinaturas")
        .select("user_id, status, data_inicio, data_fim, cancelado_em")
        .in("status", ["active", "canceled", "past_due", "expired"]);

      if (error) throw error;

      const snapshots: MesSnapshot[] = [];

      for (let i = mesesHistorico - 1; i >= 0; i--) {
        const refDate = subMonths(agora, i);
        const inicio = startOfMonth(refDate);
        const fim = endOfMonth(refDate);
        const mesStr = format(refDate, "yyyy-MM");
        const mesLabel = capitalizeFirst(format(refDate, "MMM/yy", { locale: ptBR }));

        // Ativos no fim do mês: data_inicio <= fim do mês E (data_fim > fim do mês OU data_fim é null)
        const ativos = (assinaturas ?? []).filter((a) => {
          if (!a.data_inicio) return false;
          const di = new Date(a.data_inicio);
          if (di > fim) return false;

          // Cancelados antes do fim do mês não contam
          if (a.cancelado_em && new Date(a.cancelado_em) <= fim) return false;

          // data_fim: se existe e já passou do fim do mês, não conta
          if (a.data_fim && new Date(a.data_fim) <= fim) return false;

          return true;
        }).length;

        // Novos no mês: data_inicio dentro do mês
        const novos = (assinaturas ?? []).filter((a) => {
          if (!a.data_inicio) return false;
          const di = new Date(a.data_inicio);
          return di >= inicio && di <= fim;
        }).length;

        // Cancelados no mês
        const cancelados = (assinaturas ?? []).filter((a) => {
          if (!a.cancelado_em) return false;
          const dc = new Date(a.cancelado_em);
          return dc >= inicio && dc <= fim;
        }).length;

        snapshots.push({
          mes: mesLabel,
          data: mesStr,
          ativos,
          novos,
          cancelados,
          crescimento_pct: null,
        });
      }

      // Calcular crescimento percentual mês a mês
      for (let i = 1; i < snapshots.length; i++) {
        const anterior = snapshots[i - 1].ativos;
        const atual = snapshots[i].ativos;
        if (anterior > 0) {
          snapshots[i].crescimento_pct = ((atual - anterior) / anterior) * 100;
        } else if (atual > 0) {
          snapshots[i].crescimento_pct = 100;
        } else {
          snapshots[i].crescimento_pct = 0;
        }
      }

      // Crescimento médio mensal (excluindo o primeiro snapshot sem dados anteriores)
      const pcts = snapshots.slice(1).map((s) => s.crescimento_pct ?? 0);
      const crescimento_medio_mensal_pct =
        pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;

      const crescimento_ultimo_mes_pct =
        snapshots.length >= 2
          ? snapshots[snapshots.length - 1].crescimento_pct
          : null;

      const total_atual = snapshots[snapshots.length - 1]?.ativos ?? 0;

      // Projeções usando taxa média de crescimento mensal composta
      const taxaMensal = crescimento_medio_mensal_pct / 100;
      const periodosProjecao = [
        { meses: 1, label: "1 mês" },
        { meses: 3, label: "3 meses" },
        { meses: 6, label: "6 meses" },
        { meses: 12, label: "12 meses" },
      ];

      const projecoes = periodosProjecao.map(({ meses, label }) => {
        const assinantes_projetados = Math.round(total_atual * Math.pow(1 + taxaMensal, meses));
        const crescimento_acumulado_pct = (Math.pow(1 + taxaMensal, meses) - 1) * 100;
        return { meses, label, assinantes_projetados, crescimento_acumulado_pct };
      });

      return {
        snapshots,
        crescimento_medio_mensal_pct,
        crescimento_ultimo_mes_pct,
        projecoes,
        total_atual,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
