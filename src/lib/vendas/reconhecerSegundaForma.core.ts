import type { SupabaseClient } from "@supabase/supabase-js";
import { MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO } from "../vendasFinanceiras.ts";
import { calcularCustoUnitarioParcelaSecundaria } from "./rateioSegundaForma.ts";

/**
 * Núcleo (sem import de rede/alias) do reconhecimento diferido de receita/custo
 * da 2ª forma de pagamento "a receber" (pagamento duplo) e das vendas
 * "a receber"/"a prazo" primárias. O cliente Supabase entra por parâmetro para
 * o módulo poder ser testado (ver scripts/investigacao-lucro-vendas/).
 * A fachada com o cliente real é reconhecerSegundaForma.ts.
 *
 * Contexto: numa venda de pagamento duplo cuja 2ª forma é "a receber",
 * getVendaReceitaLiquida reconhece só a parte já paga da receita, e o custo da
 * linha principal é diferido na mesma proporção (getVendaCustoTotal). Quando a
 * parcela é recebida, gravamos na linha secundária: recebido = true,
 * data_recebimento e a fatia proporcional do custo em custo_unitario.
 *
 * CUSTO NÃO CONFIRMADO: se não der para calcular a fatia (venda principal
 * cancelada/removida/sem custo), a parcela é marcada como recebida MAS o custo
 * continua sem gravar e o resultado volta como "custo_nao_confirmado". Os
 * cálculos de lucro (isCustoNaoConfirmado em vendasFinanceiras.ts) deixam essa
 * parcela de fora até o custo ser confirmado — nunca aplicam custo cheio do
 * item contra uma fatia da receita.
 */

// Superfície mínima usada do supabase-js: o cliente real e o fake dos testes satisfazem.
export type ClienteBancoLike = Pick<SupabaseClient, "from">;

export type MotivoCustoNaoConfirmado =
  | "principal_cancelada"
  | "principal_nao_encontrada"
  | "principal_sem_custo"
  | "rateio_indisponivel";

export type ResultadoReconhecimento =
  | { status: "reconhecido" }
  | { status: "ja_reconhecido" }
  | { status: "ignorado"; motivo: "venda_nao_encontrada" | "outro_usuario" | "forma_nao_prazo" }
  | { status: "custo_nao_confirmado"; motivo: MotivoCustoNaoConfirmado }
  | { status: "erro"; mensagem: string };

export const MENSAGEM_CUSTO_NAO_CONFIRMADO: Record<MotivoCustoNaoConfirmado, string> = {
  principal_cancelada:
    "A venda principal desta parcela está cancelada. A parcela foi marcada como recebida, mas fica fora do lucro até o custo ser confirmado.",
  principal_nao_encontrada:
    "Não encontramos a venda principal desta parcela. A parcela foi marcada como recebida, mas fica fora do lucro até o custo ser confirmado.",
  principal_sem_custo:
    "A venda principal está sem custo registrado. A parcela foi marcada como recebida, mas fica fora do lucro até o custo ser confirmado.",
  rateio_indisponivel:
    "Não foi possível ratear o custo desta parcela. Ela foi marcada como recebida, mas fica fora do lucro até o custo ser confirmado.",
};

const toNum = (v: unknown): number => Number((v as number | string | null | undefined) || 0);

/** Extrai o id da venda de uma descricao no formato "venda_id:<uuid>". */
export const extrairVendaIdDaDescricao = (descricao?: string | null): string | null => {
  if (!descricao) return null;
  const m = descricao.match(/venda_id:([0-9a-fA-F-]{36})/);
  return m ? m[1] : null;
};

/**
 * data_pagamento das contas é DATE ("2026-07-17"). Gravada crua em timestamptz
 * vira meia-noite UTC = 21h do dia anterior em Brasília, e a competência cai
 * um dia antes. Ancorar ao meio-dia de Brasília mantém o dia certo.
 */
export const normalizarDataRecebimento = (data: string): string =>
  /^\d{4}-\d{2}-\d{2}$/.test(data) ? `${data}T12:00:00-03:00` : data;

