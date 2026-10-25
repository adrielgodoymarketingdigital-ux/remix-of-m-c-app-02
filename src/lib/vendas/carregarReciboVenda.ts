/**
 * Lê do banco tudo o que o recibo novo de uma venda reaberta precisa (histórico
 * de Vendas, Dispositivos vendidos): as linhas do grupo (inclusive parcelas e
 * pagamento_duplo_secundario — quem junta é entradaDasLinhas), cliente,
 * produto/peça/aparelho de cada item (com a primeira foto), troca com o
 * aparelho recebido, nome do vendedor e o valor das contas a receber.
 *
 * Só leitura. Falha ao ler um complemento (foto, vendedor, troca, contas) não
 * derruba o recibo: aquele dado fica de fora. Sem linhas → null.
 */
import { supabase } from "@/integrations/supabase/client";
import type { DadosVendaCarregados, LinhaVendaRecibo, ProdutoRecibo, TrocaReciboEntrada } from "./reciboVendaModelo";

const COLUNAS_VENDA =
  "id, tipo, dispositivo_id, produto_id, peca_id, quantidade, total, valor_desconto_manual, valor_desconto_cupom, cupom_codigo, " +
  "forma_pagamento, observacoes, segunda_forma_pagamento, valor_segunda_forma, parcela_numero, total_parcelas, data, " +
  "data_prevista_recebimento, cancelada, data_cancelamento, motivo_cancelamento, imei_dispositivo, tempo_garantia, numero_venda, " +
  "valor_troca, funcionario_id, cliente_id";

