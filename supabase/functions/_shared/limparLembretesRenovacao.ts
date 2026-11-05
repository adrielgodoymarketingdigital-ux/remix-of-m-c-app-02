// Apaga os lembretes de renovação já enviados (followup_control) quando o plano é
// pago. Idempotente, e uma falha aqui nunca derruba a confirmação do pagamento.
import type { AdminClient } from "./pagarmeAssinatura.ts";

/**
 * @param ate Apaga só lembretes enviados até este instante. Usar quando o pagamento
 * pode ser antigo (evento reenviado): lembrete posterior já é do ciclo seguinte.
 */
export async function limparLembretesRenovacao(
  supabaseAdmin: AdminClient,
  userId: string,
  log: (etapa: string, detalhes?: unknown) => void,
  ate?: string,
): Promise<void> {
  try {
    let consulta = supabaseAdmin.from("followup_control").delete().eq("user_id", userId);
    if (ate) consulta = consulta.lte("enviado_em", ate);

    const { error } = await consulta;
    if (error) {
      log("⚠️ Erro ao deletar followup_control (não crítico)", { userId, error: error.message });
    } else {
      log("🧹 followup_control limpo", { userId });
    }
  } catch (erro) {
    log("⚠️ Erro ao deletar followup_control (não crítico)", { userId, error: String(erro) });
  }
}
