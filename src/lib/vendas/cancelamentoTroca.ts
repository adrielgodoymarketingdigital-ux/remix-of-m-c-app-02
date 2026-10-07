/**
 * Leitura da troca de uma linha de venda para o cancelamento (a decisão é
 * pura, em trocaPDV.ts → decidirCancelamentoTroca) e as gravações que o
 * cancelamento faz na troca: vendas_trocas.cancelada e, se pedido, a exclusão
 * lógica (deleted_at → lixeira de dispositivos) do aparelho recebido.
 * Venda com troca é cancelada inteira: linhasParaCancelar traz todas as
 * linhas principais ativas (ver linhasParaCancelarVendaInteira).
 */
import { supabase } from "@/integrations/supabase/client";
import { linhasParaCancelarVendaInteira, type LinhaVendaCancelavel, type SituacaoTrocaNoCancelamento } from "./trocaPDV";

/** Colunas que o cancelamento usa de cada linha (estorno de estoque e cascata do pagamento duplo). */
export interface LinhaDaVendaComTroca extends LinhaVendaCancelavel {
  tipo: string;
  user_id: string;
  grupo_venda: string | null;
  dispositivo_id: string | null;
  produto_id: string | null;
  peca_id: string | null;
  quantidade: number;
}

export interface TrocaDaVenda extends SituacaoTrocaNoCancelamento {
  trocaId: string | null;
  dispositivoId: string | null;
  valorEntrada: number;
  nomeAparelho: string | null;
  valorDevolvido: number;
  formaDevolucao: string | null;
  /** Linhas a cancelar junto (venda inteira); vazio sem troca. */
  linhasParaCancelar: { linha: LinhaDaVendaComTroca; estornar: boolean }[];
}

const SEM_TROCA: TrocaDaVenda = {
  trocaAtiva: false, aparelho: null, trocaId: null, dispositivoId: null, valorEntrada: 0, nomeAparelho: null,
  valorDevolvido: 0, formaDevolucao: null, linhasParaCancelar: [],
};

/**
 * Situação da troca da venda à qual a linha pertence. Sem troca → SEM_TROCA.
 * Erro de leitura LANÇA: sem saber se há troca, não dá para cancelar com
 * segurança (cancelar um item só de uma venda com troca deixaria a troca valendo).
 */
export async function carregarTrocaDaVenda(venda: { id: string; grupo_venda?: string | null }): Promise<TrocaDaVenda> {
  if (!venda.grupo_venda) return SEM_TROCA;

  const { data: troca, error } = await supabase
    .from("vendas_trocas")
    .select("id, dispositivo_entrada_id, valor_entrada, valor_devolvido, forma_devolucao")
    .eq("grupo_venda", venda.grupo_venda)
    .eq("cancelada", false)
    .maybeSingle();
  if (error) {
    console.error("[cancelamento] etapa=ler troca da venda", error);
    throw error;
  }
  if (!troca) return SEM_TROCA;

  const { data: linhas, error: erroLinhas } = await supabase
    .from("vendas")
    .select("id, tipo, user_id, grupo_venda, dispositivo_id, produto_id, peca_id, quantidade, observacoes, cancelada, parcela_numero")
    .eq("grupo_venda", venda.grupo_venda)
    .is("deleted_at", null)
    .order("data", { ascending: true });
  if (erroLinhas) throw erroLinhas;
  const linhasParaCancelar = linhasParaCancelarVendaInteira((linhas ?? []) as LinhaDaVendaComTroca[]);

  let aparelho: TrocaDaVenda["aparelho"] = null;
  let nomeAparelho: string | null = null;
  if (troca.dispositivo_entrada_id) {
    const { data: disp, error: erroDisp } = await supabase
      .from("dispositivos")
      .select("marca, modelo, vendido, quantidade, deleted_at")
      .eq("id", troca.dispositivo_entrada_id)
      .maybeSingle();
    if (erroDisp) throw erroDisp;
    if (disp) {
      aparelho = { vendido: disp.vendido === true || (disp.quantidade ?? 1) <= 0, excluido: !!disp.deleted_at };
      nomeAparelho = `${disp.marca ?? ""} ${disp.modelo ?? ""}`.trim() || null;
    }
  }

  return {
    trocaAtiva: true,
    aparelho,
    trocaId: troca.id,
    dispositivoId: troca.dispositivo_entrada_id,
    valorEntrada: Number(troca.valor_entrada) || 0,
    nomeAparelho,
    valorDevolvido: Number(troca.valor_devolvido) || 0,
    formaDevolucao: troca.forma_devolucao,
    linhasParaCancelar,
  };
}

export async function marcarTrocaCancelada(trocaId: string): Promise<void> {
  const { error } = await supabase.from("vendas_trocas").update({ cancelada: true }).eq("id", trocaId);
  if (error) throw error;
}

/** Exclusão lógica (vai para a lixeira de dispositivos, como o resto do sistema). */
export async function tirarAparelhoDaTrocaDoEstoque(dispositivoId: string): Promise<void> {
  const { error } = await supabase
    .from("dispositivos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", dispositivoId)
    .eq("vendido", false);
  if (error) throw error;
}
