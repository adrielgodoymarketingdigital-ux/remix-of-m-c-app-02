/**
 * Leitura das devoluções de troca (vendas_trocas). A soma e as regras ficam em
 * devolucoesTroca.ts. RLS: dono e funcionário ativo leem pelo user_id do dono;
 * gerente de filial, as da sua empresa.
 */
import { supabase } from "@/integrations/supabase/client";
import { somarDevolucoesTroca, type TotaisDevolucoesTroca } from "./devolucoesTroca";

/** Devoluções feitas no caixa (vendas_trocas.caixa_id). Lança em erro de leitura. */
export async function carregarDevolucoesDoCaixa(caixaId: string): Promise<TotaisDevolucoesTroca> {
  const { data, error } = await supabase
    .from("vendas_trocas")
    .select("valor_devolvido, forma_devolucao, cancelada")
    .eq("caixa_id", caixaId)
    .gt("valor_devolvido", 0);
  if (error) throw error;
  return somarDevolucoesTroca(data ?? []);
}

/** Devoluções das vendas (grupo_venda) já filtradas por período/empresa. Lança em erro de leitura. */
export async function carregarDevolucoesDasVendas(gruposVenda: string[]): Promise<TotaisDevolucoesTroca> {
  const grupos = [...new Set(gruposVenda)];
  const linhas: { valor_devolvido: number; forma_devolucao: string | null; cancelada: boolean }[] = [];
  // Lotes: a lista vai na URL do PostgREST.
  for (let i = 0; i < grupos.length; i += 200) {
    const { data, error } = await supabase
      .from("vendas_trocas")
      .select("valor_devolvido, forma_devolucao, cancelada")
      .in("grupo_venda", grupos.slice(i, i + 200))
      .gt("valor_devolvido", 0);
    if (error) throw error;
    linhas.push(...(data ?? []));
  }
  return somarDevolucoesTroca(linhas);
}
