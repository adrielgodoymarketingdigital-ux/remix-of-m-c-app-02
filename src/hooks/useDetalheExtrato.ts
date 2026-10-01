import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/supabase-retry";
import { SELECT_VENDA_COM_ITENS } from "@/lib/vendas/itensVenda";
import type { Venda } from "@/types/venda";
import type { AvariasOS } from "@/types/ordem-servico";
import type { EventoExtrato } from "./useExtratoFinanceiro";

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

export type DetalheExtrato =
  /** Linhas de `vendas` da mesma venda (todos os itens e parcelas), sem o registro auxiliar de pagamento duplo. */
  | { tipo: "venda"; linhas: Venda[] }
  | { tipo: "os"; ordem: OrdemDetalheExtrato };

/** Origens do Extrato que têm popup de detalhes. */
export const temDetalheExtrato = (evento: EventoExtrato) =>
  evento.origem === "venda_pdv" || evento.origem === "ordem_servico";

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
    const { data: grupo, error: erroGrupo } = await supabase
      .from("vendas")
      .select(SELECT_VENDA_COM_ITENS)
      .eq("grupo_venda", principal.grupo_venda)
      .is("deleted_at", null)
      .order("data", { ascending: true });
    if (erroGrupo) throw erroGrupo;
    if (grupo?.length) linhas = grupo;
  }

  return {
    tipo: "venda",
    linhas: (linhas as unknown as Venda[]).filter((v) => v.observacoes !== "pagamento_duplo_secundario"),
  };
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

/** Dados do popup de detalhes de uma linha do Extrato (venda ou OS). Só busca com o popup aberto. */
export function useDetalheExtrato(evento: EventoExtrato | null) {
  return useQuery({
    queryKey: ["extrato-detalhe", evento?.origem, evento?.referencia_id],
    enabled: !!evento && temDetalheExtrato(evento),
    staleTime: 1000 * 60,
    queryFn: () =>
      withRetry(
        () => (evento!.origem === "ordem_servico" ? buscarOrdem(evento!.referencia_id) : buscarVenda(evento!.referencia_id)),
        "useDetalheExtrato",
      ),
  });
}
