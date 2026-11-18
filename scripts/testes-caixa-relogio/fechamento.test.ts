// deno test --no-check --allow-read --config scripts/testes-caixa-relogio/deno.json scripts/testes-caixa-relogio/
// Roda o useCaixa REAL e a cópia da regra atual contra o mesmo banco falso. Dados fictícios, sem rede.
import assert from "node:assert/strict";
import { servidor } from "@/integrations/supabase/client";
import { useCaixa } from "../../src/hooks/useCaixa.ts";
import { useCaixa as useCaixaAntigo } from "./referencia/useCaixaOrigemMain.ts";
import { limiteSuperiorDaSoma } from "../../src/lib/caixa/janelaFechamento.ts";
import { ABRE, FECHA, H, caixaAberto, fechar, instalarRelogio, iso, lojaCompleta, lojaDoCasoReal, preparar, soma4, venda } from "./cenario.ts";

const naHora = (ms: number) => ms;

for (const rpc of ["ok", "ausente"] as const) {
  for (const gatilho of [false, true]) {
    Deno.test(`relógio certo (função ${rpc}, gatilho ${gatilho}): gravação idêntica à de hoje`, async () => {
      const o = { tabelas: lojaCompleta(), rpc, gatilho };
      const antigo = await fechar(useCaixaAntigo, o, 321.45);
      const novo = await fechar(useCaixa, o, 321.45);
      assert.deepEqual(novo.patch, antigo.patch);
      assert.deepEqual(novo.linha, antigo.linha);
      assert.equal(novo.patch.data_fechamento, iso(FECHA));
    });
  }
}

Deno.test("relógio certo: saldo esperado calculado pelo app também é idêntico", async () => {
  const o = { tabelas: lojaCompleta() };
  assert.deepEqual((await fechar(useCaixa, o)).patch, (await fechar(useCaixaAntigo, o)).patch);
});

Deno.test("aparelho 1h atrasado, vendas na hora do servidor: soma correta", async () => {
  const o = { tabelas: lojaDoCasoReal(naHora), desvioMs: -H };
  assert.equal((await fechar(useCaixaAntigo, o)).patch.total_dinheiro, 150, "hoje perde tudo depois do limite atrasado");
  const novo = await fechar(useCaixa, o);
  assert.equal(novo.patch.total_dinheiro, 200);
  assert.equal(novo.patch.data_fechamento, iso(FECHA));
});

Deno.test("aparelho 1h atrasado: a venda avulsa lançada antes de fechar entra na soma", async () => {
  const pdvAtrasado = (ms: number) => ms - H;
  const o = { tabelas: lojaDoCasoReal(pdvAtrasado), desvioMs: -H };
  assert.equal((await fechar(useCaixaAntigo, o)).patch.total_dinheiro, 70);
  assert.equal((await fechar(useCaixa, o)).patch.total_dinheiro, 100, "só a 1ª venda fica de fora até a Parte 1B");
});

Deno.test("aparelho 1h adiantado: soma correta e fechamento na hora do servidor", async () => {
  const pdvAdiantado = (ms: number) => ms + H;
  const o = { tabelas: lojaDoCasoReal(pdvAdiantado), desvioMs: H };
  const antigo = await fechar(useCaixaAntigo, o);
  const novo = await fechar(useCaixa, o);
  assert.equal(antigo.patch.data_fechamento, iso(FECHA + H));
  assert.equal(novo.patch.total_dinheiro, 200);
  assert.equal(novo.patch.data_fechamento, iso(FECHA));
});

Deno.test("vende em aparelho adiantado e fecha em aparelho certo: nada fica de fora", async () => {
  const o = { tabelas: lojaDoCasoReal((ms) => ms + H) };
  assert.equal((await fechar(useCaixaAntigo, o)).patch.total_dinheiro, 180);
  assert.equal((await fechar(useCaixa, o)).patch.total_dinheiro, 200);
});

Deno.test("OS: o fim da janela usa a data do servidor, não a do aparelho", async () => {
  const noite = Date.parse("2026-11-18T00:30:00.000Z");
  await fechar(useCaixa, { tabelas: lojaCompleta(), desvioMs: -H, agoraMs: noite });
  const os = servidor.consultas.find((c) => c.tabela === "ordens_servico")!;
  assert.deepEqual(os.filtros.find(([c, op]) => c === "data_caixa" && op === "lte"), ["data_caixa", "lte", "2026-11-18"]);
});

for (const rpc of ["ausente", "erro", "trava"] as const) {
  Deno.test(`função indisponível (${rpc}), relógio certo: igual a hoje e sem quebrar`, async () => {
    const o = { tabelas: lojaCompleta(), rpc };
    const novo = await fechar(useCaixa, o);
    assert.equal(novo.resultado, true);
    assert.deepEqual(novo.patch, (await fechar(useCaixaAntigo, o)).patch);
  });

  Deno.test(`função indisponível (${rpc}), aparelho atrasado: grava a hora do aparelho, como hoje`, async () => {
    const o = { tabelas: lojaCompleta(), rpc, desvioMs: -H };
    const novo = await fechar(useCaixa, o);
    assert.equal(novo.resultado, true);
    assert.equal(novo.patch.data_fechamento, iso(FECHA - H));
  });
}

Deno.test("sem gatilho nem função, data_fechamento nunca fica vazio", async () => {
  const novo = await fechar(useCaixa, { tabelas: lojaCompleta(), rpc: "ausente", gatilho: false });
  assert.equal(novo.linha.data_fechamento, iso(FECHA));
});

