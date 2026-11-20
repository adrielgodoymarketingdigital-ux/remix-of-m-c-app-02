// deno test --no-check scripts/testes-minhas-garantias/
// Freio da fase A: só admin vê "Minhas garantias".
import { assertEquals } from "jsr:@std/assert@1";
import { MINHAS_GARANTIAS_LIBERADA, telaMinhasGarantiasVisivelPara } from "../../src/lib/garantias/visibilidadeMinhasGarantias.ts";

const PAPEIS = ["dono", "funcionario", "gerente", null, undefined] as const;

Deno.test("fase A: o freio está puxado (só admin)", () => {
  assertEquals(MINHAS_GARANTIAS_LIBERADA, false);
});

Deno.test("fase A (padrão): admin vê; dono, funcionário, gerente e carregando não", () => {
  for (const papel of PAPEIS) {
    assertEquals(telaMinhasGarantiasVisivelPara({ isAdmin: true, papel }), true, `admin/${papel}`);
    assertEquals(telaMinhasGarantiasVisivelPara({ isAdmin: false, papel }), false, `comum/${papel}`);
  }
});

Deno.test("liberado: admin e dono veem; funcionário, gerente e carregando não", () => {
  const esperado = { dono: true, funcionario: false, gerente: false, null: false, undefined: false } as Record<string, boolean>;
  for (const papel of PAPEIS) {
    assertEquals(telaMinhasGarantiasVisivelPara({ isAdmin: false, papel }, true), esperado[String(papel)], String(papel));
    assertEquals(telaMinhasGarantiasVisivelPara({ isAdmin: true, papel }, true), true);
  }
});
