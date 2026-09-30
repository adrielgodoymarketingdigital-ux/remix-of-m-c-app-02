/**
 * Estoque das peças/produtos usados numa OS (avarias.produtos_utilizados).
 *
 * Regra: o estoque baixa quando o item entra na OS — na criação OU numa
 * edição — e volta quando o item sai (edição ou estorno). Cada baixa grava uma
 * linha em `vendas` com observacoes "Peça/Produto utilizado na OS <n>" (fora de
 * receita/caixa, ver isVendaDeItemOS). Essas linhas são a FONTE DE VERDADE do
 * que foi de fato baixado: a edição e o estorno devolvem só o que elas somam.
 *
 * Na edição, só o que MUDOU naquela edição mexe no estoque (compara o registro
 * de antes com o de depois). Itens antigos que nunca foram baixados (bug antigo
 * da edição) NÃO são baixados "de carona" ao reabrir a OS — isso é correção
 * retroativa e é tratada à parte.
 *
 * Linhas antigas de PEÇA não têm peca_id (só produto_id era gravado): são
 * atribuídas às peças da OS por quantidade/valor e, na falta, por ordem.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ItemOSEstoque {
  id: string;
  tipo: "produto" | "peca";
  quantidade: number;
  preco_unitario?: number;
  preco_total?: number;
  custo_unitario?: number;
}

interface LinhaVendaOS {
  id: string;
  produto_id: string | null;
  peca_id: string | null;
  quantidade: number;
  total: number;
}

export interface ContextoVendaOS {
  userId: string;
  numeroOS: string;
  clienteId: string | null;
  formaPagamento?: string | null;
}

type FormaPagamentoVenda = "dinheiro" | "pix" | "debito" | "credito" | "credito_parcelado" | "a_receber" | "a_prazo";

const chave = (item: { tipo: string; id: string }) => `${item.tipo}:${item.id}`;
const observacaoOS = (numeroOS: string) => `Peça/Produto utilizado na OS ${numeroOS}`;
const qtd = (n: unknown) => Math.max(0, Number(n) || 0);

/** Linhas ativas (não excluídas, não canceladas) de itens da OS, agrupadas por item. */
async function buscarLinhasPorItem(
  userId: string,
  numeroOS: string,
  itens: ItemOSEstoque[],
): Promise<Map<string, LinhaVendaOS[]>> {
  const { data, error } = await supabase
    .from("vendas")
    .select("id, produto_id, peca_id, quantidade, total, cancelada")
    .eq("user_id", userId)
    .eq("observacoes", observacaoOS(numeroOS))
    .is("deleted_at", null)
    .order("data", { ascending: true });
  if (error) throw error;

  const linhas = ((data ?? []) as (LinhaVendaOS & { cancelada: boolean | null })[])
    .filter((l) => !l.cancelada)
    .map((l) => ({ ...l, quantidade: Number(l.quantidade) || 0, total: Number(l.total) || 0 }));

  const porItem = new Map<string, LinhaVendaOS[]>();
  const add = (k: string, l: LinhaVendaOS) => porItem.set(k, [...(porItem.get(k) ?? []), l]);

  const semDono: LinhaVendaOS[] = [];
  for (const l of linhas) {
    if (l.produto_id) add(`produto:${l.produto_id}`, l);
    else if (l.peca_id) add(`peca:${l.peca_id}`, l);
    else semDono.push(l); // peça gravada antes de existir peca_id na linha
  }

  // Atribui linhas antigas de peça às peças da OS que não têm linha própria:
  // 1º por quantidade+valor iguais, depois na ordem em que aparecem.
  const pecasSemLinha = itens.filter((i) => i.tipo === "peca" && !porItem.has(chave(i)));
  for (const peca of pecasSemLinha) {
    const idx = semDono.findIndex(
      (l) => l.quantidade === qtd(peca.quantidade) && Math.abs(l.total - Number(peca.preco_total ?? 0)) < 0.01,
    );
    if (idx >= 0) add(chave(peca), semDono.splice(idx, 1)[0]);
  }
  for (const peca of pecasSemLinha) {
    if (!porItem.has(chave(peca)) && semDono.length) add(chave(peca), semDono.shift()!);
  }
  return porItem;
}

const somaQtd = (linhas: LinhaVendaOS[] | undefined) => (linhas ?? []).reduce((acc, l) => acc + l.quantidade, 0);

