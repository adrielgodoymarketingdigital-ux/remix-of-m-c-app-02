/** Origens dos eventos de fn_extrato_eventos_raw e seus rótulos na lista do Extrato. */
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
  | "balanco_caixa"
  /** Seção 9: diferença da troca devolvida ao cliente; referencia_id = vendas_trocas.id. */
  | "devolucao_troca";

export const LABEL_ORIGEM_EXTRATO: Record<OrigemEventoExtrato, string> = {
  venda_pdv: "Venda",
  venda_avulsa: "Venda Avulsa",
  servico_avulso: "Serviço Avulso",
  ordem_servico: "Ordem de Serviço",
  conta_receber: "Conta a Receber",
  conta_pagar: "Conta a Pagar",
  pdv_sangria: "Sangria",
  pdv_suprimento: "Suprimento",
  lancamento_manual: "Lançamento Manual",
  balanco_caixa: "Balanço do Caixa",
  devolucao_troca: "Devolução de troca",
};

/** Origens que abrem o popup de detalhes (a devolução abre o detalhe da venda da troca). */
export const ORIGENS_COM_DETALHE: OrigemEventoExtrato[] = ["venda_pdv", "ordem_servico", "devolucao_troca"];
