import type { ClienteBancoLike } from "./reconhecerSegundaForma.core.ts";
import { linhasParaCancelarVendaInteira } from "./trocaPDV.ts";

/**
 * Núcleo (sem import de rede/alias) da devolução ao estoque de uma venda
 * cancelada/excluída. O cliente Supabase entra por parâmetro para dar para
 * testar com banco falso (scripts/testes-cancelar-venda-estoque/). A fachada
 * com o cliente real é estornoEstoqueVenda.ts.
 *
 * - devolverItemAoEstoqueCore: soma a quantidade VENDIDA da linha à quantidade
 *   ATUAL do banco (lida logo antes) — aparelho (e vendido = false), produto ou
 *   peça (peça = tipo "produto" + peca_id).
 * - liberarImeiDaLinhaCore: o PDV marca dispositivo_imeis { vendido: true,
 *   venda_id } por dispositivo_id + imei. No parcelado "a receber" ele faz isso
 *   em cada parcela, então o venda_id final é o da ÚLTIMA parcela — por isso o
 *   IMEI é liberado pelo venda_id da linha e também por dispositivo_id + imei
 *   restrito às linhas do mesmo item na mesma venda (ou sem venda_id).
 * - excluirVendaDevolvendoEstoqueCore: "Excluir" de Dispositivos vendidos
 *   (venda inteira = todas as linhas do grupo_venda).
 */

const SEM_CANCELAR = "cancelada.is.null,cancelada.eq.false";

export interface LinhaVendaEstoque {
  id: string;
  tipo: string;
  user_id: string | null;
  dispositivo_id: string | null;
  produto_id: string | null;
  peca_id: string | null;
  quantidade: number | null;
}

type TabelaEstoque = "dispositivos" | "produtos" | "pecas";

/** Item de estoque da linha. Peça vendida é tipo "produto" com peca_id (o enum não tem "peca"). */
export function itemDeEstoqueDaLinha(l: LinhaVendaEstoque): { tabela: TabelaEstoque; id: string } | null {
  if (l.tipo === "dispositivo") return l.dispositivo_id ? { tabela: "dispositivos", id: l.dispositivo_id } : null;
  if (l.peca_id) return { tabela: "pecas", id: l.peca_id };
  if (l.produto_id) return { tabela: "produtos", id: l.produto_id };
  return null;
}

/** Quantidade vendida na linha; linha antiga sem quantidade conta 1. */
export const quantidadeVendida = (l: LinhaVendaEstoque): number => {
  const q = Number(l.quantidade);
  return Number.isFinite(q) && q > 0 ? q : 1;
};

export type ResultadoDevolucao =
  | { status: "devolvido"; unidades: number }
  | { status: "sem_item" }
  | { status: "item_nao_encontrado" };

/** Devolve ao estoque a quantidade vendida da linha. Erro do banco LANÇA. */
export async function devolverItemAoEstoqueCore(client: ClienteBancoLike, linha: LinhaVendaEstoque): Promise<ResultadoDevolucao> {
  const item = itemDeEstoqueDaLinha(linha);
  if (!item) return { status: "sem_item" };
  const unidades = quantidadeVendida(linha);

  const { data: atual, error: erroLeitura } = await client
    .from(item.tabela)
    .select("quantidade")
    .eq("id", item.id)
    .eq("user_id", linha.user_id)
    .maybeSingle();
  if (erroLeitura) throw erroLeitura;
  if (!atual) return { status: "item_nao_encontrado" };

  const novaQuantidade = (Number((atual as { quantidade: number | null }).quantidade) || 0) + unidades;
  const { error } = await client
    .from(item.tabela)
    .update(item.tabela === "dispositivos" ? { quantidade: novaQuantidade, vendido: false } : { quantidade: novaQuantidade })
    .eq("id", item.id)
    .eq("user_id", linha.user_id);
  if (error) throw error;
  return { status: "devolvido", unidades };
}

/**
 * cancelarVenda: o IMEI só é liberado quando o estoque é estornado (caixa
 * marcada) e na linha que estorna (parcela 1 / item sem parcela), em aparelho.
 * Sem estorno, o aparelho continua fora do estoque e o IMEI continua vendido.
 */
export const deveLiberarImei = (p: { estornarEstoque: boolean; estornar: boolean; tipo: string }): boolean =>
  p.estornarEstoque && p.estornar && p.tipo === "dispositivo";

/**
 * Libera o(s) IMEI(s) marcados como vendidos por esta linha. Só aparelho.
 * Devolve quantos registros de dispositivo_imeis voltaram a ficar livres.
 * Erro do banco LANÇA.
 */
