import { supabase } from "@/integrations/supabase/client";
import {
  excluirContasPendentesDaVendaCore,
  type ResultadoContasDaVenda,
} from "./excluirContasPendentesDaVenda.core";

export type { ResultadoContasDaVenda };

/** Fachada com o cliente Supabase real — regras em excluirContasPendentesDaVenda.core.ts. */
export const excluirContasPendentesDaVenda = (
  vendaIds: string[],
  userId: string | null,
): Promise<ResultadoContasDaVenda> => excluirContasPendentesDaVendaCore(supabase, { vendaIds, userId });
