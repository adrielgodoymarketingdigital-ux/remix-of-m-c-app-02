import { MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO } from "../vendasFinanceiras.ts";
import type { ClienteBancoLike } from "./reconhecerSegundaForma.core.ts";

/**
 * Parcela da 2ª forma de um pagamento duplo (linha secundária em `vendas`) que
 * ficou órfã: a cascata do cancelamento não cancela parcela já recebida, a tela
 * de Vendas esconde linhas secundárias e excluir a conta a receber não mexe na
 * venda — então ela ficava presa no aviso de "custo não confirmado". Aqui ficam
 * os dois caminhos para resolvê-la: estornar pelo aviso e cancelar junto ao
 * excluir a conta a receber dela.
 */

const MOTIVO_ESTORNO = "Parcela da 2ª forma estornada pelo aviso de custo não confirmado";
const MOTIVO_CONTA_EXCLUIDA = "Conta a receber da parcela excluída";

// Sem união discriminada: o app roda sem strictNullChecks e o `if (!r.ok)` não estreitaria.
export type ResultadoEstorno = { ok: boolean; erro?: string };

async function cancelarLinhaSecundaria(
  client: ClienteBancoLike,
  vendaId: string,
  userId: string,
  motivo: string,
  agora: string,
): Promise<ResultadoEstorno | null> {
  const { data: linha, error } = await client
    .from("vendas")
    .select("id, observacoes, cancelada, deleted_at")
    .eq("id", vendaId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, erro: String(error.message || error) };
  // Só linha secundária ativa: venda comum ou já cancelada/excluída não é tocada.
  if (!linha || linha.observacoes !== MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO || linha.cancelada === true || linha.deleted_at) {
    return null;
  }

  const { error: updErr } = await client
    .from("vendas")
    .update({ cancelada: true, data_cancelamento: agora, motivo_cancelamento: motivo })
    .eq("id", vendaId)
    .eq("user_id", userId)
    .eq("observacoes", MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO);
  if (updErr) return { ok: false, erro: String(updErr.message || updErr) };
  return { ok: true };
}

/** "Estornar parcela" no aviso: cancela a linha secundária (sai do aviso e dos totais). */
export async function estornarParcelaSecundariaCore(
  client: ClienteBancoLike,
  params: { vendaId: string; userId: string },
  agora: string = new Date().toISOString(),
): Promise<ResultadoEstorno> {
  const r = await cancelarLinhaSecundaria(client, params.vendaId, params.userId, MOTIVO_ESTORNO, agora);
  return r ?? { ok: false, erro: "Parcela não encontrada ou já cancelada." };
}

/** Id da venda na descrição da conta a receber gerada para ela ("venda_id:<uuid>"). */
export const vendaIdDaDescricao = (descricao: string | null | undefined): string | null =>
  descricao?.match(/venda_id:([0-9a-fA-F-]{36})/)?.[1] ?? null;

export type ResultadoContaExcluida =
  | { status: "sem_parcela" }
  | { status: "parcela_cancelada"; vendaId: string }
  | { status: "erro"; mensagem: string };

/**
 * Depois de excluir uma conta a receber: se ela era de uma parcela secundária
 * ativa, cancela a parcela também (senão a venda continua contando como recebida
 * ou pendente sem a conta). Conta de venda comum não muda nada.
 */
export async function cancelarParcelaDaContaExcluidaCore(
  client: ClienteBancoLike,
  params: { descricao: string | null | undefined; userId: string },
  agora: string = new Date().toISOString(),
): Promise<ResultadoContaExcluida> {
  const vendaId = vendaIdDaDescricao(params.descricao);
  if (!vendaId) return { status: "sem_parcela" };
  const r = await cancelarLinhaSecundaria(client, vendaId, params.userId, MOTIVO_CONTA_EXCLUIDA, agora);
  if (!r) return { status: "sem_parcela" };
  return r.ok ? { status: "parcela_cancelada", vendaId } : { status: "erro", mensagem: r.erro };
}

/**
 * Grupos de venda (grupo_venda) cuja venda principal ainda está ativa. Parcela
 * de grupo com principal ativa não deve ser estornada pelo aviso — o caso dela é
 * confirmar o custo na venda, não desfazer o recebimento.
 */
export async function gruposComPrincipalAtivaCore(
  client: ClienteBancoLike,
  userId: string,
  grupos: string[],
): Promise<Set<string>> {
  if (grupos.length === 0) return new Set();
  const { data, error } = await client
    .from("vendas")
    .select("grupo_venda, observacoes, cancelada, deleted_at")
    .eq("user_id", userId)
    .in("grupo_venda", grupos);
  if (error) throw error;
  return new Set(
    ((data || []) as { grupo_venda: string; observacoes: string | null; cancelada: boolean | null; deleted_at: string | null }[])
      .filter((v) => v.observacoes !== MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO && v.cancelada !== true && !v.deleted_at)
      .map((v) => v.grupo_venda),
  );
}