/** Primeira foto de `fotos` (jsonb: string ou { url }) ou foto_url. */
export function primeiraFoto(fotos: unknown, fotoUrl?: string | null): string | null {
  if (Array.isArray(fotos)) {
    for (const f of fotos) {
      const url = typeof f === "string" ? f : f && typeof f === "object" && "url" in f ? String((f as { url: unknown }).url) : "";
      if (url.trim()) return url.trim();
    }
  }
  return fotoUrl?.trim() || null;
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export async function carregarReciboVenda(p: { vendaId: string; grupoVenda?: string | null }): Promise<DadosVendaCarregados | null> {
  const consulta = supabase.from("vendas").select(COLUNAS_VENDA).is("deleted_at", null);
  const { data: linhasBrutas, error } = p.grupoVenda
    ? await consulta.eq("grupo_venda", p.grupoVenda).order("data", { ascending: true }).order("id", { ascending: true })
    : await consulta.eq("id", p.vendaId);
  if (error || !linhasBrutas?.length) {
    if (error) console.error("[recibo novo] etapa=ler linhas da venda", error);
    return null;
  }
  const brutas = linhasBrutas as unknown as (Record<string, unknown> & { id: string; cliente_id: string | null })[];

  const ids = (campo: string) => [...new Set(brutas.map((l) => l[campo]).filter((v): v is string => typeof v === "string" && !!v))];
  const dispIds = ids("dispositivo_id");
  const prodIds = ids("produto_id");
  const pecaIds = ids("peca_id");
  const clienteId = brutas.find((l) => l.cliente_id)?.cliente_id ?? null;
  const funcionarioId = brutas.find((l) => l.funcionario_id)?.funcionario_id as string | undefined;
  const idsAReceber = brutas.filter((l) => l.forma_pagamento === "a_receber" || l.forma_pagamento === "a_prazo").map((l) => `venda_id:${l.id}`);

  const [cliente, disps, prods, pecas, funcionario, contas, troca] = await Promise.all([
    clienteId ? supabase.from("clientes").select("nome, cpf, telefone, endereco").eq("id", clienteId).maybeSingle() : null,
    dispIds.length
      ? supabase.from("dispositivos").select("id, marca, modelo, cor, capacidade_gb, condicao, imei, numero_serie, fotos, foto_url").in("id", dispIds)
      : null,
    prodIds.length ? supabase.from("produtos").select("id, nome, sku, fotos").in("id", prodIds) : null,
    pecaIds.length ? supabase.from("pecas").select("id, nome, fotos").in("id", pecaIds) : null,
    funcionarioId ? supabase.from("loja_funcionarios").select("nome").eq("id", funcionarioId).maybeSingle() : null,
    idsAReceber.length ? supabase.from("contas").select("descricao, valor").eq("tipo", "receber").in("descricao", idsAReceber) : null,
    p.grupoVenda ? carregarTroca(p.grupoVenda) : null,
  ]);

  const produtos: Record<string, ProdutoRecibo> = {};
  for (const d of (disps?.data ?? []) as Record<string, unknown>[]) {
    produtos[String(d.id)] = {
      marca: d.marca as string | null,
      modelo: d.modelo as string | null,
      cor: d.cor as string | null,
      capacidade_gb: num(d.capacidade_gb),
      condicao: d.condicao as string | null,
      imei: d.imei as string | null,
      numero_serie: d.numero_serie as string | null,
      fotoUrl: primeiraFoto(d.fotos, d.foto_url as string | null),
    };
  }
  for (const pr of [...((prods?.data ?? []) as Record<string, unknown>[]), ...((pecas?.data ?? []) as Record<string, unknown>[])]) {
    produtos[String(pr.id)] = { nome: pr.nome as string | null, sku: pr.sku as string | null, fotoUrl: primeiraFoto(pr.fotos) };
  }

  const contaPorVenda = new Map<string, number>();
  for (const c of (contas?.data ?? []) as { descricao: string | null; valor: number | null }[]) {
    if (c.descricao && c.valor != null) contaPorVenda.set(c.descricao.replace(/^venda_id:/, ""), Number(c.valor));
  }

  const linhas: LinhaVendaRecibo[] = brutas.map((l) => ({
    ...(l as unknown as LinhaVendaRecibo),
    quantidade: Number(l.quantidade) || 1,
    total: Number(l.total) || 0,
    valor_desconto_manual: num(l.valor_desconto_manual),
    valor_desconto_cupom: num(l.valor_desconto_cupom),
    valor_segunda_forma: num(l.valor_segunda_forma),
    parcela_numero: num(l.parcela_numero),
    total_parcelas: num(l.total_parcelas),
    tempo_garantia: num(l.tempo_garantia),
    valor_troca: num(l.valor_troca),
    valor_conta_receber: contaPorVenda.get(l.id) ?? null,
  }));

  return {
    linhas,
    cliente: (cliente?.data as DadosVendaCarregados["cliente"]) ?? null,
    produtos,
    troca,
    vendedorNome: (funcionario?.data as { nome?: string } | null)?.nome ?? null,
  };
}

/** Troca da venda (vendas_trocas pelo grupo) com condição e foto do aparelho recebido. Nunca lança. */
async function carregarTroca(grupoVenda: string): Promise<TrocaReciboEntrada | null> {
  try {
    const { data: troca, error } = await supabase
      .from("vendas_trocas")
      .select("valor_entrada, cancelada, dispositivo_entrada_id, valor_devolvido, forma_devolucao")
      .eq("grupo_venda", grupoVenda)
      .maybeSingle();
    if (error || !troca) {
      if (error) console.error("[recibo novo] etapa=ler troca da venda", error);
      return null;
    }
    let aparelho: TrocaReciboEntrada["aparelho"] = null;
    let condicao: string | null = null;
    let fotoUrl: string | null = null;
    if (troca.dispositivo_entrada_id) {
      const { data: disp } = await supabase
        .from("dispositivos")
        .select("marca, modelo, capacidade_gb, cor, imei, condicao, fotos, foto_url")
        .eq("id", troca.dispositivo_entrada_id)
        .maybeSingle();
      if (disp) {
        aparelho = { marca: disp.marca, modelo: disp.modelo, capacidadeGb: disp.capacidade_gb, cor: disp.cor, imei: disp.imei };
        condicao = disp.condicao;
        fotoUrl = primeiraFoto(disp.fotos, disp.foto_url);
      }
    }
    return {
      aparelho,
      valorEntrada: Number(troca.valor_entrada) || 0,
      cancelada: troca.cancelada === true,
      valorDevolvido: Number(troca.valor_devolvido) || 0,
      formaDevolucao: troca.forma_devolucao === "pix" || troca.forma_devolucao === "dinheiro" ? troca.forma_devolucao : null,
      condicao,
      fotoUrl,
    };
  } catch (e) {
    console.error("[recibo novo] etapa=ler troca da venda (falha inesperada)", e);
    return null;
  }
}
