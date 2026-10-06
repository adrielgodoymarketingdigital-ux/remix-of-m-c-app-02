/**
 * Depois de cadastrar um dispositivo, quem ainda não criou nenhuma OS é levado
 * para /os (próximo passo do onboarding). Só pode acontecer quando o cadastro é
 * a tela principal: com o cadastro aninhado em outro formulário (o "+ Novo
 * Dispositivo" de Registrar Nova Compra) a navegação desmonta a página, e o
 * formulário some sem erro nenhum — caso real no Android, out/2026.
 * Sem linha de onboarding (null/undefined) conta como OS ainda não criada.
 */
export function deveIrParaOSAposCadastrarDispositivo(
  osJaCriada: boolean | null | undefined,
  redirecionarOnboarding: boolean,
): boolean {
  return redirecionarOnboarding && !osJaCriada;
}
