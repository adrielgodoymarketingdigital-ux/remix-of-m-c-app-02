import { supabase } from "@/integrations/supabase/client";
import {
  extrairVendaIdDaDescricao,
  propagarStatusContaParaVendaCore,
  reconhecerRecebimentoVendaVinculadaCore,
  reverterRecebimentoVendaVinculadaCore,
  MENSAGEM_CUSTO_NAO_CONFIRMADO,
  type ResultadoReconhecimento,
} from "./reconhecerSegundaForma.core";

/**
 * Fachada com o cliente Supabase real. A lógica (e a documentação do bug de
 * "lucro negativo" em pagamento duplo a receber) está em
 * reconhecerSegundaForma.core.ts.
 */
export { extrairVendaIdDaDescricao, MENSAGEM_CUSTO_NAO_CONFIRMADO };
export type { ResultadoReconhecimento };

/**
 * Propaga para a linha `vendas` o recebimento de uma venda a prazo. TODO caminho
 * que confirma recebimento (conta a receber, tela de Vendas, baixa de conta
 * virtual) deve passar por aqui.
 */
export const reconhecerRecebimentoVendaVinculada = (
  vendaId: string,
  dataRecebimento: string,
  userId: string,
): Promise<ResultadoReconhecimento> =>
  reconhecerRecebimentoVendaVinculadaCore(supabase, vendaId, dataRecebimento, userId);

export const reverterRecebimentoVendaVinculada = (vendaId: string, userId: string): Promise<void> =>
  reverterRecebimentoVendaVinculadaCore(supabase, vendaId, userId);

export const propagarStatusContaParaVenda = (
  conta: { descricao?: string | null; tipo?: string | null; data_pagamento?: string | null },
  novoStatus: string,
  userId: string,
): Promise<ResultadoReconhecimento | null> =>
  propagarStatusContaParaVendaCore(supabase, conta, novoStatus, userId);
