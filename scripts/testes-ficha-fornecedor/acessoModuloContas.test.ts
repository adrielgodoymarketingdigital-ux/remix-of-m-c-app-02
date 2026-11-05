// deno test --no-check scripts/testes-ficha-fornecedor/
import { assertEquals } from "jsr:@std/assert@1";
import { podeAcessarModuloContas as pode } from "../../src/lib/contas/acessoModuloContas.ts";

const base = {
  carregandoFuncionario: false,
  isFuncionario: false,
  funcionarioTemModulo: false,
  carregandoAssinatura: false,
  temAssinatura: true,
  planoTemModulo: true,
};

Deno.test("dono com plano que libera Contas vê o botão", () => {
  assertEquals(pode(base), true);
});

Deno.test("dono com plano sem Contas não vê", () => {
  assertEquals(pode({ ...base, planoTemModulo: false }), false);
});

Deno.test("funcionário sem o módulo contas não vê, mesmo com plano liberado", () => {
  assertEquals(pode({ ...base, isFuncionario: true, funcionarioTemModulo: false }), false);
});

Deno.test("funcionário com o módulo contas vê (o plano não entra, como na rota)", () => {
  assertEquals(pode({ ...base, isFuncionario: true, funcionarioTemModulo: true, planoTemModulo: false }), true);
});

Deno.test("carregando permissões ou assinatura: não mostra", () => {
  assertEquals(pode({ ...base, carregandoFuncionario: true }), false);
  assertEquals(pode({ ...base, carregandoAssinatura: true, temAssinatura: false }), false);
  // Recarregando com assinatura já em mãos: mantém
  assertEquals(pode({ ...base, carregandoAssinatura: true, temAssinatura: true }), true);
});
