// "Incluir meu usuário como funcionário": o dono vira uma linha de
// loja_funcionarios com eh_dono = true e SEM login (funcionario_user_id nulo).
// Sem login, nenhuma checagem de "é funcionário?" encontra a linha — o dono
// continua dono —, mas ele aparece como vendedor/técnico e recebe comissão.
// Desligar só inativa: excluir apagaria os_tecnicos/comissoes_tipo_servico (CASCADE).

// deno-lint-ignore no-explicit-any
export type ClienteBanco = { from: (tabela: string) => any };

/** Vagas do plano usadas: a linha do dono não conta no limite. */
export const contarVagasUsadas = (funcionarios: { eh_dono?: boolean | null }[]): number =>
  funcionarios.filter((f) => f.eh_dono !== true).length;

export type ResultadoDono = { ok: boolean; erro?: string; id?: string };

export async function ligarDonoComoFuncionarioCore(
  client: ClienteBanco,
  dono: { authUserId: string; lojaUserId: string; nome: string; email: string },
): Promise<ResultadoDono> {
  // Só o próprio dono: funcionário/gerente de filial resolvem lojaUserId para o proprietário.
  if (!dono.authUserId || dono.authUserId !== dono.lojaUserId) {
    return { ok: false, erro: "Só o dono da loja pode se incluir como funcionário." };
  }

  const { data: existente, error: errBusca } = await client
    .from("loja_funcionarios")
    .select("id, ativo")
    .eq("loja_user_id", dono.lojaUserId)
    .eq("eh_dono", true)
    .maybeSingle();
  if (errBusca) return { ok: false, erro: String(errBusca.message || errBusca) };

  if (existente) {
    // Reativa a mesma linha: o histórico (OS, vendas, comissões) continua ligado a ela.
    const { error } = await client
      .from("loja_funcionarios")
      .update({ ativo: true, updated_at: new Date().toISOString() })
      .eq("id", existente.id)
      .eq("eh_dono", true);
    return error ? { ok: false, erro: String(error.message || error) } : { ok: true, id: existente.id };
  }

  const { data: criado, error } = await client
    .from("loja_funcionarios")
    .insert({
      loja_user_id: dono.lojaUserId,
      funcionario_user_id: null,
      eh_dono: true,
      nome: dono.nome.trim() || dono.email,
      email: dono.email.toLowerCase(),
      empresa_id: null,
      ativo: true,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, erro: String(error.message || error) };
  return { ok: true, id: criado?.id };
}

/** Desligar: só ativo = false. Nunca exclui a linha. */
export async function desligarDonoComoFuncionarioCore(
  client: ClienteBanco,
  lojaUserId: string,
): Promise<ResultadoDono> {
  const { error } = await client
    .from("loja_funcionarios")
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq("loja_user_id", lojaUserId)
    .eq("eh_dono", true);
  return error ? { ok: false, erro: String(error.message || error) } : { ok: true };
}
