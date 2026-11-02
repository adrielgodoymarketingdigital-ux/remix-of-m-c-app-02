interface ErroAuth {
  code?: string;
  status?: number;
}

/**
 * Texto do erro do login em /cadastro-plano, pelo CÓDIGO do erro do Auth.
 * Só invalid_credentials vira "email ou senha incorretos": captcha recusado com
 * a senha certa não pode parecer senha errada.
 */
export function mensagemErroLogin(erro: unknown): string {
  const e = (erro ?? {}) as ErroAuth;

  if (e.code === "invalid_credentials") {
    return "Email ou senha incorretos.";
  }
  if (e.code === "captcha_failed") {
    return "A verificação de segurança falhou. Aguarde ela ser concluída e tente novamente.";
  }
  if (e.status === 429 || e.code === "over_request_rate_limit") {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  if (e.code === "email_not_confirmed") {
    return "Confirme seu email pelo link que enviamos e tente novamente.";
  }
  if (e.code === "user_banned") {
    return "Esta conta está bloqueada. Fale com o suporte.";
  }
  return "Não foi possível entrar. Verifique sua internet e tente novamente.";
}