export interface RefItem {
  dispositivo_id?: string | null;
  produto_id?: string | null;
  peca_id?: string | null;
}

/** Coluna/valor que identifica o item da venda (casa secundária ↔ principal no mesmo grupo). */
export const colunaItem = (
  ref: RefItem,
): { coluna: "dispositivo_id" | "produto_id" | "peca_id"; valor: string } | null => {
  if (ref.dispositivo_id) return { coluna: "dispositivo_id", valor: ref.dispositivo_id };
  if (ref.produto_id) return { coluna: "produto_id", valor: ref.produto_id };
  if (ref.peca_id) return { coluna: "peca_id", valor: ref.peca_id };
  return null;
};

interface LinhaGrupo {
  id: string;
  total?: number | string | null;
  valor_desconto_manual?: number | string | null;
  valor_desconto_cupom?: number | string | null;
  valor_segunda_forma?: number | string | null;
  custo_unitario?: number | string | null;
  quantidade?: number | string | null;
  observacoes?: string | null;
  cancelada?: boolean | null;
}

/**
 * Propaga para a linha `vendas` o recebimento de uma venda a prazo (via Conta a
 * Receber "venda_id:<id>", via tela de Vendas ou via baixa de conta virtual).
 * TODO caminho que confirma recebimento deve passar por aqui.
 *
 * - Primária a_receber/a_prazo: marca recebido = true + data_recebimento.
 * - Secundária de pagamento duplo: além disso grava a fatia de custo.
 *
 * Idempotente. Nunca lança: erros voltam em { status: "erro" } para o chamador
 * decidir (baixa de conta segue; a tela de Vendas avisa).
 */
export const reconhecerRecebimentoVendaVinculadaCore = async (
  client: ClienteBancoLike,
  vendaId: string,
  dataRecebimento: string,
  userId: string,
): Promise<ResultadoReconhecimento> => {
  try {
    const { data: venda, error } = await client
      .from("vendas")
      .select(
        "id, user_id, observacoes, grupo_venda, produto_id, dispositivo_id, peca_id, total, quantidade, forma_pagamento, recebido, custo_unitario, data_recebimento",
      )
      .eq("id", vendaId)
      .maybeSingle();

    if (error) return { status: "erro", mensagem: String(error.message || error) };
    if (!venda) return { status: "ignorado", motivo: "venda_nao_encontrada" };
    if (venda.user_id !== userId) return { status: "ignorado", motivo: "outro_usuario" };
    if (venda.forma_pagamento !== "a_receber" && venda.forma_pagamento !== "a_prazo") {
      return { status: "ignorado", motivo: "forma_nao_prazo" };
    }

    const ehSecundaria = venda.observacoes === MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO;

    // Já reconhecida com custo (secundária) ou já recebida (primária) → nada a fazer
    if (venda.recebido === true && venda.data_recebimento) {
      if (!ehSecundaria) return { status: "ja_reconhecido" };
      if (toNum(venda.custo_unitario) > 0) return { status: "ja_reconhecido" };
    }

    const update: Record<string, unknown> = {
      recebido: true,
      data_recebimento: dataRecebimento,
    };
    let custoNaoConfirmado: MotivoCustoNaoConfirmado | null = null;

    if (ehSecundaria && venda.grupo_venda) {
      const item = colunaItem(venda);

      // Linhas do mesmo grupo/item que NÃO são secundárias. Filtro em JS (não em
      // SQL): `neq` no PostgREST descarta linhas com observacoes/cancelada NULL.
      let qGrupo = client
        .from("vendas")
        .select(
          "id, total, valor_desconto_manual, valor_desconto_cupom, valor_segunda_forma, custo_unitario, quantidade, observacoes, cancelada",
        )
        .eq("user_id", userId)
        .eq("grupo_venda", venda.grupo_venda)
        .neq("id", venda.id);
      if (item) qGrupo = qGrupo.eq(item.coluna, item.valor);
      const { data: linhasGrupo } = await qGrupo;

      const candidatas = ((linhasGrupo || []) as LinhaGrupo[]).filter(
        (l) => l.observacoes !== MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO,
      );
      const principal = candidatas.find((l) => l.cancelada !== true);

      if (!principal) {
        custoNaoConfirmado = candidatas.length > 0 ? "principal_cancelada" : "principal_nao_encontrada";
      } else if (toNum(principal.custo_unitario) <= 0) {
        custoNaoConfirmado = "principal_sem_custo";
      } else {
        // Soma de TODAS as parcelas secundárias ativas do mesmo item nesse grupo
        let qParcelas = client
          .from("vendas")
          .select("total, cancelada")
          .eq("user_id", userId)
          .eq("grupo_venda", venda.grupo_venda)
          .eq("observacoes", MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO);
        if (item) qParcelas = qParcelas.eq(item.coluna, item.valor);
        const { data: parcelas } = await qParcelas;
        const somaParcelas = ((parcelas || []) as { total?: number | string | null; cancelada?: boolean | null }[])
          .filter((p) => p.cancelada !== true)
          .reduce((acc, p) => acc + toNum(p.total), 0);

        const custo = calcularCustoUnitarioParcelaSecundaria(
          principal,
          toNum(venda.total),
          somaParcelas,
          toNum(venda.quantidade || 1),
        );
        if (custo > 0) update.custo_unitario = custo;
        else custoNaoConfirmado = "rateio_indisponivel";
      }
    }

    const { error: updErr } = await client
      .from("vendas")
      .update(update)
      .eq("id", venda.id)
      .eq("user_id", userId);
    if (updErr) {
      console.error("[reconhecerSegundaForma] erro ao atualizar venda:", updErr);
      return { status: "erro", mensagem: String(updErr.message || updErr) };
    }

    if (custoNaoConfirmado) {
      console.warn("[reconhecerSegundaForma] custo não confirmado — parcela fora do lucro:", {
        vendaId: venda.id,
        grupoVenda: venda.grupo_venda,
        motivo: custoNaoConfirmado,
      });
      return { status: "custo_nao_confirmado", motivo: custoNaoConfirmado };
    }
    return { status: "reconhecido" };
  } catch (e) {
    console.error("[reconhecerSegundaForma] falha inesperada:", e);
    return { status: "erro", mensagem: e instanceof Error ? e.message : "falha inesperada" };
  }
};

