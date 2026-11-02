// deno test --no-check scripts/testes-cadastro-plano-captcha/
// Roda a função real de src/lib/erroLoginCadastroPlano.ts e confere no código da
// tela as regras do captcha (token de uso único, widget nos dois modos).
import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1";
import { mensagemErroLogin } from "../../src/lib/erroLoginCadastroPlano.ts";

const tela = Deno.readTextFileSync(new URL("../../src/pages/CadastroPlano.tsx", import.meta.url));

Deno.test("só invalid_credentials vira email ou senha incorretos", () => {
  assertEquals(mensagemErroLogin({ code: "invalid_credentials", status: 400 }), "Email ou senha incorretos.");
  assertFalse(mensagemErroLogin({ code: "captcha_failed", status: 400 }).includes("incorretos"));
  assertFalse(mensagemErroLogin(new TypeError("Failed to fetch")).includes("incorretos"));
});

Deno.test("captcha recusado pede nova verificação", () => {
  assertStringIncludes(mensagemErroLogin({ code: "captcha_failed", status: 400 }), "verificação de segurança");
});

Deno.test("limite de tentativas, por status ou por código", () => {
  assertStringIncludes(mensagemErroLogin({ status: 429 }), "Muitas tentativas");
  assertStringIncludes(mensagemErroLogin({ code: "over_request_rate_limit" }), "Muitas tentativas");
});

Deno.test("erro vazio não quebra e cai na mensagem genérica", () => {
  assertStringIncludes(mensagemErroLogin(null), "Não foi possível entrar");
  assertStringIncludes(mensagemErroLogin(undefined), "Não foi possível entrar");
});

Deno.test("todo signInWithPassword da tela envia captchaToken", () => {
  const chamadas = tela.split("signInWithPassword(").slice(1);
  assertEquals(chamadas.length, 1);
  assertStringIncludes(chamadas[0].slice(0, chamadas[0].indexOf("});")), "captchaToken");
});

Deno.test("widget fica montado nos dois modos e o botão exige token", () => {
  assertFalse(/!isLogin && \(\s*<TurnstileWidget/.test(tela));
  assert(tela.includes("disabled={loading || !captchaToken}"));
});

Deno.test("token é limpo depois do signUp e do login", () => {
  for (const chamada of ["auth.signUp(", "auth.signInWithPassword("]) {
    const depois = tela.slice(tela.indexOf(chamada));
    const finalmente = depois.slice(depois.indexOf("} finally {"), depois.indexOf("setLoading(false)"));
    assertStringIncludes(finalmente, "turnstileRef.current?.reset()");
    assertStringIncludes(finalmente, "setCaptchaToken(null)");
  }
});
