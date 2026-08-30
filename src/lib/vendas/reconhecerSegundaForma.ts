import { supabase } from "@/integrations/supabase/client";
import { MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO } from "@/lib/vendasFinanceiras";
import { calcularCustoUnitarioParcelaSecundaria } from "@/lib/vendas/rateioSegundaForma";

/**
 * Reconhecimento diferido de receita/custo da 2ª forma de pagamento "a receber"
 * (pagamento duplo) e das vendas "a receber"/"a prazo" primárias.
 *
 * Contexto do bug corrigido: numa venda de pagamento duplo cuja 2ª forma é
 * "a receber", getVendaReceitaLiquida reconhece só a parte já paga da receita
 * (total − valor_segunda_forma), mas o custo era reconhecido inteiro na linha
 * principal — jogando o lucro do período para negativo. E as linhas
 * secundárias (observacoes = "pagamento_duplo_secundario") nunca voltavam ao
 * cálculo quando a parcela era paga, então a receita da 2ª forma sumia de vez.
 *
 * Correção (opção b):
 *  - getVendaCustoTotal difere o custo da linha principal na MESMA proporção da
 *    receita reconhecida (calcularFracaoCustoReconhecidaAgora).
 *  - Quando a Conta a Receber de uma parcela da 2ª forma é marcada como
 *    recebida, este módulo grava na linha secundária: recebido = true,
 *    data_recebimento (competência = data do recebimento) e a fatia de custo
 *    proporcional em custo_unitario (que estava zerada). A partir daí
 *    deveContarSecundarioNoLucro a inclui no lucro do período do recebimento.
 *
 * Escopo: item único por venda (o caso real observado). Carrinho com 2+ itens
 * em pagamento duplo a receber tem imprecisão pré-existente em
 * getVendaReceitaLiquida — ver DIVIDA-TECNICA.md.
 */

const toNum = (v: unknown): number => Number((v as number | string | null | undefined) || 0);

/** Extrai o id da venda de uma descricao no formato "venda_id:<uuid>". */
export const extrairVendaIdDaDescricao = (descricao?: string | null): string | null => {
  if (!descricao) return null;
  const m = descricao.match(/venda_id:([0-9a-fA-F-]{36})/);
  return m ? m[1] : null;
};

interface RefItem {
  dispositivo_id?: string | null;
  produto_id?: string | null;
  peca_id?: string | null;
}

/**
 * Coluna/valor que identifica o item da venda, para casar a linha secundária
 * com a linha principal (e as demais parcelas) dentro do mesmo grupo_venda.
 */
const colunaItem = (ref: RefItem): { coluna: "dispositivo_id" | "produto_id" | "peca_id"; valor: string } | null => {
  if (ref.dispositivo_id) return { coluna: "dispositivo_id", valor: ref.dispositivo_id };
  if (ref.produto_id) return { coluna: "produto_id", valor: ref.produto_id };
  if (ref.peca_id) return { coluna: "peca_id", valor: ref.peca_id };
  return null;
};

/**
 * Propaga para a linha `vendas` o recebimento registrado numa Conta a Receber
 * (descricao "venda_id:<id>") que acabou de ir para status "recebido".
 *
 * - Venda a_receber/a_prazo PRIMÁRIA: só marca recebido = true + data_recebimento
 *   (antes, marcar a conta como paga não refletia na venda → a venda nunca
 *   entrava no faturamento/lucro).
 * - Linha SECUNDÁRIA de pagamento duplo: além disso, grava a fatia de custo
 *   proporcional em custo_unitario.
 *
 * Idempotente. Silencioso em erro (loga) para não travar o fluxo de baixa de
 * contas — a conta continua marcada como recebida de qualquer forma.
 */
