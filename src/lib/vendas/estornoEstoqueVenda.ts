import { supabase } from "@/integrations/supabase/client";
import {
  carregarLinhasDaVendaCore,
  excluirVendaDevolvendoEstoqueCore,
  liberarImeiDaLinhaCore,
  type LinhaDaVendaParaExcluir,
  type LinhaVendaEstoque,
  type ResultadoExcluirVenda,
} from "./estornoEstoqueVenda.core";

export type { LinhaDaVendaParaExcluir, ResultadoExcluirVenda };

/** Fachada com o cliente Supabase real — regras em estornoEstoqueVenda.core.ts. */
export const liberarImeiDaLinha = (linha: Pick<LinhaVendaEstoque, "id" | "tipo" | "user_id">): Promise<number> =>
  liberarImeiDaLinhaCore(supabase, linha);

export const carregarLinhasDaVenda = (p: { vendaId: string; grupoVenda: string | null; userId: string }) =>
  carregarLinhasDaVendaCore(supabase, p);

export const excluirVendaDevolvendoEstoque = (p: { linhas: LinhaDaVendaParaExcluir[]; motivo: string; agoraISO: string }) =>
  excluirVendaDevolvendoEstoqueCore(supabase, p);
