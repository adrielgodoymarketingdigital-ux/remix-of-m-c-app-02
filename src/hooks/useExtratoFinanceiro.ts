import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIdentidade } from "./useResolvedUserId";
import type { FiltrosPeriodo } from "@/components/financeiro/FiltroPeriodoAvancado";

export type OrigemEventoExtrato =
  | "venda_pdv"
  | "venda_avulsa"
  | "servico_avulso"
  | "ordem_servico"
  | "conta_receber"
  | "conta_pagar";

export interface EventoExtrato {
  data: string;
  tipo: "entrada" | "saida";
  origem: OrigemEventoExtrato;
  valor: number;
  descricao: string;
  referencia_id: string;
}

export interface ResumoExtrato {
  saldo_atual: number;
  entradas_periodo: number;
  saidas_periodo: number;
}

const PAGE_SIZE = 50;

/**
 * Financeiro → Extrato. Chama fn_extrato_resumo/fn_extrato_lista
 * (supabase/migrations/20260909150000_extrato_financeiro.sql +
 * 20260909160000_fix_extrato_valor_pago_zero.sql) — toda a agregação e as
 * regras de inclusão/exclusão (o que conta como dinheiro que já entrou/saiu)
 * vivem no banco, não aqui.
 */
export function useExtratoFinanceiro() {
  const { userId, empresaId, isFilial, carregando: identidadeCarregando } = useIdentidade();

  const [resumo, setResumo] = useState<ResumoExtrato | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(false);

  const [eventos, setEventos] = useState<EventoExtrato[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [temMais, setTemMais] = useState(false);

  const carregarResumo = useCallback(async (filtro: FiltrosPeriodo) => {
    if (identidadeCarregando || !userId || !filtro.dataInicio || !filtro.dataFim) return;
    setCarregandoResumo(true);
    try {
      const { data, error } = await supabase.rpc("fn_extrato_resumo", {
        p_user_id: userId,
        p_empresa_id: empresaId,
        p_is_filial: isFilial,
        p_data_inicio: filtro.dataInicio,
        p_data_fim: filtro.dataFim,
      });
      if (error) throw error;
      setResumo(data?.[0] ?? null);
    } catch (error) {
      console.error("Erro ao carregar resumo do extrato:", error);
      toast.error("Erro ao carregar o resumo financeiro");
    } finally {
      setCarregandoResumo(false);
    }
  }, [userId, empresaId, isFilial, identidadeCarregando]);

  /** offset=0 substitui a lista (nova busca/filtro); offset>0 concatena ("carregar mais"). */
  const carregarLista = useCallback(async (filtro: FiltrosPeriodo, offset = 0) => {
    if (identidadeCarregando || !userId || !filtro.dataInicio || !filtro.dataFim) return;
    setCarregandoLista(true);
    try {
      const { data, error } = await supabase.rpc("fn_extrato_lista", {
        p_user_id: userId,
        p_empresa_id: empresaId,
        p_is_filial: isFilial,
        p_data_inicio: filtro.dataInicio,
        p_data_fim: filtro.dataFim,
        p_limit: PAGE_SIZE + 1,
        p_offset: offset,
      });
      if (error) throw error;
      const linhas = (data || []) as EventoExtrato[];
      const maisPaginas = linhas.length > PAGE_SIZE;
      const pagina = maisPaginas ? linhas.slice(0, PAGE_SIZE) : linhas;
      setEventos((prev) => (offset === 0 ? pagina : [...prev, ...pagina]));
      setTemMais(maisPaginas);
    } catch (error) {
      console.error("Erro ao carregar lista do extrato:", error);
      toast.error("Erro ao carregar o extrato");
    } finally {
      setCarregandoLista(false);
    }
  }, [userId, empresaId, isFilial, identidadeCarregando]);

  const carregarMais = useCallback((filtro: FiltrosPeriodo) => {
    carregarLista(filtro, eventos.length);
  }, [carregarLista, eventos.length]);

  return {
    resumo,
    carregandoResumo,
    carregarResumo,
    eventos,
    carregandoLista,
    temMais,
    carregarLista,
    carregarMais,
    identidadeCarregando,
  };
}