export const reconhecerRecebimentoVendaVinculada = async (
  vendaId: string,
  dataRecebimento: string,
  userId: string,
): Promise<void> => {
  try {
    const { data: venda, error } = await supabase
      .from("vendas")
      .select(
        "id, user_id, observacoes, grupo_venda, produto_id, dispositivo_id, peca_id, total, quantidade, forma_pagamento, recebido, custo_unitario, data_recebimento",
      )
      .eq("id", vendaId)
      .maybeSingle();

    if (error || !venda) return;
    if (venda.user_id !== userId) return;
    if (venda.forma_pagamento !== "a_receber" && venda.forma_pagamento !== "a_prazo") return;

    const ehSecundaria = venda.observacoes === MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO;

    // Já reconhecida com custo (secundária) ou já recebida (primária) → nada a fazer
    if (venda.recebido === true && venda.data_recebimento) {
      if (!ehSecundaria) return;
      if (toNum(venda.custo_unitario) > 0) return;
    }

    const update: Record<string, unknown> = {
      recebido: true,
      data_recebimento: dataRecebimento,
    };

    if (ehSecundaria && venda.grupo_venda) {
      const item = colunaItem(venda);

      // Linha principal do mesmo item nesse grupo de venda
      let qPrincipal = supabase
        .from("vendas")
        .select("total, valor_desconto_manual, valor_desconto_cupom, valor_segunda_forma, custo_unitario, quantidade")
        .eq("user_id", userId)
        .eq("grupo_venda", venda.grupo_venda)
        .neq("id", venda.id)
        .neq("observacoes", MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO)
        .neq("cancelada", true)
        .limit(1);
      if (item) qPrincipal = qPrincipal.eq(item.coluna, item.valor);
      const { data: principal } = await qPrincipal.maybeSingle();

      // Soma de TODAS as parcelas secundárias do mesmo item nesse grupo
      let qParcelas = supabase
        .from("vendas")
        .select("total")
        .eq("user_id", userId)
        .eq("grupo_venda", venda.grupo_venda)
        .eq("observacoes", MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO);
      if (item) qParcelas = qParcelas.eq(item.coluna, item.valor);
      const { data: parcelas } = await qParcelas;
      const somaParcelas = (parcelas || []).reduce(
        (acc: number, p: { total?: number | string | null }) => acc + toNum(p.total),
        0,
      );

      if (principal) {
        update.custo_unitario = calcularCustoUnitarioParcelaSecundaria(
          principal,
          toNum(venda.total),
          somaParcelas,
          toNum(venda.quantidade || 1),
        );
      }
    }

    const { error: updErr } = await supabase
      .from("vendas")
      .update(update)
      .eq("id", venda.id)
      .eq("user_id", userId);
    if (updErr) console.error("[reconhecerSegundaForma] erro ao atualizar venda:", updErr);
  } catch (e) {
    console.error("[reconhecerSegundaForma] falha inesperada:", e);
  }
};

/**
 * Reverte reconhecerRecebimentoVendaVinculada quando a Conta a Receber volta
 * para "pendente" (ou é despagada). Zera o custo diferido da linha secundária.
 */
export const reverterRecebimentoVendaVinculada = async (
  vendaId: string,
  userId: string,
): Promise<void> => {
  try {
    const { data: venda } = await supabase
      .from("vendas")
      .select("id, user_id, observacoes, forma_pagamento")
      .eq("id", vendaId)
      .maybeSingle();
    if (!venda || venda.user_id !== userId) return;
    if (venda.forma_pagamento !== "a_receber" && venda.forma_pagamento !== "a_prazo") return;

    const update: Record<string, unknown> = { recebido: false, data_recebimento: null };
    if (venda.observacoes === MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO) update.custo_unitario = 0;

    const { error } = await supabase
      .from("vendas")
      .update(update)
      .eq("id", venda.id)
      .eq("user_id", userId);
    if (error) console.error("[reconhecerSegundaForma] erro ao reverter venda:", error);
  } catch (e) {
    console.error("[reconhecerSegundaForma] falha inesperada ao reverter:", e);
  }
};

/**
 * Dado o objeto de conta (real, da tabela contas) que acabou de mudar de
 * status, dispara o reconhecimento/reversão na venda vinculada se a conta for
 * do tipo "receber" e apontar para uma venda ("venda_id:" na descricao).
 */
export const propagarStatusContaParaVenda = async (
  conta: { descricao?: string | null; tipo?: string | null; data_pagamento?: string | null },
  novoStatus: string,
  userId: string,
): Promise<void> => {
  if (conta.tipo !== "receber") return;
  const vendaId = extrairVendaIdDaDescricao(conta.descricao);
  if (!vendaId) return;

  if (novoStatus === "recebido") {
    const dataRecebimento =
      conta.data_pagamento || new Date().toISOString().slice(0, 10);
    await reconhecerRecebimentoVendaVinculada(vendaId, dataRecebimento, userId);
  } else if (novoStatus === "pendente") {
    await reverterRecebimentoVendaVinculada(vendaId, userId);
  }
};
