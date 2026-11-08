import type { SupabaseClient } from "@supabase/supabase-js";
import {
  papelDeGravacao,
  precisaDaMatriz,
  resolverLojaGravacao,
  type PapelGravacao,
} from "./resolverLojaGravacao.ts";

export type ClienteBancoLike = Pick<SupabaseClient, "from">;

export interface IdentidadeGravacao {
  /** user_id a gravar: dono da loja (gerente → proprietário, funcionário → dono). */
  effectiveUserId: string;
  /** empresa_id a gravar (null = matriz desconhecida / conta sem multiempresa). */
  empresaId: string | null;
  papel: PapelGravacao;
}

/**
 * Matriz do dono. Nunca lança: erro de leitura (inclusive RLS) = matriz
 * desconhecida = null. Mesma consulta que PDV e OS já usavam.
 */
export async function buscarMatrizIdCore(cliente: ClienteBancoLike, donoId: string): Promise<string | null> {
  try {
    const { data, error } = await cliente
      .from("empresas")
      .select("id")
      .eq("proprietario_id", donoId)
      .eq("tipo", "matriz")
      .maybeSingle();
    if (error || !data) return null;
    const id = (data as { id?: unknown }).id;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * Quem está gravando e em qual loja. user_id segue exatamente a regra de antes
 * (gerente → proprietário | funcionário → dono | senão o próprio usuário).
 * As leituras de gerente/funcionário não são engolidas: se falharem por rede,
 * o salvamento falha como antes (senão gravaria com o user_id errado).
 */
export async function resolverIdentidadeGravacaoCore(
  cliente: ClienteBancoLike,
  authUserId: string,
  isProprietario: boolean,
  empresaAtiva: string | null,
): Promise<IdentidadeGravacao> {
  const [gerente, funcionario] = await Promise.all([
    cliente
      .from("empresa_usuarios")
      .select("proprietario_id, empresa_id")
      .eq("gerente_id", authUserId)
      .maybeSingle()
      .then((r) => (r.data ?? null) as { proprietario_id: string | null; empresa_id: string | null } | null),
    cliente
      .from("loja_funcionarios")
      .select("loja_user_id, empresa_id")
      .eq("funcionario_user_id", authUserId)
      .eq("ativo", true)
      .maybeSingle()
      .then((r) => (r.data ?? null) as { loja_user_id: string | null; empresa_id: string | null } | null),
  ]);

  const effectiveUserId = gerente?.proprietario_id || funcionario?.loja_user_id || authUserId;
  const papel = papelDeGravacao({
    ehGerente: !!gerente?.proprietario_id,
    ehFuncionario: !!funcionario?.loja_user_id,
  });

  const entrada = {
    papel,
    gerenteEmpresaId: gerente?.empresa_id ?? null,
    funcionarioEmpresaId: funcionario?.empresa_id ?? null,
    isProprietario,
    empresaAtiva,
  };
  const matrizId = precisaDaMatriz(entrada) ? await buscarMatrizIdCore(cliente, effectiveUserId) : null;

  return { effectiveUserId, empresaId: resolverLojaGravacao({ ...entrada, matrizId }), papel };
}
