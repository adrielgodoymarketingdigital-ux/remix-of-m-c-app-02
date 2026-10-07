/**
 * Troca da venda para recibos reabertos (histórico de Vendas, Dispositivos
 * vendidos): vendas_trocas pelo grupo_venda + o aparelho recebido.
 *
 * Nunca lança: sem troca, sem permissão (RLS) ou erro de rede → null, e o
 * recibo sai como antes. Aparelho ilegível (excluído de vez, gerente de filial
 * sem acesso a dispositivos do dono) → bloco só com os valores.
 */
import { supabase } from "@/integrations/supabase/client";
import type { DadosTrocaRecibo } from "./reciboTroca";

export async function carregarTrocaRecibo(grupoVenda: string | null | undefined): Promise<DadosTrocaRecibo | null> {
  if (!grupoVenda) return null;
  try {
    const { data: troca, error } = await supabase
      .from("vendas_trocas")
      .select("valor_entrada, cancelada, dispositivo_entrada_id, valor_devolvido, forma_devolucao")
      .eq("grupo_venda", grupoVenda)
      .maybeSingle();
    if (error || !troca) {
      if (error) console.error("[recibo] etapa=ler troca da venda", error);
      return null;
    }
    let aparelho: DadosTrocaRecibo["aparelho"] = null;
    if (troca.dispositivo_entrada_id) {
      const { data: disp, error: erroDisp } = await supabase
        .from("dispositivos")
        .select("marca, modelo, capacidade_gb, cor, imei")
        .eq("id", troca.dispositivo_entrada_id)
        .maybeSingle();
      if (erroDisp) console.error("[recibo] etapa=ler aparelho da troca", erroDisp);
      if (disp) aparelho = { marca: disp.marca, modelo: disp.modelo, capacidadeGb: disp.capacidade_gb, cor: disp.cor, imei: disp.imei };
    }
    return {
      aparelho,
      valorEntrada: Number(troca.valor_entrada) || 0,
      cancelada: troca.cancelada === true,
      valorDevolvido: Number(troca.valor_devolvido) || 0,
      formaDevolucao: troca.forma_devolucao === "pix" || troca.forma_devolucao === "dinheiro" ? troca.forma_devolucao : null,
    };
  } catch (e) {
    console.error("[recibo] etapa=ler troca da venda (falha inesperada)", e);
    return null;
  }
}
