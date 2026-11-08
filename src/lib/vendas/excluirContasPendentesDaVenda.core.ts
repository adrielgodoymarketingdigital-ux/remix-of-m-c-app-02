import type { ClienteBancoLike } from "./reconhecerSegundaForma.core.ts";

/**
 * Contas a Receber das linhas de venda canceladas (contas.descricao =
 * "venda_id:<id da linha>", tipo "receber"): apaga as que ainda não tiveram
 * nenhum dinheiro (status "pendente" E valor_pago = 0). Mesmo padrão da
 * cascata da 2ª forma e de editarVenda — `contas` não tem status "cancelada"
 * nem deleted_at, então cancelar conta = DELETE.
 *
 * REGRA DE SEGURANÇA: conta recebida, paga ou com pagamento parcial
 * (valor_pago > 0) nunca é apagada — o DELETE levaria junto o histórico de
 * pagamentos_contas (ON DELETE CASCADE). Ela fica como está e volta contada
 * em `preservadasRecebidas` (exige estorno manual). Os dois filtros
 * (status e valor_pago) são repetidos no DELETE contra corrida com uma baixa
 * feita ao mesmo tempo.
 */

export type ResultadoContasDaVenda =
  | { status: "ok"; excluidas: number; preservadasRecebidas: number }
  | { status: "erro"; mensagem: string; excluidas: number; preservadasRecebidas: number };

interface ContaRow {
  id: string;
  status?: string | null;
  valor_pago?: number | string | null;
}

/** Só a conta sem dinheiro nenhum pode ser apagada. */
export const contaPodeSerExcluida = (c: ContaRow): boolean =>
  c.status === "pendente" && c.valor_pago != null && Number(c.valor_pago) === 0;

const mensagemDe = (e: unknown): string => {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
};

export const excluirContasPendentesDaVendaCore = async (
  client: ClienteBancoLike,
  args: { vendaIds: string[]; userId: string | null },
): Promise<ResultadoContasDaVenda> => {
  const vazio = { excluidas: 0, preservadasRecebidas: 0 };
  try {
    const ids = args.vendaIds.filter(Boolean);
    if (!args.userId || ids.length === 0) return { status: "ok", ...vazio };

    const { data, error } = await client
      .from("contas")
      .select("id, status, valor_pago")
      .eq("user_id", args.userId)
      .eq("tipo", "receber")
      .in(
        "descricao",
        ids.map((id) => `venda_id:${id}`),
      );
    if (error) return { status: "erro", mensagem: mensagemDe(error), ...vazio };

    const contas = (data || []) as ContaRow[];
    const aExcluir = contas.filter(contaPodeSerExcluida).map((c) => c.id);
    const preservadasRecebidas = contas.length - aExcluir.length;
    if (aExcluir.length === 0) return { status: "ok", excluidas: 0, preservadasRecebidas };

    const { data: apagadas, error: delErr } = await client
      .from("contas")
      .delete()
      .in("id", aExcluir)
      .eq("user_id", args.userId)
      .eq("tipo", "receber")
      .eq("status", "pendente")
      .eq("valor_pago", 0)
      .select("id");
    if (delErr) {
      return { status: "erro", mensagem: mensagemDe(delErr), excluidas: 0, preservadasRecebidas };
    }

    const excluidas = (apagadas || []).length;
    // Alguma conta recebeu dinheiro entre a leitura e o DELETE: ficou intacta.
    const mudaram = aExcluir.length - excluidas;
    if (mudaram > 0) {
      return {
        status: "erro",
        mensagem: `${mudaram} conta(s) a receber mudaram durante o cancelamento e não foram removidas`,
        excluidas,
        preservadasRecebidas,
      };
    }
    return { status: "ok", excluidas, preservadasRecebidas };
  } catch (e) {
    return { status: "erro", mensagem: e instanceof Error ? e.message : "falha inesperada", ...vazio };
  }
};
