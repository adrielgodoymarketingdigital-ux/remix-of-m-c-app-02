import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/supabase-retry";
import { SELECT_VENDA_COM_ITENS } from "@/lib/vendas/itensVenda";
import type { Venda } from "@/types/venda";
import type { AvariasOS } from "@/types/ordem-servico";
import type { EventoExtrato } from "./useExtratoFinanceiro";
import { ORIGENS_COM_DETALHE } from "@/lib/financeiro/origensExtrato";

export interface OrdemDetalheExtrato {
  id: string;
  numero_os: string;
  total: number | null;
  data_saida: string | null;
  data_caixa: string | null;
  forma_pagamento: string | null;
  dispositivo_marca: string;
  dispositivo_modelo: string;
  defeito_relatado: string;
  avarias: AvariasOS | null;
  cliente: { nome: string; telefone: string | null } | null;
}

/** Troca de aparelho da venda (vendas_trocas), quando houver. */
export interface TrocaDetalheExtrato {
  valorEntrada: number;
  valorDevolvido: number;
  formaDevolucao: string | null;
  cancelada: boolean;
}

export type DetalheExtrato =
  /** Linhas de `vendas` da mesma venda (todos os itens e parcelas), sem o registro auxiliar de pagamento duplo. */
  | { tipo: "venda"; linhas: Venda[]; troca: TrocaDetalheExtrato | null }
  | { tipo: "os"; ordem: OrdemDetalheExtrato };

/** Origens do Extrato que têm popup de detalhes. */
export const temDetalheExtrato = (evento: EventoExtrato) => ORIGENS_COM_DETALHE.includes(evento.origem);

const COLUNAS_TROCA = "grupo_venda, valor_entrada, valor_devolvido, forma_devolucao, cancelada";

type TrocaLida = { grupo_venda: string; valor_entrada: number; valor_devolvido: number; forma_devolucao: string | null; cancelada: boolean };

const paraTrocaDetalhe = (t: TrocaLida): TrocaDetalheExtrato => ({
  valorEntrada: Number(t.valor_entrada) || 0,
  valorDevolvido: Number(t.valor_devolvido) || 0,
  formaDevolucao: t.forma_devolucao,
  cancelada: t.cancelada,
});

async function buscarLinhasDoGrupo(grupoVenda: string) {
  const { data: grupo, error } = await supabase
    .from("vendas")
    .select(SELECT_VENDA_COM_ITENS)
    .eq("grupo_venda", grupoVenda)
    .is("deleted_at", null)
    .order("data", { ascending: true });
  if (error) throw error;
  return grupo ?? [];
}

const semAuxiliarDuplo = (linhas: unknown[]) =>
  (linhas as Venda[]).filter((v) => v.observacoes !== "pagamento_duplo_secundario");

async function buscarVenda(id: string): Promise<DetalheExtrato | null> {
  const { data: principal, error } = await supabase
    .from("vendas")
    .select(SELECT_VENDA_COM_ITENS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!principal) return null;

  let linhas = [principal];
  if (principal.grupo_venda) {
    const grupo = await buscarLinhasDoGrupo(principal.grupo_venda);
    if (grupo.length) linhas = grupo;
  }

  // Venda com troca (Fase 1+): mostra o aparelho recebido e a devolução.
  let troca: TrocaDetalheExtrato | null = null;
  if (principal.grupo_venda && (linhas as unknown as Venda[]).some((v) => v.valor_troca != null)) {
    const { data, error: erroTroca } = await supabase
      .from("vendas_trocas")
      .select(COLUNAS_TROCA)
      .eq("grupo_venda", principal.grupo_venda)
      .maybeSingle();
    if (erroTroca) throw erroTroca;
    troca = data ? paraTrocaDetalhe(data as TrocaLida) : null;
  }

  return { tipo: "venda", linhas: semAuxiliarDuplo(linhas), troca };
}

/** Linha "Devolução de troca": referencia_id é vendas_trocas.id; a venda vem pelo grupo_venda. */
async function buscarVendaDaTroca(trocaId: string): Promise<DetalheExtrato | null> {
  const { data, error } = await supabase
    .from("vendas_trocas")
    .select(COLUNAS_TROCA)
    .eq("id", trocaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const troca = data as TrocaLida;
  const linhas = await buscarLinhasDoGrupo(troca.grupo_venda);
  return { tipo: "venda", linhas: semAuxiliarDuplo(linhas), troca: paraTrocaDetalhe(troca) };
}

function buscarDetalhe(evento: EventoExtrato): Promise<DetalheExtrato | null> {
  if (evento.origem === "ordem_servico") return buscarOrdem(evento.referencia_id);
  if (evento.origem === "devolucao_troca") return buscarVendaDaTroca(evento.referencia_id);
  return buscarVenda(evento.referencia_id);
}

async function buscarOrdem(id: string): Promise<DetalheExtrato | null> {
  const { data, error } = await supabase
    .from("ordens_servico")
    .select(`
      id,
      numero_os,
      total,
      data_saida,
      data_caixa,
      forma_pagamento,
      dispositivo_marca,
      dispositivo_modelo,
      defeito_relatado,
      avarias,
      cliente:clientes!ordens_servico_cliente_fkey(nome, telefone)
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { tipo: "os", ordem: data as unknown as OrdemDetalheExtrato };
}

/** Dados do popup de detalhes de uma linha do Extrato (venda, OS ou devolução de troca). Só busca com o popup aberto. */
export function useDetalheExtrato(evento: EventoExtrato | null) {
  return useQuery({
    queryKey: ["extrato-detalhe", evento?.origem, evento?.referencia_id],
    enabled: !!evento && temDetalheExtrato(evento),
    staleTime: 1000 * 60,
    queryFn: () => withRetry(() => buscarDetalhe(evento!), "useDetalheExtrato"),
  });
}
