import { supabase } from "@/integrations/supabase/client";
import {
  buscarMatrizIdCore,
  resolverIdentidadeGravacaoCore,
  type IdentidadeGravacao,
} from "./identidadeGravacao.core";

export type { IdentidadeGravacao } from "./identidadeGravacao.core";

/** Ver resolverIdentidadeGravacaoCore. Usa o cliente do app. */
export function resolverIdentidadeGravacao(
  authUserId: string,
  isProprietario: boolean,
  empresaAtiva: string | null,
): Promise<IdentidadeGravacao> {
  return resolverIdentidadeGravacaoCore(supabase, authUserId, isProprietario, empresaAtiva);
}

/**
 * Só o empresa_id a gravar, para telas em que o user_id NÃO vem daqui.
 * Nunca lança: se a identificação falhar, devolve `seFalhar` (o valor que a
 * tela já gravava antes), para nunca bloquear o lançamento.
 */
export async function resolverEmpresaGravacaoSegura(
  authUserId: string,
  isProprietario: boolean,
  empresaAtiva: string | null,
  seFalhar: string | null,
): Promise<string | null> {
  try {
    return (await resolverIdentidadeGravacaoCore(supabase, authUserId, isProprietario, empresaAtiva)).empresaId;
  } catch (erro) {
    console.error("[multiempresas] Não foi possível identificar a loja; mantendo a anterior:", erro);
    return seFalhar;
  }
}

/** Matriz do dono; null se não existir ou não puder ser lida. Nunca lança. */
export function buscarMatrizId(donoId: string): Promise<string | null> {
  return buscarMatrizIdCore(supabase, donoId);
}