export async function liberarImeiDaLinhaCore(client: ClienteBancoLike, linha: Pick<LinhaVendaEstoque, "id" | "tipo" | "user_id">): Promise<number> {
  if (linha.tipo !== "dispositivo") return 0;
  const liberar = { vendido: false, venda_id: null };
  const liberados = new Set<string>();

  // 1) Pelo venda_id da própria linha.
  const { data: porVenda, error: erroPorVenda } = await client
    .from("dispositivo_imeis")
    .update(liberar)
    .eq("venda_id", linha.id)
    .select("id");
  if (erroPorVenda) throw erroPorVenda;
  for (const r of (porVenda ?? []) as { id: string }[]) liberados.add(r.id);

  // 2) Por dispositivo_id + imei, se a linha gravou o IMEI vendido.
  const { data: venda, error: erroVenda } = await client
    .from("vendas")
    .select("id, dispositivo_id, imei_dispositivo, grupo_venda")
    .eq("id", linha.id)
    .eq("user_id", linha.user_id)
    .maybeSingle();
  if (erroVenda) throw erroVenda;
  const v = venda as { dispositivo_id: string | null; imei_dispositivo: string | null; grupo_venda: string | null } | null;
  if (!v?.dispositivo_id || !v.imei_dispositivo) return liberados.size;

  // Linhas do MESMO item nesta venda (parcelas): o venda_id do IMEI pode ser de qualquer uma.
  let idsDoItem = [linha.id];
  if (v.grupo_venda) {
    const { data: irmas, error: erroIrmas } = await client
      .from("vendas")
      .select("id")
      .eq("grupo_venda", v.grupo_venda)
      .eq("user_id", linha.user_id)
      .eq("dispositivo_id", v.dispositivo_id)
      .eq("imei_dispositivo", v.imei_dispositivo);
    if (erroIrmas) throw erroIrmas;
    idsDoItem = [...new Set([linha.id, ...((irmas ?? []) as { id: string }[]).map((r) => r.id)])];
  }

  const { data: porImei, error: erroPorImei } = await client
    .from("dispositivo_imeis")
    .update(liberar)
    .eq("dispositivo_id", v.dispositivo_id)
    .eq("imei", v.imei_dispositivo)
    .eq("vendido", true)
    .or(`venda_id.is.null,venda_id.in.(${idsDoItem.join(",")})`)
    .select("id");
  if (erroPorImei) throw erroPorImei;
  for (const r of (porImei ?? []) as { id: string }[]) liberados.add(r.id);
  return liberados.size;
}

// ── Excluir a venda inteira (Dispositivos vendidos) ─────────────────────────

export interface LinhaDaVendaParaExcluir extends LinhaVendaEstoque {
  observacoes: string | null;
  cancelada: boolean | null;
  parcela_numero: number | null;
}

const COLUNAS_LINHA = "id, tipo, user_id, dispositivo_id, produto_id, peca_id, quantidade, observacoes, cancelada, parcela_numero";

/** Linhas não apagadas da venda (todo o grupo_venda; venda antiga sem grupo = só a linha). */
export async function carregarLinhasDaVendaCore(
  client: ClienteBancoLike,
  p: { vendaId: string; grupoVenda: string | null; userId: string },
): Promise<LinhaDaVendaParaExcluir[]> {
  let q = client.from("vendas").select(COLUNAS_LINHA).eq("user_id", p.userId).is("deleted_at", null);
  q = p.grupoVenda ? q.eq("grupo_venda", p.grupoVenda) : q.eq("id", p.vendaId);
  const { data, error } = await q.order("data", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LinhaDaVendaParaExcluir[];
}

export interface ResultadoExclusao {
  /** Linhas cujo item voltou ao estoque. */
  itensDevolvidos: number;
  /** Unidades somadas ao estoque (aparelhos + produtos + peças). */
  unidadesDevolvidas: number;
  imeisLiberados: number;
  /** Itens que não existem mais no estoque (apagados): a linha é cancelada sem devolver. */
  itensNaoEncontrados: number;
  /** Falhas ao liberar IMEI (estoque já devolvido; IMEI tem de ser revisto à mão). */
  errosImei: string[];
}

export type ResultadoExcluirVenda =
  | ({ status: "ok" } & ResultadoExclusao)
  | ({ status: "erro"; etapa: string; mensagem: string } & ResultadoExclusao);

const mensagemDe = (e: unknown): string =>
  e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);

/**
 * Exclui a venda inteira devolvendo ao estoque cada linha principal.
 *
 * Ordem, por linha principal (escolhida para nunca devolver em dobro):
 *  1. "reserva" a linha: cancelada = true, estorno_estoque = false, só se ainda
 *     não estava cancelada (dois cliques / duas abas não devolvem duas vezes);
 *  2. devolve o estoque — se falhar, desfaz a reserva (a linha volta ativa e a
 *     exclusão pode ser repetida) e para;
 *  3. estorno_estoque = true;
 *  4. libera o IMEI — se falhar, segue (estoque já voltou) e devolve o erro em
 *     errosImei para o aviso.
 * Depois: cancela as demais linhas do grupo (pagamento duplo secundário) e,
 * por último, o soft delete de tudo. Erro em qualquer etapa → status "erro"
 * com o que já foi feito; repetir é seguro (linhas já canceladas são puladas).
 * Contas a receber e caixa: não mexe (como antes).
 */