Deno.test("versão antiga do app com o gatilho: fecha, totais iguais e hora do servidor", async () => {
  const semGatilho = await fechar(useCaixaAntigo, { tabelas: lojaCompleta(), desvioMs: -H });
  const comGatilho = await fechar(useCaixaAntigo, { tabelas: lojaCompleta(), desvioMs: -H, gatilho: true });
  assert.equal(comGatilho.resultado, true);
  assert.equal(comGatilho.patch.data_fechamento, iso(FECHA - H), "a versão antiga ainda envia a hora do aparelho");
  assert.equal(comGatilho.linha.data_fechamento, iso(FECHA), "o gatilho grava a do servidor");
  assert.equal(soma4(comGatilho.patch), soma4(semGatilho.patch));
});

// ── Caixa fechado ───────────────────────────────────────────────────────────

const fechado = () => caixaAberto({ status: "fechado", data_fechamento: iso(ABRE + 8 * H), total_dinheiro: 500, total_vendas: 500, saldo_final: 600 });

Deno.test("limite da soma: só caixa aberto fica sem limite", () => {
  assert.equal(limiteSuperiorDaSoma({ status: "aberto", data_fechamento: null }, "agora"), null);
  assert.equal(limiteSuperiorDaSoma({ status: "fechado", data_fechamento: "fim" }, "agora"), "fim");
  assert.equal(limiteSuperiorDaSoma({ status: "fechado", data_fechamento: null }, "agora"), "agora");
  assert.equal(limiteSuperiorDaSoma(null, "agora"), "agora");
  assert.equal(limiteSuperiorDaSoma(undefined, "agora"), "agora");
});

Deno.test("caixa já fechado: a soma respeita data_fechamento e a venda posterior não entra", async () => {
  const tabelas = { caixas: [fechado()], vendas: [venda(ABRE + H, { total: 40 }), venda(FECHA + H, { total: 900 })], vendas_avulsas: [] };
  preparar({ tabelas, agoraMs: FECHA + 2 * H });
  const restaurar = instalarRelogio(() => 0);
  try {
    assert.equal(await useCaixa().estimarDinheiroNaGaveta("cx"), 140);
  } finally {
    restaurar();
  }
  for (const t of ["vendas", "vendas_avulsas"]) {
    const c = servidor.consultas.find((x) => x.tabela === t)!;
    assert.ok(c.filtros.some(([, op, v]) => op === "lte" && v === iso(FECHA)), `${t} sem limite`);
  }
});

Deno.test("caixa aberto: vendas e avulsas são lidas sem limite superior", async () => {
  await fechar(useCaixa, { tabelas: lojaCompleta() });
  for (const t of ["vendas", "vendas_avulsas"]) {
    assert.ok(!servidor.consultas.find((x) => x.tabela === t)!.filtros.some(([, op]) => op === "lte"));
  }
});

Deno.test("fechar de novo um caixa já fechado: recusa e não grava nada", async () => {
  const antes = fechado();
  const o = { tabelas: { caixas: [antes], vendas: [venda(FECHA + H, { total: 900 })], vendas_avulsas: [] }, agoraMs: FECHA + 2 * H };
  await assert.rejects(() => fechar(useCaixa, o), /jaFechado/);
  assert.equal(servidor.escritas.length, 0);
  assert.deepEqual(servidor.tabelas.caixas[0], antes);
});

Deno.test("fechado em outro aparelho no meio da conta: não sobrescreve", async () => {
  const outro = fechado();
  preparar({ tabelas: { ...lojaCompleta(), caixas: [caixaAberto()] } });
  servidor.antesDeAtualizar = () => Object.assign(servidor.tabelas.caixas[0], outro);
  const restaurar = instalarRelogio(() => 0);
  try {
    await assert.rejects(() => useCaixa().fecharCaixa("cx"), /jaFechado/);
  } finally {
    restaurar();
  }
  assert.equal(servidor.escritas[0].afetadas, 0);
  assert.deepEqual(servidor.tabelas.caixas[0], outro);
});

Deno.test("fechar só altera o próprio caixa: outros caixas, saldo e vendas ficam intactos", async () => {
  const velho = { ...fechado(), id: "velho" };
  const base = { ...lojaCompleta(), caixas: [caixaAberto(), velho] };
  const novo = await fechar(useCaixa, { tabelas: base }, 250);
  assert.equal(novo.escritas.length, 1);
  assert.equal(novo.escritas[0].tabela, "caixas");
  assert.equal(novo.escritas[0].afetadas, 1);
  assert.deepEqual(servidor.tabelas.caixas[1], velho);
  for (const t of ["vendas", "vendas_avulsas", "ordens_servico", "contas", "caixa_movimentacoes", "vendas_trocas"]) {
    assert.deepEqual(servidor.tabelas[t], (base as Record<string, unknown>)[t]);
  }
  assert.equal(novo.linha.saldo_final, 250);
});

Deno.test("prévia: as três leituras usam a mesma janela do fechamento", () => {
  const src = Deno.readTextFileSync(new URL("../../src/components/pdv/DialogFechamentoCaixa.tsx", import.meta.url));
  assert.ok(!src.includes('.lte("data", new Date()'));
  assert.ok(!src.includes('.lte("created_at", new Date()'));
  assert.ok(!src.includes("const janelaFimISO = new Date()"));
  assert.ok(src.includes('if (limiteSoma) query = query.lte("data", limiteSoma);'));
  assert.ok(src.includes('vendasAvulsasQuery.lte("created_at", limiteSoma)'));
  assert.ok(src.includes("const janelaFimISO = limiteSoma ?? agoraISO;"));
  assert.ok(src.includes("limiteSuperiorDaSoma(caixaNoBanco, agoraISO)"), "status lido do banco");
});