/** Soma `delta` (positivo = devolve, negativo = baixa) ao estoque, lendo o valor ATUAL do banco. */
async function ajustarEstoque(userId: string, item: ItemOSEstoque, delta: number): Promise<boolean> {
  const tabela = item.tipo === "peca" ? "pecas" : "produtos";
  const { data: atual, error: erroLeitura } = await supabase
    .from(tabela)
    .select("quantidade")
    .eq("id", item.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (erroLeitura || !atual) {
    console.error(`[estoque OS] ${tabela} ${item.id} não encontrado para ajustar estoque`, erroLeitura);
    return false;
  }
  const { error } = await supabase
    .from(tabela)
    .update({ quantidade: (Number(atual.quantidade) || 0) + delta })
    .eq("id", item.id)
    .eq("user_id", userId);
  if (error) {
    console.error(`[estoque OS] erro ao ajustar estoque de ${tabela} ${item.id}`, error);
    return false;
  }
  return true;
}

/** Baixa `quantidade` do item e grava a linha "utilizado na OS" correspondente. */
async function baixarItem(ctx: ContextoVendaOS, item: ItemOSEstoque, quantidade: number): Promise<void> {
  if (quantidade <= 0) return;
  const forma = (ctx.formaPagamento || "dinheiro") as FormaPagamentoVenda;
  const precoUnit = Number(item.preco_unitario ?? (item.quantidade ? Number(item.preco_total ?? 0) / item.quantidade : 0));

  // Linha primeiro: se o estoque falhar, a linha é desfeita — nunca fica
  // estoque baixado sem registro (senão a próxima edição baixaria de novo).
  const { data: linha, error } = await supabase
    .from("vendas")
    .insert({
      tipo: "produto" as const,
      produto_id: item.tipo === "produto" ? item.id : null,
      peca_id: item.tipo === "peca" ? item.id : null,
      quantidade,
      total: precoUnit * quantidade,
      custo_unitario: item.custo_unitario ?? 0,
      forma_pagamento: forma,
      user_id: ctx.userId,
      cliente_id: ctx.clienteId,
      data: new Date().toISOString(),
      recebido: forma !== "a_prazo" && forma !== "a_receber",
      observacoes: observacaoOS(ctx.numeroOS),
    })
    .select("id")
    .single();
  if (error || !linha) {
    console.error("[estoque OS] erro ao registrar item utilizado na OS — estoque não baixado", error);
    return;
  }

  const ok = await ajustarEstoque(ctx.userId, item, -quantidade);
  if (!ok) {
    await supabase.from("vendas").update({ deleted_at: new Date().toISOString() }).eq("id", linha.id);
  }
}

/**
 * Devolve até `quantidade` do item, limitado ao que as linhas mostram como
 * baixado; reduz/exclui as linhas (mais recentes primeiro). Retorna o devolvido.
 */
async function devolverItem(
  userId: string,
  item: ItemOSEstoque,
  quantidade: number,
  linhas: LinhaVendaOS[],
): Promise<number> {
  const devolver = Math.min(quantidade, somaQtd(linhas));
  if (devolver <= 0) return 0;

  let falta = devolver;
  for (const l of [...linhas].reverse()) {
    if (falta <= 0) break;
    if (l.quantidade <= falta) {
      await supabase.from("vendas").update({ deleted_at: new Date().toISOString() }).eq("id", l.id);
      falta -= l.quantidade;
    } else {
      const restante = l.quantidade - falta;
      await supabase
        .from("vendas")
        .update({ quantidade: restante, total: (l.total / l.quantidade) * restante })
        .eq("id", l.id);
      falta = 0;
    }
  }
  await ajustarEstoque(userId, item, devolver);
  return devolver;
}

/** Criação da OS: baixa todos os itens. */
export async function baixarEstoqueNovaOS(ctx: ContextoVendaOS, itens: ItemOSEstoque[]): Promise<void> {
  await sincronizarEstoqueEdicaoOS(ctx, [], itens);
}

/**
 * Edição da OS: aplica só a diferença entre o registro anterior e o novo.
 * Item novo → baixa; item removido → devolve o que foi baixado; quantidade
 * alterada → baixa/devolve a diferença.
 */
export async function sincronizarEstoqueEdicaoOS(
  ctx: ContextoVendaOS,
  anteriores: ItemOSEstoque[],
  novos: ItemOSEstoque[],
): Promise<void> {
  const qtdAntes = new Map<string, number>();
  for (const i of anteriores) qtdAntes.set(chave(i), (qtdAntes.get(chave(i)) ?? 0) + qtd(i.quantidade));
  const itemNovo = new Map<string, ItemOSEstoque>();
  const qtdDepois = new Map<string, number>();
  for (const i of novos) {
    itemNovo.set(chave(i), i);
    qtdDepois.set(chave(i), (qtdDepois.get(chave(i)) ?? 0) + qtd(i.quantidade));
  }

  const chaves = new Set([...qtdAntes.keys(), ...qtdDepois.keys()]);
  const mudancas = [...chaves]
    .map((k) => ({ k, delta: (qtdDepois.get(k) ?? 0) - (qtdAntes.get(k) ?? 0) }))
    .filter((m) => m.delta !== 0);
  if (mudancas.length === 0) return;

  const precisaDevolver = mudancas.some((m) => m.delta < 0);
  const linhas = precisaDevolver ? await buscarLinhasPorItem(ctx.userId, ctx.numeroOS, anteriores) : new Map();

  for (const { k, delta } of mudancas) {
    if (delta > 0) {
      await baixarItem(ctx, itemNovo.get(k)!, delta);
    } else {
      const item = itemNovo.get(k) ?? anteriores.find((i) => chave(i) === k)!;
      await devolverItem(ctx.userId, item, -delta, linhas.get(k) ?? []);
    }
  }
}

/**
 * Estorno da OS: devolve só o que as linhas mostram como baixado e marca as
 * linhas como canceladas/estornadas. Retorna quantas unidades voltaram.
 */
export async function estornarEstoqueOS(userId: string, numeroOS: string, itens: ItemOSEstoque[]): Promise<number> {
  const linhasPorItem = await buscarLinhasPorItem(userId, numeroOS, itens);
  let devolvido = 0;
  for (const item of itens) {
    const linhas = linhasPorItem.get(chave(item));
    const baixado = somaQtd(linhas);
    if (baixado <= 0) continue;
    const ok = await ajustarEstoque(userId, item, baixado);
    if (!ok) continue;
    devolvido += baixado;
    await supabase
      .from("vendas")
      .update({ cancelada: true, estorno_estoque: true, data_cancelamento: new Date().toISOString(), motivo_cancelamento: `Estorno da OS ${numeroOS}` })
      .in("id", (linhas ?? []).map((l) => l.id));
  }
  return devolvido;
}
