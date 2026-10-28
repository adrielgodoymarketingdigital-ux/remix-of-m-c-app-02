// deno test --no-check scripts/testes-situacao-estoque/
// Funções puras de src/lib/estoque/configuracaoEstoque.ts (usadas pelo useConfiguracaoEstoque).
import { assertEquals } from "jsr:@std/assert@1";
import {
  ehTabelaAusente,
  interpretarLeitura,
  LIMITE_BAIXO_MAXIMO,
  limiteParaSalvar,
  validarCampoLimite,
} from "../../src/lib/estoque/configuracaoEstoque.ts";

Deno.test("tabela ausente: PGRST205, 42P01 e mensagem do schema cache", () => {
  assertEquals(ehTabelaAusente({ code: "PGRST205", message: "Could not find the table 'public.configuracao_estoque' in the schema cache" }), true);
  assertEquals(ehTabelaAusente({ code: "42P01", message: 'relation "public.configuracao_estoque" does not exist' }), true);
  assertEquals(ehTabelaAusente({ code: null, message: "Could not find the table 'public.configuracao_estoque' in the schema cache" }), true);
  assertEquals(ehTabelaAusente({ code: "42501", message: "permission denied for table configuracao_estoque" }), false);
  assertEquals(ehTabelaAusente({ code: "", message: "TypeError: Failed to fetch" }), false);
  assertEquals(ehTabelaAusente(null), false);
});

Deno.test("leitura: sem linha, com limite, 0, nulo", () => {
  assertEquals(interpretarLeitura(null, null), { limiteBaixo: null, tabelaDisponivel: true });
  assertEquals(interpretarLeitura({ limite_baixo: 3 }, null), { limiteBaixo: 3, tabelaDisponivel: true });
  assertEquals(interpretarLeitura({ limite_baixo: 0 }, null), { limiteBaixo: 0, tabelaDisponivel: true });
  assertEquals(interpretarLeitura({ limite_baixo: null }, null), { limiteBaixo: null, tabelaDisponivel: true });
});

Deno.test("leitura: valor estranho vira 'sem configuração'", () => {
  for (const v of [-1, 2.5, 1001, "3", Number.NaN, undefined]) {
    assertEquals(interpretarLeitura({ limite_baixo: v }, null).limiteBaixo, null, `valor ${String(v)}`);
  }
  assertEquals(interpretarLeitura({ limite_baixo: LIMITE_BAIXO_MAXIMO }, null).limiteBaixo, LIMITE_BAIXO_MAXIMO);
});

Deno.test("leitura com erro nunca lança e cai no padrão", () => {
  assertEquals(interpretarLeitura(null, { code: "PGRST205", message: "x" }), { limiteBaixo: null, tabelaDisponivel: false });
  assertEquals(interpretarLeitura({ limite_baixo: 3 }, { code: "500", message: "falhou" }), { limiteBaixo: null, tabelaDisponivel: true });
});

Deno.test("campo: vazio = padrão; só inteiro de 0 a 1000", () => {
  assertEquals(validarCampoLimite(""), { ok: true, valor: null });
  assertEquals(validarCampoLimite("   "), { ok: true, valor: null });
  assertEquals(validarCampoLimite("0"), { ok: true, valor: 0 });
  assertEquals(validarCampoLimite("3"), { ok: true, valor: 3 });
  assertEquals(validarCampoLimite(" 12 "), { ok: true, valor: 12 });
  assertEquals(validarCampoLimite("1000"), { ok: true, valor: 1000 });
  for (const t of ["1001", "-1", "2.5", "2,5", "abc", "3a"]) assertEquals(validarCampoLimite(t), { ok: false }, t);
});

Deno.test("'não avisar' grava 0, qualquer que seja o campo", () => {
  assertEquals(limiteParaSalvar("7", true), { ok: true, valor: 0 });
  assertEquals(limiteParaSalvar("", true), { ok: true, valor: 0 });
  assertEquals(limiteParaSalvar("abc", true), { ok: true, valor: 0 });
  assertEquals(limiteParaSalvar("7", false), { ok: true, valor: 7 });
  assertEquals(limiteParaSalvar("", false), { ok: true, valor: null });
});
