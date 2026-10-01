import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIdentidade } from "./useResolvedUserId";
import type { FiltrosPeriodo } from "@/components/financeiro/FiltroPeriodoAvancado";
import { dataBrasiliaISO } from "@/lib/dataBrasilia";

export type OrigemEventoExtrato =
  | "venda_pdv"
  | "venda_avulsa"
  | "servico_avulso"
  | "ordem_servico"
  | "conta_receber"
  | "conta_pagar"
  | "pdv_sangria"
  | "pdv_suprimento"
  | "lancamento_manual"
  | "balanco_caixa";

/** Movimentações de caixa feitas no PDV (sangria/suprimento) — tag "PDV" e filtro "Só PDV". */
export const ORIGENS_PDV: OrigemEventoExtrato[] = ["pdv_sangria", "pdv_suprimento"];

export interface EventoExtrato {
  data: string;
  tipo: "entrada" | "saida";
  origem: OrigemEventoExtrato;
  valor: number;
  descricao: string;
  referencia_id: string;
  /**
   * false = está gravado mas não entra no saldo, nos cards nem em nenhum
   * relatório financeiro (só origem lancamento_manual/balanco_caixa pode
   * ser false; as outras origens vêm sempre true).
   */
  conta_no_saldo: boolean;
}

/** Origens editáveis/excluíveis no Extrato — vêm de extrato_lancamentos_manuais, então referencia_id é o id da linha lá. */
export const ORIGENS_EDITAVEIS: OrigemEventoExtrato[] = ["lancamento_manual", "balanco_caixa"];

export interface ResumoExtrato {
  saldo_atual: number;
  entradas_periodo: number;
  saidas_periodo: number;
}

/** Linha de extrato_lancamentos_manuais a gravar: entrada/saída manual ou ajuste do Balanço do caixa. */
export interface NovoLancamentoExtrato {
  tipo: "entrada" | "saida";
  valor: number;
  motivo?: string;
  /** YYYY-MM-DD (dia em Brasília). */
  data: string;
  categoria: "manual" | "balanco";
  /**
   * Se false, o lançamento é gravado mas não entra no saldo nem nos cards
   * de entradas/saídas (continua aparecendo na lista do Extrato, com o
   * selo "Fora do caixa"). Default true (comportamento de sempre). Só o
   * Balanço do caixa oferece essa opção ao criar; qualquer lançamento
   * manual ou de balanço pode ter isso mudado depois, ao editar.
   */
  contaNoSaldo?: boolean;
}

/** Edição de um lançamento manual/balanço já gravado: valor, data e se conta no saldo. */
export interface EdicaoLancamentoExtrato {
  id: string;
  valor: number;
  /** YYYY-MM-DD (dia em Brasília). */
  data: string;
  contaNoSaldo: boolean;
}

const PAGE_SIZE = 50;

/**
 * Financeiro → Extrato. Chama fn_extrato_resumo/fn_extrato_lista
 * (supabase/migrations/20260909150000_extrato_financeiro.sql +
 * 20260909160000_fix_extrato_valor_pago_zero.sql +
 * 20261001120000_extrato_sangria_suprimento_pdv.sql +
 * 20261001150000_extrato_lancamentos_manuais.sql +
 * 20261001160000_extrato_balanco_nao_contabil.sql +
 * 20261001170000_extrato_lancamentos_editar_excluir.sql) — toda a agregação e as
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

  /**
   * offset=0 substitui a lista (nova busca/filtro); offset>0 concatena ("carregar mais").
   * `origens` restringe a lista a essas origens (filtro no banco, por causa da paginação).
   */
  const carregarLista = useCallback(async (filtro: FiltrosPeriodo, offset = 0, origens?: OrigemEventoExtrato[]) => {
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
        p_origens: origens,
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

  const carregarMais = useCallback((filtro: FiltrosPeriodo, origens?: OrigemEventoExtrato[]) => {
    carregarLista(filtro, eventos.length, origens);
  }, [carregarLista, eventos.length]);

  /**
   * Saldo acumulado do Extrato agora (mesmo número do card "Saldo Atual"), buscado
   * na hora — base do Balanço do caixa. null se não deu para calcular.
   */
  const buscarSaldoAtual = useCallback(async (): Promise<number | null> => {
    if (identidadeCarregando || !userId) return null;
    const hoje = dataBrasiliaISO();
    const { data, error } = await supabase.rpc("fn_extrato_resumo", {
      p_user_id: userId,
      p_empresa_id: empresaId,
      p_is_filial: isFilial,
      p_data_inicio: hoje,
      p_data_fim: hoje,
    });
    if (error) {
      console.error("Erro ao calcular saldo do extrato:", error);
      return null;
    }
    return Number(data?.[0]?.saldo_atual ?? 0);
  }, [userId, empresaId, isFilial, identidadeCarregando]);

  /** Grava um lançamento manual ou ajuste de balanço para a loja/empresa da visão atual. */
  const criarLancamento = useCallback(async (lancamento: NovoLancamentoExtrato): Promise<boolean> => {
    if (identidadeCarregando || !userId) return false;
    const { error } = await supabase.from("extrato_lancamentos_manuais").insert({
      user_id: userId,
      empresa_id: empresaId,
      tipo: lancamento.tipo,
      valor: lancamento.valor,
      motivo: lancamento.motivo?.trim() || null,
      data: lancamento.data,
      categoria: lancamento.categoria,
      conta_no_saldo: lancamento.contaNoSaldo ?? true,
    });
    if (error) {
      console.error("Erro ao gravar lançamento do extrato:", error);
      toast.error("Erro ao gravar o lançamento");
      return false;
    }
    return true;
  }, [userId, empresaId, identidadeCarregando]);

  /** Edita valor/data/conta_no_saldo de um lançamento manual ou de balanço já gravado. */
  const atualizarLancamento = useCallback(async (edicao: EdicaoLancamentoExtrato): Promise<boolean> => {
    if (identidadeCarregando || !userId) return false;
    const { error, data } = await supabase
      .from("extrato_lancamentos_manuais")
      .update({
        valor: edicao.valor,
        data: edicao.data,
        conta_no_saldo: edicao.contaNoSaldo,
      })
      .eq("id", edicao.id)
      .select("id");
    if (error) {
      console.error("Erro ao editar lançamento do extrato:", error);
      toast.error("Erro ao editar o lançamento");
      return false;
    }
    if (!data || data.length === 0) {
      toast.error("Lançamento não encontrado ou sem permissão para editar.");
      return false;
    }
    return true;
  }, [userId, identidadeCarregando]);

  /** Exclui um lançamento manual ou de balanço. O saldo e os cards recalculam sozinhos (somam direto da tabela). */
  const excluirLancamento = useCallback(async (id: string): Promise<boolean> => {
    if (identidadeCarregando || !userId) return false;
    const { error, data } = await supabase
      .from("extrato_lancamentos_manuais")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) {
      console.error("Erro ao excluir lançamento do extrato:", error);
      toast.error("Erro ao excluir o lançamento");
      return false;
    }
    if (!data || data.length === 0) {
      toast.error("Só o dono da loja pode excluir este lançamento.");
      return false;
    }
    return true;
  }, [userId, identidadeCarregando]);

  return {
    buscarSaldoAtual,
    criarLancamento,
    atualizarLancamento,
    excluirLancamento,
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
