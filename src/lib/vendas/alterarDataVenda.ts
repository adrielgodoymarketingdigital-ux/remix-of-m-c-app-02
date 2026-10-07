// ============================================================================
// Alterar a data de uma venda já lançada (correção de erro de lançamento)
// ----------------------------------------------------------------------------
// Move a VENDA INTEIRA: todas as linhas do mesmo grupo_venda (itens do PDV,
// parcelas, registro auxiliar de pagamento duplo) andam juntas, cada uma pelo
// mesmo deslocamento — em produção as linhas de um grupo são gravadas com no
// máximo ~9s de diferença, então o grupo é um único evento de venda. Mover só
// uma linha "racharia" a venda entre dias/caixas.
//
// Caixa: se a data antiga e/ou a nova caem num caixa JÁ FECHADO, a parte da
// venda é retirada do caixa antigo e somada no novo. A parte é calculada com
// agruparVendasPorFormaPagamento — a MESMA função que o fecharCaixa usa
// (ignora canceladas, rateia pagamento duplo) —, então o ajuste bate
// exatamente com o que o fechamento teria contado. saldo_final só se move
// pela parte em dinheiro (mesma regra de ajustarCaixasFechadosOS). Caixa
// aberto se resolve sozinho no próximo fechamento.
//
// Troca com devolução da diferença (Fase 2B): a devolução em dinheiro anda
// junto (sai do saldo_final e de total_devolucoes_troca de um caixa fechado e
// entra no outro) e vendas_trocas.caixa_id passa a ser o caixa (aberto ou
// fechado) da data nova — é por ele que o fechamento acha a devolução. A data
// da devolução no Extrato já vem das linhas da venda.
//
// Fora de escopo (bloqueado): serviços (OS — a data é a de entrega, editada
// na própria OS), linhas "Peça/Produto utilizado na OS" (seguem a OS) e
// vendas canceladas.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import { isVendaDeItemOS } from "@/lib/caixa/servicosCaixa";
import { contaNoCaixa } from "@/lib/caixa/devolucoesTroca";
import {
  PARTE_ZERO,
  calcularParteDaVenda,
  novosTotaisCaixa,
  parteMexeNoCaixa,
  somarNaParte,
  type ParteCaixa,
} from "./alterarDataVenda.core";

type TipoVendaLista = "dispositivo" | "produto" | "servico" | "avulsa";

export interface AlterarDataVendaParams {
  vendaId: string;
  tipo: TipoVendaLista;
  /** user_id do dono da venda (vendas.user_id / vendas_avulsas.user_id). */
  userId: string;
  /** Novo instante da venda, ISO UTC (ver instanteBrasiliaISO). */
  novaDataISO: string;
}

export interface AlterarDataVendaResultado {
  ok: boolean;
  erro?: string;
  /** id → nova data, para atualizar a lista sem recarregar. */
  novasDatas: Record<string, string>;
  /** Venda foi movida, mas algum caixa fechado não pôde ser ajustado. */
  avisoCaixa: boolean;
  /** Quantos caixas fechados foram ajustados (0, 1 ou 2). */
  caixasAjustados: number;
  /** false = a data foi alterada, mas o registro em vendas_alteracoes falhou. */
  historicoGravado: boolean;
}

export interface AlteracaoDataVenda {
  id: string;
  valor_antes: string | null;
  valor_depois: string | null;
  linhas_afetadas: number;
  caixas_ajustados: number;
  alterado_por_nome: string | null;
  created_at: string;
}

interface RegistroHistorico {
  userId: string;
  empresaId: string | null;
  origem: "vendas" | "vendas_avulsas";
  vendaId: string;
  grupoVenda: string | null;
  dataAntes: string;
  dataDepois: string;
  linhasAfetadas: number;
  caixasAjustados: number;
}

/**
 * Grava a alteração em vendas_alteracoes (quem, quando, antes/depois).
 * Nunca lança: a data já foi alterada — o histórico é complementar.
 * alterado_por vem do DEFAULT auth.uid() do banco (a RLS exige que seja
 * quem está logado).
 */
