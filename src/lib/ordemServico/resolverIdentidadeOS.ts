import { resolverIdentidadeGravacao } from "@/lib/multiempresas/identidadeGravacao";

export interface IdentidadeOS {
  effectiveUserId: string;
  empresaId: string | null;
}

/**
 * Resolve o user_id efetivo (dono da loja) e a empresa_id a usar ao salvar uma OS.
 * user_id: gerente de filial → proprietário | funcionário comum → dono da loja | proprietário → próprio id.
 * empresa_id: regra única de src/lib/multiempresas/resolverLojaGravacao.ts
 * (funcionário vinculado a filial grava na filial dele; antes caía na matriz).
 */
export async function resolverIdentidadeOS(
  authUserId: string,
  isProprietario: boolean,
  empresaAtivaCtx: string | null
): Promise<IdentidadeOS> {
  const { effectiveUserId, empresaId } = await resolverIdentidadeGravacao(authUserId, isProprietario, empresaAtivaCtx);
  return { effectiveUserId, empresaId };
}