export async function excluirVendaDevolvendoEstoqueCore(
  client: ClienteBancoLike,
  p: { linhas: LinhaDaVendaParaExcluir[]; motivo: string; agoraISO: string },
): Promise<ResultadoExcluirVenda> {
  const r: ResultadoExclusao = { itensDevolvidos: 0, unidadesDevolvidas: 0, imeisLiberados: 0, itensNaoEncontrados: 0, errosImei: [] };
  // Parcela 1 (estornar) antes das demais parcelas do mesmo item.
  const principais = linhasParaCancelarVendaInteira(p.linhas).sort((a, b) => Number(b.estornar) - Number(a.estornar));
  const idsPrincipais = new Set(principais.map((x) => x.linha.id));
  const itensDevolvidos = new Set<string>();
  const chave = (l: LinhaVendaEstoque) => {
    const item = itemDeEstoqueDaLinha(l);
    return item ? `${item.tabela}:${item.id}` : null;
  };
  let etapa = "cancelar linha";

  try {
    for (const { linha, estornar } of principais) {
      etapa = "cancelar linha";
      const { data: reservada, error: erroReserva } = await client
        .from("vendas")
        .update({ cancelada: true, data_cancelamento: p.agoraISO, motivo_cancelamento: p.motivo, estorno_estoque: false })
        .eq("id", linha.id)
        .eq("user_id", linha.user_id)
        .or(SEM_CANCELAR)
        .select("id");
      if (erroReserva) throw erroReserva;
      if (!reservada || reservada.length === 0) continue; // outro clique já cancelou

      let estoqueVoltou = false;
      if (estornar) {
        etapa = "devolver ao estoque";
        let dev: ResultadoDevolucao;
        try {
          dev = await devolverItemAoEstoqueCore(client, linha);
        } catch (erroEstoque) {
          const { error: erroDesfazer } = await client
            .from("vendas")
            .update({ cancelada: false, data_cancelamento: null, motivo_cancelamento: null, estorno_estoque: null })
            .eq("id", linha.id)
            .eq("user_id", linha.user_id);
          if (erroDesfazer) {
            console.error("[excluir venda] etapa=desfazer cancelamento da linha", { linha: linha.id, erro: erroDesfazer });
            throw new Error(`${mensagemDe(erroEstoque)} (a linha ficou cancelada sem devolver o estoque; ajuste o estoque à mão)`);
          }
          throw erroEstoque;
        }
        if (dev.status === "devolvido") {
          estoqueVoltou = true;
          r.itensDevolvidos += 1;
          r.unidadesDevolvidas += dev.unidades;
          const k = chave(linha);
          if (k) itensDevolvidos.add(k);
        } else if (dev.status === "item_nao_encontrado") {
          r.itensNaoEncontrados += 1;
        }
      } else {
        // Parcelas 2..N: o estoque do item voltou pela 1ª parcela.
        const k = chave(linha);
        estoqueVoltou = !!k && itensDevolvidos.has(k);
      }

      if (estoqueVoltou) {
        etapa = "marcar estorno de estoque";
        const { error: erroEstorno } = await client
          .from("vendas")
          .update({ estorno_estoque: true })
          .eq("id", linha.id)
          .eq("user_id", linha.user_id);
        if (erroEstorno) throw erroEstorno;
      }

      if (estornar && estoqueVoltou) {
        try {
          r.imeisLiberados += await liberarImeiDaLinhaCore(client, linha);
        } catch (erroImei) {
          console.error("[excluir venda] etapa=liberar IMEI", { linha: linha.id, erro: erroImei });
          r.errosImei.push(mensagemDe(erroImei));
        }
      }
    }

    // Demais linhas do grupo (pagamento duplo secundário, já canceladas): só cancelar, sem estoque.
    const outras = p.linhas.filter((l) => !idsPrincipais.has(l.id)).map((l) => l.id);
    if (outras.length > 0) {
      etapa = "cancelar linhas do pagamento duplo";
      const { error } = await client
        .from("vendas")
        .update({ cancelada: true, data_cancelamento: p.agoraISO })
        .in("id", outras)
        .or(SEM_CANCELAR);
      if (error) throw error;
    }

    etapa = "remover a venda da lista";
    const { error: erroApagar } = await client
      .from("vendas")
      .update({ deleted_at: p.agoraISO })
      .in("id", p.linhas.map((l) => l.id))
      .is("deleted_at", null);
    if (erroApagar) throw erroApagar;

    return { status: "ok", ...r };
  } catch (e) {
    return { status: "erro", etapa, mensagem: mensagemDe(e), ...r };
  }
}