async function registrarHistorico(r: RegistroHistorico): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const metadados = (user?.user_metadata ?? {}) as { nome?: string; full_name?: string; name?: string };
    const nome = metadados.nome || metadados.full_name || metadados.name || user?.email || null;
    const { error } = await supabase.from("vendas_alteracoes").insert({
      user_id: r.userId,
      empresa_id: r.empresaId,
      origem: r.origem,
      venda_id: r.vendaId,
      grupo_venda: r.grupoVenda,
      campo: "data",
      valor_antes: r.dataAntes,
      valor_depois: r.dataDepois,
      linhas_afetadas: r.linhasAfetadas,
      caixas_ajustados: r.caixasAjustados,
      alterado_por_nome: nome,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("❌ Erro ao registrar histórico de alteração de data:", e);
    return false;
  }
}

/** Histórico de alterações de data da venda (todas as linhas do grupo), mais recente primeiro. */
export async function buscarHistoricoDataVenda(params: {
  vendaId: string;
  grupoVenda: string | null;
  userId: string;
}): Promise<AlteracaoDataVenda[]> {
  let query = supabase
    .from("vendas_alteracoes")
    .select("id, valor_antes, valor_depois, linhas_afetadas, caixas_ajustados, alterado_por_nome, created_at")
    .eq("user_id", params.userId)
    .eq("campo", "data")
    .order("created_at", { ascending: false })
    .limit(20);
  query = params.grupoVenda
    ? query.or(`grupo_venda.eq.${params.grupoVenda},venda_id.eq.${params.vendaId}`)
    : query.eq("venda_id", params.vendaId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AlteracaoDataVenda[];
}

interface CaixaFechado {
  id: string;
  empresa_id: string | null;
  total_dinheiro: number | null;
  total_pix: number | null;
  total_cartao: number | null;
  total_a_receber: number | null;
  total_vendas: number | null;
  saldo_final: number | null;
  /** Só lido quando a venda tem devolução em dinheiro (coluna da migration 2B). */
  total_devolucoes_troca?: number | null;
}

const COLUNAS_CAIXA = "id, empresa_id, total_dinheiro, total_pix, total_cartao, total_a_receber, total_vendas, saldo_final";

/** Caixa fechado cuja janela contém o instante (mesmo critério de editarVenda). */
async function caixaFechadoNoInstante(
  userId: string,
  instanteISO: string,
  filtroEmpresa: ((c: CaixaFechado) => boolean) | null,
  comDevolucao = false,
): Promise<CaixaFechado | null> {
  const { data, error } = await supabase
    .from("caixas")
    .select(comDevolucao ? `${COLUNAS_CAIXA}, total_devolucoes_troca` : COLUNAS_CAIXA)
    .eq("status", "fechado")
    .or(`proprietario_id.eq.${userId},user_id.eq.${userId}`)
    .lte("data_abertura", instanteISO)
    .gte("data_fechamento", instanteISO);
  if (error) throw error;
  const caixas = (data ?? []) as unknown as CaixaFechado[];
  return (filtroEmpresa ? caixas.filter(filtroEmpresa) : caixas)[0] ?? null;
}

async function aplicarNoCaixa(caixa: CaixaFechado, parte: ParteCaixa, sinal: 1 | -1): Promise<void> {
  const { error } = await supabase
    .from("caixas")
    .update(novosTotaisCaixa(caixa, parte, sinal))
    .eq("id", caixa.id);
  if (error) throw error;
}

/** Caixa (aberto ou fechado) em que o instante cai, para vendas_trocas.caixa_id. null = nenhum. */
async function caixaDoInstante(
  userId: string,
  instanteISO: string,
  filtroEmpresa: (c: { empresa_id: string | null }) => boolean,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("caixas")
    .select("id, empresa_id, status, data_fechamento")
    .or(`proprietario_id.eq.${userId},user_id.eq.${userId}`)
    .lte("data_abertura", instanteISO)
    .order("data_abertura", { ascending: false })
    .limit(10);
  if (error) throw error;
  const instanteMs = new Date(instanteISO).getTime();
  const caixa = (data ?? []).filter(filtroEmpresa).find((c) =>
    c.status === "aberto" || (!!c.data_fechamento && new Date(c.data_fechamento).getTime() >= instanteMs),
  );
  return caixa?.id ?? null;
}

/** Retira a parte do caixa da data antiga e soma no da data nova (só caixas fechados). */
async function moverEntreCaixas(
  userId: string,
  dataAntigaISO: string,
  dataNovaISO: string,
  parte: ParteCaixa,
  filtroEmpresa: ((c: CaixaFechado) => boolean) | null,
): Promise<{ aviso: boolean; ajustados: number }> {
  if (!parteMexeNoCaixa(parte)) return { aviso: false, ajustados: 0 };
  const comDevolucao = parte.devolucoes_dinheiro !== 0;
  try {
    const [antigo, novo] = await Promise.all([
      caixaFechadoNoInstante(userId, dataAntigaISO, filtroEmpresa, comDevolucao),
      caixaFechadoNoInstante(userId, dataNovaISO, filtroEmpresa, comDevolucao),
    ]);
    if (antigo && novo && antigo.id === novo.id) return { aviso: false, ajustados: 0 };
    let ajustados = 0;
    if (antigo) { await aplicarNoCaixa(antigo, parte, -1); ajustados++; }
    if (novo) { await aplicarNoCaixa(novo, parte, 1); ajustados++; }
    return { aviso: false, ajustados };
  } catch (e) {
    console.error("❌ Erro ao ajustar caixa fechado ao alterar data da venda:", e);
    return { aviso: true, ajustados: 0 };
  }
}

interface LinhaVenda {
  id: string;
  data: string | null;
  forma_pagamento: string | null;
  total: number;
  observacoes: string | null;
  segunda_forma_pagamento: string | null;
  valor_segunda_forma: number | null;
  valor_troca: number | null;
  cancelada: boolean | null;
  empresa_id: string | null;
  grupo_venda: string | null;
}

interface TrocaDaVendaMovida {
  id: string;
  caixa_id: string | null;
  valor_devolvido: number;
  forma_devolucao: string | null;
  cancelada: boolean;
}

const COLUNAS_LINHA =
  "id, data, forma_pagamento, total, observacoes, segunda_forma_pagamento, valor_segunda_forma, valor_troca, cancelada, empresa_id, grupo_venda";

const falha = (erro: string): AlterarDataVendaResultado => ({
  ok: false, erro, novasDatas: {}, avisoCaixa: false, caixasAjustados: 0, historicoGravado: true,
});

export async function alterarDataVenda(params: AlterarDataVendaParams): Promise<AlterarDataVendaResultado> {
  const { vendaId, tipo, userId, novaDataISO } = params;

  const novaMs = new Date(novaDataISO).getTime();
  if (!Number.isFinite(novaMs)) return falha("Data inválida.");
  if (novaMs > Date.now() + 60_000) return falha("A data da venda não pode ser no futuro.");

  if (tipo === "servico") {
    return falha("A data de serviços é a data de entrega da OS — altere pela Ordem de Serviço.");
  }

  // ── Venda avulsa (tabela própria, uma linha só) ────────────────────────
  if (tipo === "avulsa") {
    const { data: avulsa, error } = await supabase
      .from("vendas_avulsas")
      .select("id, created_at, valor, forma_pagamento")
      .eq("id", vendaId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!avulsa?.created_at) return falha("Venda não encontrada.");

    const { error: erroUpdate } = await supabase
      .from("vendas_avulsas")
      .update({ created_at: novaDataISO })
      .eq("id", vendaId)
      .eq("user_id", userId);
    if (erroUpdate) throw erroUpdate;

    const parte = { ...PARTE_ZERO };
    somarNaParte(parte, avulsa.forma_pagamento, Number(avulsa.valor || 0));
    // fecharCaixa soma vendas avulsas sem filtrar empresa — idem aqui.
    const caixa = await moverEntreCaixas(userId, avulsa.created_at, novaDataISO, parte, null);
    const historicoGravado = await registrarHistorico({
      userId, empresaId: null, origem: "vendas_avulsas", vendaId, grupoVenda: null,
      dataAntes: avulsa.created_at, dataDepois: novaDataISO, linhasAfetadas: 1, caixasAjustados: caixa.ajustados,
    });
    return { ok: true, novasDatas: { [vendaId]: novaDataISO }, avisoCaixa: caixa.aviso, caixasAjustados: caixa.ajustados, historicoGravado };
  }

  // ── Venda do PDV (tabela vendas; pode ter várias linhas no grupo) ──────
  const { data: clicada, error: erroClicada } = await supabase
    .from("vendas")
    .select(COLUNAS_LINHA)
    .eq("id", vendaId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (erroClicada) throw erroClicada;
  if (!clicada?.data) return falha("Venda não encontrada.");
  if (clicada.cancelada) return falha("Vendas canceladas não podem ter a data alterada.");
  if (isVendaDeItemOS(clicada.observacoes)) {
    return falha("Este item foi usado em uma OS — a data acompanha a Ordem de Serviço.");
  }

  let linhas: LinhaVenda[] = [clicada as LinhaVenda];
  if (clicada.grupo_venda) {
    const { data: doGrupo, error: erroGrupo } = await supabase
      .from("vendas")
      .select(COLUNAS_LINHA)
      .eq("user_id", userId)
      .eq("grupo_venda", clicada.grupo_venda)
      .is("deleted_at", null);
    if (erroGrupo) throw erroGrupo;
    if (doGrupo && doGrupo.length > 0) linhas = doGrupo as LinhaVenda[];
  }

  const deslocamentoMs = novaMs - new Date(clicada.data).getTime();
  if (deslocamentoMs === 0) return { ok: true, novasDatas: {}, avisoCaixa: false, caixasAjustados: 0, historicoGravado: true };

  // Atualiza linha a linha (cada uma pelo mesmo deslocamento). Se alguma
  // falhar, desfaz as já gravadas — nunca deixar a venda rachada.
  const novasDatas: Record<string, string> = {};
  const gravadas: LinhaVenda[] = [];
  for (const linha of linhas) {
    const novaData = new Date(new Date(linha.data ?? clicada.data).getTime() + deslocamentoMs).toISOString();
    const { error } = await supabase.from("vendas").update({ data: novaData }).eq("id", linha.id).eq("user_id", userId);
    if (error) {
      for (const g of gravadas) {
        await supabase.from("vendas").update({ data: g.data }).eq("id", g.id).eq("user_id", userId);
      }
      throw error;
    }
    gravadas.push(linha);
    novasDatas[linha.id] = novaData;
  }

  // Troca com devolução (Fase 2B): a devolução acompanha a venda.
  let troca: TrocaDaVendaMovida | null = null;
  let avisoTroca = false;
  if (clicada.grupo_venda && linhas.some((l) => l.valor_troca != null)) {
    const { data, error } = await supabase
      .from("vendas_trocas")
      .select("id, caixa_id, valor_devolvido, forma_devolucao, cancelada")
      .eq("grupo_venda", clicada.grupo_venda)
      .maybeSingle();
    if (error) {
      console.error("❌ Erro ao ler a troca ao alterar data da venda:", error);
      avisoTroca = true;
    }
    troca = data;
  }

  // Parte da venda no caixa = o que o fecharCaixa contaria destas linhas (+ devolução em dinheiro).
  const contaveis = linhas.filter((l) => !l.cancelada && !isVendaDeItemOS(l.observacoes));
  const parte = calcularParteDaVenda(contaveis, troca ? [troca] : []);

  // Mesmo critério de empresa do fecharCaixa/editarVenda.
  const empresaVenda = clicada.empresa_id;
  const filtroEmpresa = (c: { empresa_id: string | null }) => !c.empresa_id || c.empresa_id === empresaVenda;
  const caixa = await moverEntreCaixas(userId, clicada.data, novaDataISO, parte, filtroEmpresa);

  // O fechamento acha a devolução por vendas_trocas.caixa_id: passa a ser o caixa da data nova.
  if (troca && contaNoCaixa(troca)) {
    try {
      const novoCaixaId = await caixaDoInstante(userId, novaDataISO, filtroEmpresa);
      if (novoCaixaId !== troca.caixa_id) {
        const { error } = await supabase.from("vendas_trocas").update({ caixa_id: novoCaixaId }).eq("id", troca.id);
        if (error) throw error;
      }
    } catch (e) {
      console.error("❌ Erro ao mover a devolução da troca para o caixa da nova data:", e);
      avisoTroca = true;
    }
  }

  const historicoGravado = await registrarHistorico({
    userId, empresaId: empresaVenda, origem: "vendas", vendaId, grupoVenda: clicada.grupo_venda,
    dataAntes: clicada.data, dataDepois: novaDataISO, linhasAfetadas: linhas.length, caixasAjustados: caixa.ajustados,
  });

  return { ok: true, novasDatas, avisoCaixa: caixa.aviso || avisoTroca, caixasAjustados: caixa.ajustados, historicoGravado };
}
