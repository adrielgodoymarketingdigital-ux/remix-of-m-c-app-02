import { supabase } from "@/integrations/supabase/client";
import { dataHoje } from "@/lib/formatters";

export interface DadosContaAReceberOS {
  numeroOS: string;
  clienteId?: string | null;
  clienteNome: string;
  defeitoRelatado: string;
  total: number;
  entradaPaga: number;
  formaPagamentoEntrada?: string;
  dataVencimentoPrazo?: string;
  effectiveUserId: string;
}

/**
 * Cria a conta a receber correspondente a uma OS recém-criada com valor total > 0.
 *
 * Modelo novo (usa_historico_pagamentos = true): `valor` guarda SEMPRE o total.
 * Uma entrada vira uma linha em `pagamentos_contas` — o trigger recalcula
 * `valor_pago`/`status`. `cliente_id` é gravado para a listagem mostrar o nome.
 */
export async function criarContaAReceberOS(dados: DadosContaAReceberOS): Promise<void> {
  const {
    numeroOS,
    clienteId,
    clienteNome,
    defeitoRelatado,
    total,
    entradaPaga,
    formaPagamentoEntrada,
    dataVencimentoPrazo,
    effectiveUserId,
  } = dados;

  const temEntrada = entradaPaga > 0;

  const descricaoConta = temEntrada
    ? `OS ${numeroOS} - ${defeitoRelatado} (Entrada paga: R$ ${entradaPaga.toFixed(2)})`
    : `Ordem de Serviço ${numeroOS} - ${defeitoRelatado}`;

  const { data: contaCriada, error } = await supabase
    .from("contas")
    .insert({
      nome: `OS ${numeroOS} - ${clienteNome}`,
      tipo: "receber",
      valor: total, // sempre o total — a entrada é uma linha em pagamentos_contas
      data: dataVencimentoPrazo || dataHoje(),
      data_vencimento: dataVencimentoPrazo || null,
      valor_pago: 0,
      cliente_id: clienteId || null,
      os_numero: numeroOS,
      status: "pendente",
      recorrente: false,
      categoria: "Serviços",
      descricao: descricaoConta,
      user_id: effectiveUserId,
      usa_historico_pagamentos: true,
    })
    .select("id")
    .single();

  // Não lança: falha ao criar a conta não deve abortar a criação da OS
  // (mesmo comportamento tolerante de antes).
  if (error || !contaCriada) {
    console.error("Erro ao criar conta a receber da OS:", error);
    return;
  }

  if (temEntrada) {
    const { error: erroPag } = await supabase.from("pagamentos_contas").insert({
      conta_id: contaCriada.id,
      user_id: effectiveUserId,
      valor: entradaPaga,
      data_pagamento: dataHoje(),
      forma_pagamento: formaPagamentoEntrada || null,
      observacao: "Entrada",
    });
    // trigger sync_conta_from_pagamentos atualiza valor_pago e status
    if (erroPag) console.error("Erro ao registrar entrada da OS:", erroPag);
  }
}