/**
 * Reverte o reconhecimento quando a Conta a Receber volta para "pendente" (ou é
 * despagada). Zera o custo diferido da linha secundária.
 */
export const reverterRecebimentoVendaVinculadaCore = async (
  client: ClienteBancoLike,
  vendaId: string,
  userId: string,
): Promise<void> => {
  try {
    const { data: venda } = await client
      .from("vendas")
      .select("id, user_id, observacoes, forma_pagamento")
      .eq("id", vendaId)
      .maybeSingle();
    if (!venda || venda.user_id !== userId) return;
    if (venda.forma_pagamento !== "a_receber" && venda.forma_pagamento !== "a_prazo") return;

    const update: Record<string, unknown> = { recebido: false, data_recebimento: null };
    if (venda.observacoes === MARCADOR_PAGAMENTO_DUPLO_SECUNDARIO) update.custo_unitario = 0;

    const { error } = await client
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
export const propagarStatusContaParaVendaCore = async (
  client: ClienteBancoLike,
  conta: { descricao?: string | null; tipo?: string | null; data_pagamento?: string | null },
  novoStatus: string,
  userId: string,
): Promise<ResultadoReconhecimento | null> => {
  if (conta.tipo !== "receber") return null;
  const vendaId = extrairVendaIdDaDescricao(conta.descricao);
  if (!vendaId) return null;

  if (novoStatus === "recebido") {
    const dataRecebimento = normalizarDataRecebimento(
      conta.data_pagamento || new Date().toISOString().slice(0, 10),
    );
    return reconhecerRecebimentoVendaVinculadaCore(client, vendaId, dataRecebimento, userId);
  }
  if (novoStatus === "pendente") {
    await reverterRecebimentoVendaVinculadaCore(client, vendaId, userId);
  }
  return null;
};
