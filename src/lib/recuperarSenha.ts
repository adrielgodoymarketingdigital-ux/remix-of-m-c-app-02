interface ErroAuth {
  code?: string;
  status?: number;
}

/**
 * Texto do erro do "esqueci a senha". E-mail não cadastrado não passa por aqui:
 * o Auth responde 200 nesse caso, e a tela mantém a mensagem neutra de sucesso.
 */
export function mensagemErroRecuperacao(erro: ErroAuth): { title: string; description: string } {
  if (
    erro.status === 429 ||
    erro.code === "over_email_send_rate_limit" ||
    erro.code === "over_request_rate_limit"
  ) {
    return {
      title: "Aguarde",
      description: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
    };
  }

  if (erro.code === "captcha_failed") {
    return {
      title: "Verificação de segurança falhou",
      description: "Aguarde a verificação de segurança ser concluída e tente novamente.",
    };
  }

  return {
    title: "Erro",
    description: "Não foi possível enviar o link de redefinição. Tente novamente.",
  };
}
