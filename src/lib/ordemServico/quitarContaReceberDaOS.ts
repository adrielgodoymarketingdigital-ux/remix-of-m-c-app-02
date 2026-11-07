import { supabase } from "@/integrations/supabase/client";
import {
  quitarContaReceberDaOSCore,
  lerContaDaOSCore,
  type ParametrosQuitacaoOS,
  type ResultadoQuitacaoOS,
} from "./quitarContaReceberDaOS.core";

export {
  escolherContaDaOS,
  mapaStatusContaPorOS,
  isContaOSQuitada,
  type ParametrosQuitacaoOS,
  type ResultadoQuitacaoOS,
} from "./quitarContaReceberDaOS.core";

/**
 * Baixa da conta a receber da OS na entrega — nunca cria uma 2ª conta para
 * uma OS que já foi recebida em Contas. Regras no .core.ts.
 */
export async function quitarContaReceberDaOS(p: ParametrosQuitacaoOS): Promise<ResultadoQuitacaoOS> {
  const resultado = await quitarContaReceberDaOSCore(supabase, p);
  if (resultado.status === "erro") {
    console.error(`[OS ${p.numeroOS}] baixa da conta a receber falhou (${resultado.etapa}):`, resultado.mensagem);
  } else if (resultado.status === "pagamento_registrado" && !resultado.quitou) {
    console.warn(`[OS ${p.numeroOS}] pagamento do saldo registrado, mas a conta segue pendente`);
  }
  return resultado;
}

/** Conta da OS para leituras pontuais (quitada mais antiga, senão a mais antiga). */
export function lerContaDaOS(userId: string, numeroOS: string) {
  return lerContaDaOSCore(supabase, userId, numeroOS);
}
