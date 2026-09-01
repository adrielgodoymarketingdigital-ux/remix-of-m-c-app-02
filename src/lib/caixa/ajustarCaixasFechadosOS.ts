// ============================================================================
// Correção retroativa de caixas JÁ FECHADOS quando o pagamento de uma OS muda
// ----------------------------------------------------------------------------
// Espelha o padrão já usado para vendas em src/hooks/useVendas.ts (ajuste dos
// totais congelados de um caixa fechado quando uma venda é editada depois).
// Aqui a "chave" para achar o caixa certo é a data de cada evento de
// recebimento da OS (entrada -> data de abertura da OS; saldo -> data_caixa).
//
// Só mexe em caixas com status='fechado'. Caixa aberto se resolve sozinho no
// próximo fechamento (useCaixa.fecharCaixa lê o estado atual da OS).
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import {
  agregarServicosNoCaixa,
  derivarEventosRecebimentoOS,
  type OrdemParaCaixa,
} from "./servicosCaixa";

export interface AjusteCaixasFechadosOSParams {
  /** Estado da OS ANTES da alteração (null = OS não existia / não era entregue). */
  ordemAntes: OrdemParaCaixa | null;
  /** Estado da OS DEPOIS da alteração. */
  ordemDepois: OrdemParaCaixa;
  /** Status da conta a receber vinculada, antes/depois (para getValorFaturavelOS). */
  statusContaAntes?: string | null;
  statusContaDepois?: string | null;
  /** user_id usado nos caixas (proprietário/dono da loja). */
  userIdCaixa: string;
  /** empresa_id do contexto (null = matriz). */
  empresaId: string | null;
}

/**
 * Aplica, a cada caixa fechado afetado, a diferença (depois - antes) dos
 * valores de serviço por forma de pagamento, de total_servicos, total_vendas e
 * saldo_final. saldo_final só é movido pela parte em DINHEIRO (mesma fórmula do
 * fechamento: saldo = saldo_inicial + total_dinheiro + suprimentos - sangrias).
 * Falhas são logadas e engolidas — nunca devem bloquear o salvamento da OS.
 */
export async function ajustarCaixasFechadosOS(
  params: AjusteCaixasFechadosOSParams,
): Promise<void> {
  const { ordemAntes, ordemDepois, userIdCaixa, empresaId } = params;

  try {
    const eventosAntes = ordemAntes
      ? derivarEventosRecebimentoOS(ordemAntes, params.statusContaAntes)
      : [];
    const eventosDepois = derivarEventosRecebimentoOS(ordemDepois, params.statusContaDepois);

    const datas = [
      ...eventosAntes.map((e) => e.data),
      ...eventosDepois.map((e) => e.data),
    ].filter((d): d is string => !!d);

    if (datas.length === 0) return;

    datas.sort();
    const menorData = datas[0];
    const maiorData = datas[datas.length - 1];

    const { data: caixas, error } = await supabase
      .from("caixas")
      .select("*")
      .eq("status", "fechado")
      .or(`proprietario_id.eq.${userIdCaixa},user_id.eq.${userIdCaixa}`)
      .lte("data_abertura", `${maiorData}T23:59:59`)
      .gte("data_fechamento", menorData);

    if (error) throw error;

    // Mesmo critério condicional de empresa_id usado em fecharCaixa (useCaixa.ts):
    // só filtra quando o caixa tem empresa_id preenchido.
    const caixasAfetados = (caixas ?? []).filter(
      (c: { empresa_id: string | null }) => !c.empresa_id || c.empresa_id === empresaId,
    );

    for (const caixa of caixasAfetados) {
      const ini = String(caixa.data_abertura);
      const fim = String(caixa.data_fechamento ?? new Date().toISOString());

      const antes = agregarServicosNoCaixa(eventosAntes, ini, fim);
      const depois = agregarServicosNoCaixa(eventosDepois, ini, fim);

      const dDin = depois.total_dinheiro - antes.total_dinheiro;
      const dPix = depois.total_pix - antes.total_pix;
      const dCar = depois.total_cartao - antes.total_cartao;
      const dRec = depois.total_a_receber - antes.total_a_receber;
      const dServ = depois.total_servicos - antes.total_servicos;

      if (!dDin && !dPix && !dCar && !dRec && !dServ) continue;

      const dVendas = dDin + dPix + dCar + dRec;

      const { error: erroUpdate } = await supabase
        .from("caixas")
        .update({
          total_dinheiro: Number(caixa.total_dinheiro || 0) + dDin,
          total_pix: Number(caixa.total_pix || 0) + dPix,
          total_cartao: Number(caixa.total_cartao || 0) + dCar,
          total_a_receber: Number(caixa.total_a_receber || 0) + dRec,
          total_servicos: Number(caixa.total_servicos || 0) + dServ,
          total_vendas: Number(caixa.total_vendas || 0) + dVendas,
          saldo_final: Number(caixa.saldo_final || 0) + dDin,
        })
        .eq("id", caixa.id);

      if (erroUpdate) throw erroUpdate;
    }
  } catch (e) {
    console.error("[ajustarCaixasFechadosOS] falha ao ajustar caixa(s) fechado(s):", e);
  }
}
