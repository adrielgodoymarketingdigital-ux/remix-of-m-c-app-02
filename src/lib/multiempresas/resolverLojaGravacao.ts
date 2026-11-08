/**
 * Loja (empresa_id) em que um registro novo é gravado: venda, OS, conta manual,
 * serviço avulso, compra de aparelho, lançamento manual do extrato.
 *
 * Regras (decididas pelo negócio):
 * - Gerente de filial → a filial dele.
 * - Funcionário (loja_funcionarios) → a loja dele (loja_funcionarios.empresa_id);
 *   se for nula, a matriz do dono.
 * - Dono → a loja ativa (empresaAtiva, só quando ele é proprietário multiempresa);
 *   sem seleção, a matriz.
 * - Matriz desconhecida (ex.: o RLS de empresas não deixa o funcionário ler, ou
 *   a conta não tem matriz) → null. A leitura trata null como matriz, e a
 *   venda/OS NUNCA é bloqueada por isso.
 *
 * Contas geradas por uma venda/OS NÃO passam por aqui: herdam o empresa_id do
 * registro que as originou (ver empresaIdHerdado).
 *
 * Função pura: sem banco, sem React.
 */

export type PapelGravacao = "gerente" | "funcionario" | "dono";

export interface EntradaLojaGravacao {
  papel: PapelGravacao;
  /** empresa_usuarios.empresa_id do gerente logado. */
  gerenteEmpresaId?: string | null;
  /** loja_funcionarios.empresa_id do funcionário logado (null = matriz). */
  funcionarioEmpresaId?: string | null;
  /** O usuário logado tem matriz própria (EmpresaContext.isProprietario). */
  isProprietario?: boolean;
  /** Loja escolhida no seletor da barra lateral (só vale para o dono). */
  empresaAtiva?: string | null;
  /** Matriz do dono da loja; null/undefined = desconhecida. */
  matrizId?: string | null;
}

const preenchido = (v: string | null | undefined): v is string => typeof v === "string" && v.length > 0;

/** Gerente tem prioridade sobre funcionário (mesma ordem de antes no PDV e na OS). */
export function papelDeGravacao(p: { ehGerente: boolean; ehFuncionario: boolean }): PapelGravacao {
  if (p.ehGerente) return "gerente";
  if (p.ehFuncionario) return "funcionario";
  return "dono";
}

/** Loja já definida sem precisar da matriz (ou null se depende dela). */
function lojaPropria(e: EntradaLojaGravacao): string | null {
  switch (e.papel) {
    case "gerente":
      return preenchido(e.gerenteEmpresaId) ? e.gerenteEmpresaId : null;
    case "funcionario":
      return preenchido(e.funcionarioEmpresaId) ? e.funcionarioEmpresaId : null;
    case "dono":
      return e.isProprietario === true && preenchido(e.empresaAtiva) ? e.empresaAtiva : null;
  }
}

/** true quando o resultado depende do id da matriz (só então vale a pena buscá-lo). */
export function precisaDaMatriz(e: EntradaLojaGravacao): boolean {
  return lojaPropria(e) === null;
}

export function resolverLojaGravacao(e: EntradaLojaGravacao): string | null {
  const propria = lojaPropria(e);
  if (propria !== null) return propria;
  return preenchido(e.matrizId) ? e.matrizId : null;
}

/** Conta gerada por venda/OS: sempre o empresa_id do registro de origem (null continua null). */
export function empresaIdHerdado(origem: { empresa_id?: string | null } | null | undefined): string | null {
  const v = origem?.empresa_id;
  return preenchido(v) ? v : null;
}
