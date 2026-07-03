import { supabase } from "@/integrations/supabase/client";
import { dataHoje } from "@/lib/formatters";

export interface DadosContaAReceberOS {
  numeroOS: string;
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
 */
export async function criarContaAReceberOS(dados: DadosContaAReceberOS): Promise<void> {
  const { numeroOS, clienteNome, defeitoRelatado, total, entradaPaga, formaPagamentoEntrada, dataVencimentoPrazo, effectiveUserId } = dados;

  const saldoRestante = Math.max(0, total - entradaPaga);
  const temEntrada = entradaPaga > 0;

  const descricaoConta = temEntrada
    ? `OS ${numeroOS} - ${defeitoRelatado} (Entrada paga: R$ ${entradaPaga.toFixed(2)})`
    : `Ordem de Serviço ${numeroOS} - ${defeitoRelatado}`;

  await supabase.from("contas").insert({
    nome: `OS ${numeroOS} - ${clienteNome}`,
    tipo: "receber",
    valor: saldoRestante > 0 ? saldoRestante : total,
    data: dataVencimentoPrazo || dataHoje(),
    data_vencimento: dataVencimentoPrazo || null,
    valor_pago: entradaPaga > 0 ? entradaPaga : null,
    forma_pagamento: entradaPaga > 0 && formaPagamentoEntrada ? (formaPagamentoEntrada as any) : null,
    os_numero: numeroOS,
    status: "pendente",
    recorrente: false,
    categoria: "Serviços",
    descricao: descricaoConta,
    user_id: effectiveUserId,
  });
}
