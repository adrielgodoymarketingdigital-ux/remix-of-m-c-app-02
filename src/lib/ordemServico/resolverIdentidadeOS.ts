import { supabase } from "@/integrations/supabase/client";

export interface IdentidadeOS {
  effectiveUserId: string;
  empresaId: string | null;
}

/**
 * Resolve o user_id efetivo (dono da loja) e a empresa_id a usar ao salvar uma OS.
 * Prioridade: gerente de filial → proprietário | funcionário comum → dono da loja | proprietário → próprio id.
 */
export async function resolverIdentidadeOS(
  authUserId: string,
  isProprietario: boolean,
  empresaAtivaCtx: string | null
): Promise<IdentidadeOS> {
  const [gerenteFilialOS, funcData] = await Promise.all([
    supabase
      .from("empresa_usuarios")
      .select("proprietario_id, empresa_id")
      .eq("gerente_id", authUserId)
      .maybeSingle()
      .then((r) => r.data),
    supabase
      .from("loja_funcionarios")
      .select("loja_user_id")
      .eq("funcionario_user_id", authUserId)
      .eq("ativo", true)
      .maybeSingle()
      .then((r) => r.data),
  ]);

  const effectiveUserId =
    gerenteFilialOS?.proprietario_id || funcData?.loja_user_id || authUserId;

  let empresaId: string | null = gerenteFilialOS?.empresa_id ?? null;

  if (!empresaId) {
    if (isProprietario && empresaAtivaCtx) {
      empresaId = empresaAtivaCtx;
    } else {
      const { data: empresaPrincipal } = await supabase
        .from("empresas")
        .select("id")
        .eq("proprietario_id", effectiveUserId)
        .eq("tipo", "matriz")
        .maybeSingle();
      empresaId = empresaPrincipal?.id ?? null;
    }
  }

  return { effectiveUserId, empresaId };
}
