/**
 * Leitura da troca de uma linha de venda para o cancelamento (a decisão é
 * pura, em trocaPDV.ts → decidirCancelamentoTroca) e as gravações que o
 * cancelamento faz na troca: vendas_trocas.cancelada e, se pedido, a exclusão
 * lógica (deleted_at → lixeira de dispositivos) do aparelho recebido.
 */
import { supabase } from "@/integrations/supabase/client";
import type { SituacaoTrocaNoCancelamento } from "./trocaPDV";

const MARCADOR_SECUNDARIO = "pagamento_duplo_secundario";

export interface TrocaDaVenda extends SituacaoTrocaNoCancelamento {
  trocaId: string | null;
  dispositivoId: string | null;
  valorEntrada: number;
  nomeAparelho: string | null;
}

const SEM_TROCA: TrocaDaVenda = {
  trocaAtiva: false, outrasLinhasAtivas: 0, aparelho: null, trocaId: null, dispositivoId: null, valorEntrada: 0, nomeAparelho: null,
};

/** Situação da troca da venda à qual a linha pertence. Sem troca (ou erro de leitura) → sem troca. */
export async function carregarTrocaDaVenda(venda: { id: string; grupo_venda?: string | null }): Promise<TrocaDaVenda> {
  if (!venda.grupo_venda) return SEM_TROCA;

  const { data: troca, error } = await supabase
    .from("vendas_trocas")
    .select("id, dispositivo_entrada_id, valor_entrada")
    .eq("grupo_venda", venda.grupo_venda)
    .eq("cancelada", false)
    .maybeSingle();
  if (error) {
    console.error("[cancelamento] etapa=ler troca da venda", error);
    return SEM_TROCA;
  }
  if (!troca) return SEM_TROCA;

  const { data: linhas, error: erroLinhas } = await supabase
    .from("vendas")
    .select("id, observacoes, cancelada")
    .eq("grupo_venda", venda.grupo_venda)
    .is("deleted_at", null);
  if (erroLinhas) throw erroLinhas;
  const outrasLinhasAtivas = (linhas ?? []).filter(
    (l) => l.id !== venda.id && !l.cancelada && l.observacoes !== MARCADOR_SECUNDARIO,
  ).length;

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
    outrasLinhasAtivas,
    aparelho,
    trocaId: troca.id,
    dispositivoId: troca.dispositivo_entrada_id,
    valorEntrada: Number(troca.valor_entrada) || 0,
    nomeAparelho,
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
