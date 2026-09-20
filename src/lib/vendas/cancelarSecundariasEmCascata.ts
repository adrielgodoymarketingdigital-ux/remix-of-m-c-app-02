import { supabase } from "@/integrations/supabase/client";
import {
  cancelarSecundariasEmCascataCore,
  type ResultadoCascata,
  type VendaParaCascata,
} from "./cancelarSecundariasEmCascata.core";

export type { ResultadoCascata, VendaParaCascata };

/** Fachada com o cliente Supabase real — regras em cancelarSecundariasEmCascata.core.ts. */
export const cancelarSecundariasEmCascata = (
  venda: VendaParaCascata,
  opts: { motivo?: string | null } = {},
): Promise<ResultadoCascata> => cancelarSecundariasEmCascataCore(supabase, venda, opts);
