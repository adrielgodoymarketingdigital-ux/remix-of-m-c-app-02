/**
 * Mesma regra que libera a rota /contas (App.tsx): ComVerificacaoFuncionario
 * + ComVerificacaoPlano com modulo="contas".
 * - Funcionário: vale a permissão do módulo que o dono liberou (o plano não entra).
 * - Demais (dono): vale o plano.
 * - Carregando: não libera (a rota mostra o carregamento; aqui o botão só some).
 */
export function podeAcessarModuloContas(e: {
  carregandoFuncionario: boolean;
  isFuncionario: boolean;
  funcionarioTemModulo: boolean;
  carregandoAssinatura: boolean;
  temAssinatura: boolean;
  planoTemModulo: boolean;
}): boolean {
  if (e.carregandoFuncionario) return false;
  if (e.isFuncionario) return e.funcionarioTemModulo;
  if (e.carregandoAssinatura && !e.temAssinatura) return false;
  return e.planoTemModulo;
}
