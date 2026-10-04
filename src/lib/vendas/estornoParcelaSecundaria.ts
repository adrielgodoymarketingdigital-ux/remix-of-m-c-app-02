import { supabase } from "@/integrations/supabase/client";
import {
  cancelarParcelaDaContaExcluidaCore,
  estornarParcelaSecundariaCore,
  gruposComPrincipalAtivaCore,
  type ResultadoContaExcluida,
  type ResultadoEstorno,
} from "./estornoParcelaSecundaria.core";

export type { ResultadoContaExcluida, ResultadoEstorno };

/** Fachadas com o cliente Supabase real — regras em estornoParcelaSecundaria.core.ts. */
export const estornarParcelaSecundaria = (vendaId: string, userId: string): Promise<ResultadoEstorno> =>
  estornarParcelaSecundariaCore(supabase, { vendaId, userId });

export const cancelarParcelaDaContaExcluida = (
  descricao: string | null | undefined,
  userId: string,
): Promise<ResultadoContaExcluida> => cancelarParcelaDaContaExcluidaCore(supabase, { descricao, userId });

export const gruposComPrincipalAtiva = (userId: string, grupos: string[]): Promise<Set<string>> =>
  gruposComPrincipalAtivaCore(supabase, userId, grupos);
