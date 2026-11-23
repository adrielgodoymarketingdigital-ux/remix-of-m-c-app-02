// deno test --no-check --no-lock --allow-read scripts/testes-os-tecnicos/
// Ajuda "Como funciona a comissão" (Equipe): os números do exemplo saem das
// regras reais de comissão, e a tela não tem valor escrito à mão.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { calcularExemploComissao } from "../../src/lib/comissao/exemploComissao.ts";

Deno.test("exemplo da ajuda: Ana R$ 10, Bruno R$ 40, total R$ 50 — pelas regras do app", () => {
  const ex = calcularExemploComissao();
  assertEquals([ex.totalOS, ex.servicoA, ex.servicoB], [300, 100, 200]);
  assertEquals(ex.principal, 10); // 10% só do Serviço A (B saiu da base dela)
  assertEquals(ex.tecnico, 40); // 20% do Serviço B
  assertEquals(ex.principal + ex.tecnico, 50); // sem sobra e sem pagar em dobro
  // A Comissão geral (por cargo) dá o mesmo valor para a Ana.
  assertEquals(ex.principalComissaoGeral, ex.principal);
});

Deno.test("a tela usa os números calculados (nada de R$ 10 / R$ 40 escrito à mão)", async () => {
  const tsx = await Deno.readTextFile(new URL("../../src/components/equipe/ComoFuncionaComissao.tsx", import.meta.url));
  assert(tsx.includes("calcularExemploComissao()"));
  assert(tsx.includes("{r(ex.principal)}") && tsx.includes("{r(ex.tecnico)}"));
  assert(!/R\$\s?(10|40|100|200|300)\b/.test(tsx), "valor do exemplo escrito à mão na tela");
  for (const frase of [
    "Como funciona a comissão",
    "Quem ganha comissão",
    "Como o valor é calculado",
    "Regras para lembrar",
    "Só OS entregues geram comissão.",
    "Ninguém recebe duas vezes sobre o mesmo serviço.",
  ]) assert(tsx.includes(frase), frase);
});

Deno.test("a ajuda aparece no Desempenho da Equipe e no cadastro do funcionário", async () => {
  for (const arquivo of ["DashboardEquipe.tsx", "DialogCadastroFuncionario.tsx"]) {
    const tsx = await Deno.readTextFile(new URL(`../../src/components/equipe/${arquivo}`, import.meta.url));
    assert(tsx.includes("<ComoFuncionaComissao />"), arquivo);
  }
});
