// deno test --no-check scripts/testes-dono-funcionario/
// Roda as funções reais de src/lib/equipe/donoFuncionario.core.ts contra o banco em memória.
import { assertEquals } from "jsr:@std/assert@1";
import { bancoFake } from "../../supabase/functions/_shared/testes/bancoFake.ts";
import {
  contarVagasUsadas,
  desligarDonoComoFuncionarioCore,
  ligarDonoComoFuncionarioCore,
} from "../../src/lib/equipe/donoFuncionario.core.ts";

type Linha = Record<string, unknown>;
const DONO = "dono-1";
const DADOS = { authUserId: DONO, lojaUserId: DONO, nome: "Andy", email: "Andystts25@icloud.com" };

function banco() {
  const tabelas: Record<string, Linha[]> = {
    loja_funcionarios: [
      { id: "f1", loja_user_id: DONO, funcionario_user_id: "login-f1", eh_dono: false, nome: "Técnico", ativo: true },
    ],
  };
  return { tabelas, db: bancoFake(tabelas) };
}
const linhasDono = (t: Record<string, Linha[]>) => t.loja_funcionarios.filter((f) => f.eh_dono === true);

Deno.test("ligar cria a linha do dono sem login, sem filial e com e-mail em minúsculas", async () => {
  const { tabelas, db } = banco();

  const r = await ligarDonoComoFuncionarioCore(db, DADOS);

  assertEquals(r.ok, true);
  const [dono] = linhasDono(tabelas);
  assertEquals(
    { loja: dono.loja_user_id, login: dono.funcionario_user_id, filial: dono.empresa_id, email: dono.email, ativo: dono.ativo, nome: dono.nome },
    { loja: DONO, login: null, filial: null, email: "andystts25@icloud.com", ativo: true, nome: "Andy" },
  );
  assertEquals(r.id, dono.id);
});

Deno.test("desligar só inativa a linha do dono (não exclui) e não mexe nos funcionários", async () => {
  const { tabelas, db } = banco();
  await ligarDonoComoFuncionarioCore(db, DADOS);

  const r = await desligarDonoComoFuncionarioCore(db, DONO);

  assertEquals(r.ok, true);
  assertEquals(linhasDono(tabelas).length, 1);
  assertEquals(linhasDono(tabelas)[0].ativo, false);
  assertEquals(tabelas.loja_funcionarios.find((f) => f.id === "f1")!.ativo, true);
});

Deno.test("religar reativa a MESMA linha (histórico continua ligado a ela), sem duplicar", async () => {
  const { tabelas, db } = banco();
  const primeira = await ligarDonoComoFuncionarioCore(db, DADOS);
  await desligarDonoComoFuncionarioCore(db, DONO);

  const segunda = await ligarDonoComoFuncionarioCore(db, DADOS);

  assertEquals(segunda.id, primeira.id);
  assertEquals(linhasDono(tabelas).length, 1);
  assertEquals(linhasDono(tabelas)[0].ativo, true);
});

Deno.test("funcionário ou gerente de filial (login ≠ dono da loja) não cria linha de dono", async () => {
  const { tabelas, db } = banco();

  const r = await ligarDonoComoFuncionarioCore(db, { ...DADOS, authUserId: "login-f1" });

  assertEquals(r.ok, false);
  assertEquals(linhasDono(tabelas).length, 0);
});

Deno.test("a linha do dono não ocupa vaga do plano", () => {
  assertEquals(contarVagasUsadas([{ eh_dono: false }, { eh_dono: true }, {}]), 2);
  assertEquals(contarVagasUsadas([{ eh_dono: true }]), 0);
});
