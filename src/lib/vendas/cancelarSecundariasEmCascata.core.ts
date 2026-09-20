import { MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO } from "../vendasFinanceiras.ts";
import { colunaItem, type ClienteBancoLike, type RefItem } from "./reconhecerSegundaForma.core.ts";

/**
 * Cascata do cancelamento de uma venda com pagamento duplo: as linhas
 * secundárias (observacoes = "pagamento_duplo_secundario", mesmo grupo_venda e
 * mesmo item) e as Contas a Receber vinculadas ("venda_id:<id da secundária>")
 * ainda pendentes são canceladas/excluídas junto com a principal.
 *
 * REGRA DE SEGURANÇA: parcela a prazo JÁ RECEBIDA (linha recebida, conta
 * recebida/paga ou com pagamento parcial) nunca é cancelada automaticamente —
 * dinheiro que entrou exige decisão manual (estorno). Ela fica de fora e volta
 * sinalizada em `parcelasRecebidasParaRevisao`; as demais parcelas (pendentes)
 * são canceladas normalmente e NÃO ficam travadas por causa da irmã recebida.
 * Se TODAS as parcelas a prazo estão recebidas, nada é cancelado.
 *
 * Secundárias "à vista" (pix/dinheiro/cartão) não são recebíveis: são só o
 * registro auxiliar do pagamento embutido no total; são canceladas junto, sem
 * contar como "parcela recebida".
 */

export type ResultadoCascata =
  | { status: "sem_secundarias" }
  // parcelasRecebidasParaRevisao = 0 → cascata completa; > 0 → parcial (ficaram só as recebidas)
  | {
      status: "cancelado";
      secundariasCanceladas: number;
      contasExcluidas: number;
      parcelasRecebidasParaRevisao: number;
    }
  // todas as parcelas a prazo já recebidas: nada a cancelar, exige estorno manual
  | { status: "bloqueado_parcela_recebida"; parcelasRecebidas: number }
  | { status: "erro"; mensagem: string };

export interface VendaParaCascata extends RefItem {
  id: string;
  user_id: string | null;
  grupo_venda?: string | null;
  observacoes?: string | null;
}

interface SecundariaRow {
  id: string;
  forma_pagamento?: string | null;
  recebido?: boolean | null;
  cancelada?: boolean | null;
  deleted_at?: string | null;
}

interface ContaRow {
  id: string;
  descricao?: string | null;
  status?: string | null;
  valor_pago?: number | string | null;
}

const ehPrazo = (forma?: string | null) => forma === "a_receber" || forma === "a_prazo";

export const cancelarSecundariasEmCascataCore = async (
  client: ClienteBancoLike,
  venda: VendaParaCascata,
  opts: { motivo?: string | null; agora?: string } = {},
): Promise<ResultadoCascata> => {
  try {
    if (!venda.user_id || !venda.grupo_venda) return { status: "sem_secundarias" };
    // Chamada com uma linha secundária (não é o fluxo normal): nada a cascatear.
    if (venda.observacoes === MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO) return { status: "sem_secundarias" };

    const item = colunaItem(venda);
    let q = client
      .from("vendas")
      .select("id, forma_pagamento, recebido, cancelada, deleted_at")
      .eq("user_id", venda.user_id)
      .eq("grupo_venda", venda.grupo_venda)
      .eq("observacoes", MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO);
    if (item) q = q.eq(item.coluna, item.valor);
    const { data, error } = await q;
    if (error) return { status: "erro", mensagem: String(error.message || error) };

    const secundarias = ((data || []) as SecundariaRow[]).filter(
      (s) => s.cancelada !== true && !s.deleted_at,
    );
    if (secundarias.length === 0) return { status: "sem_secundarias" };

    const prazo = secundarias.filter((s) => ehPrazo(s.forma_pagamento));
    const idsPrazo = prazo.map((s) => s.id);

    // Contas vinculadas às parcelas a prazo
    let contas: ContaRow[] = [];
    if (idsPrazo.length > 0) {
      const { data: contasData, error: contasErr } = await client
        .from("contas")
        .select("id, descricao, status, valor_pago")
        .eq("user_id", venda.user_id)
        .in(
          "descricao",
          idsPrazo.map((id) => `venda_id:${id}`),
        );
      if (contasErr) return { status: "erro", mensagem: String(contasErr.message || contasErr) };
      contas = (contasData || []) as ContaRow[];
    }

    const contaPorVenda = new Map<string, ContaRow>();
    for (const c of contas) {
      const m = c.descricao?.match(/venda_id:([0-9a-fA-F-]{36})/);
      if (m) contaPorVenda.set(m[1], c);
    }

    const recebidas = prazo.filter((s) => {
      const conta = contaPorVenda.get(s.id);
      const contaMovimentada =
        !!conta &&
        (conta.status === "recebido" || conta.status === "pago" || Number(conta.valor_pago || 0) > 0);
      return s.recebido === true || contaMovimentada;
    });

    const idsRecebidas = new Set(recebidas.map((s) => s.id));
    const aCancelar = secundarias.filter((s) => !idsRecebidas.has(s.id));

    // Nada a cancelar: só sobraram parcelas já recebidas → decisão manual
    if (aCancelar.length === 0) {
      return { status: "bloqueado_parcela_recebida", parcelasRecebidas: recebidas.length };
    }

    const idsSecundarias = aCancelar.map((s) => s.id);
    const agora = opts.agora ?? new Date().toISOString();
    const { error: updErr } = await client
      .from("vendas")
      .update({
        cancelada: true,
        data_cancelamento: agora,
        motivo_cancelamento: opts.motivo || "Cancelamento da venda principal (pagamento duplo)",
      })
      .in("id", idsSecundarias)
      .eq("user_id", venda.user_id);
    if (updErr) return { status: "erro", mensagem: String(updErr.message || updErr) };

    let contasExcluidas = 0;
    const idsContas = contas.filter((c) => {
      const m = c.descricao?.match(/venda_id:([0-9a-fA-F-]{36})/);
      return !!m && idsSecundarias.includes(m[1]);
    }).map((c) => c.id);
    if (idsContas.length > 0) {
      const { error: delErr } = await client
        .from("contas")
        .delete()
        .in("id", idsContas)
        .eq("user_id", venda.user_id);
      if (delErr) {
        return {
          status: "erro",
          mensagem: `Parcelas canceladas, mas não foi possível excluir as contas a receber vinculadas: ${String(delErr.message || delErr)}`,
        };
      }
      contasExcluidas = idsContas.length;
    }

    return {
      status: "cancelado",
      secundariasCanceladas: idsSecundarias.length,
      contasExcluidas,
      parcelasRecebidasParaRevisao: recebidas.length,
    };
  } catch (e) {
    return { status: "erro", mensagem: e instanceof Error ? e.message : "falha inesperada" };
  }
};
