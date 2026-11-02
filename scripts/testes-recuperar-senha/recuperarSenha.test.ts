// deno test --no-check scripts/testes-recuperar-senha/
// Roda a função real de src/lib/recuperarSenha.ts (erros do "esqueci a senha").
import { assertEquals } from "jsr:@std/assert@1";
import { mensagemErroRecuperacao } from "../../src/lib/recuperarSenha.ts";

Deno.test("captcha recusado pede nova verificação", () => {
  const { title } = mensagemErroRecuperacao({ code: "captcha_failed", status: 400 });
  assertEquals(title, "Verificação de segurança falhou");
});

Deno.test("limite de envio pede para aguardar, por status ou por código", () => {
  assertEquals(mensagemErroRecuperacao({ status: 429 }).title, "Aguarde");
  assertEquals(mensagemErroRecuperacao({ code: "over_email_send_rate_limit" }).title, "Aguarde");
  assertEquals(mensagemErroRecuperacao({ code: "over_request_rate_limit" }).title, "Aguarde");
});

Deno.test("qualquer outro erro vira mensagem geral", () => {
  assertEquals(mensagemErroRecuperacao({ code: "unexpected_failure", status: 500 }).title, "Erro");
  assertEquals(mensagemErroRecuperacao({}).title, "Erro");
});
