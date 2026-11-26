// deno test -A --no-check --no-lock src/lib/assinatura/bloqueioLimiteProdutos.test.ts
// Bug: usuário em teste grátis (ilimitado) via "6 / 3 utilizados" porque o contador
// era calculado antes de a assinatura carregar e nunca era recalculado.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deveBloquearNovoProduto } from "./bloqueioLimiteProdutos.ts";

const base = { assinaturaCarregando: false, planoTipo: "free", ilimitado: false };

test("assinatura carregando nunca bloqueia (mesmo com contador velho 6/3)", () => {
  assert.equal(deveBloquearNovoProduto({ ...base, assinaturaCarregando: true, usados: 6, limite: 3 }), false);
  assert.equal(deveBloquearNovoProduto({ ...base, assinaturaCarregando: true, usados: 99, limite: 3 }), false);
});

test("trial ilimitado com 6 produtos não bloqueia", () => {
  assert.equal(deveBloquearNovoProduto({ ...base, ilimitado: true, usados: 6, limite: -1 }), false);
});

test("Free de verdade com 3/3 bloqueia", () => {
  assert.equal(deveBloquearNovoProduto({ ...base, usados: 3, limite: 3 }), true);
});

test("Free de verdade acima do limite (6/3) bloqueia", () => {
  assert.equal(deveBloquearNovoProduto({ ...base, usados: 6, limite: 3 }), true);
});

test("Free antigo 10/10 bloqueia", () => {
  assert.equal(deveBloquearNovoProduto({ ...base, usados: 10, limite: 10 }), true);
});

test("Free 2/3 não bloqueia", () => {
  assert.equal(deveBloquearNovoProduto({ ...base, usados: 2, limite: 3 }), false);
});

test("plano pago nunca bloqueia nesta tela", () => {
  assert.equal(deveBloquearNovoProduto({ ...base, planoTipo: "basico_mensal", usados: 50, limite: 3 }), false);
});

test("sem assinatura (null) não bloqueia, como antes", () => {
  assert.equal(deveBloquearNovoProduto({ ...base, planoTipo: null, usados: 6, limite: 3 }), false);
});

test("contagem que falhou (limite 0) não bloqueia", () => {
  assert.equal(deveBloquearNovoProduto({ ...base, usados: 0, limite: 0 }), false);
});

// Cenário do bug, modelado com a mesma sequência da página Produtos.tsx:
// 1) página monta com a assinatura carregando → limites Free provisórios (3);
// 2) a contagem com esses limites volta { usados: 6, limite: 3, ilimitado: false };
// 3) a assinatura chega (free + trial ativo) → limites.produtos_mes = -1, nova contagem;
// 4) clique em "Novo produto" conta de novo NA HORA e decide.
// Inclui a resposta velha chegando DEPOIS da nova (a página ignora pela sequência).
test("cenário: assinatura chega depois do primeiro cálculo → recalcula e não bloqueia o trial com 6 produtos", async () => {
  const usadosNoMes = 6;
  const contar = (limiteProdutosMes: number, atrasoMs: number) =>
    new Promise<{ usados: number; limite: number; ilimitado: boolean }>((ok) =>
      setTimeout(() => ok({ usados: usadosNoMes, limite: limiteProdutosMes, ilimitado: limiteProdutosMes === -1 }), atrasoMs));

  // Mesmo mecanismo de carregarContador (contadorSeqRef) da página.
  let seqAtual = 0;
  let contador = { usados: 0, limite: -1, ilimitado: true };
  const carregarContador = async (limiteProdutosMes: number, atrasoMs: number) => {
    const seq = ++seqAtual;
    const dados = await contar(limiteProdutosMes, atrasoMs);
    if (seq === seqAtual) contador = dados;
    return dados;
  };

  // 1+2: montagem com limites provisórios (lenta); 3: assinatura chegou (rápida).
  const provisoria = carregarContador(3, 20);
  const doTrial = carregarContador(-1, 1);
  await Promise.all([provisoria, doTrial]);
  assert.deepEqual(contador, { usados: 6, limite: -1, ilimitado: true }, "a contagem velha não pode sobrescrever a do trial");

  // Como era antes: decidir pelo state calculado só na montagem bloqueava.
  const stateVelho = { usados: 6, limite: 3, ilimitado: false };
  assert.equal(deveBloquearNovoProduto({ assinaturaCarregando: false, planoTipo: "free", ...stateVelho }), true);

  // 4: clique conta na hora com os limites atuais (trial) → não bloqueia.
  const naHora = await carregarContador(-1, 1);
  assert.equal(deveBloquearNovoProduto({ assinaturaCarregando: false, planoTipo: "free", ...naHora }), false);

  // E o Free de verdade (teste vencido) com os mesmos 6 continua bloqueado.
  const freeVencido = await carregarContador(3, 1);
  assert.equal(deveBloquearNovoProduto({ assinaturaCarregando: false, planoTipo: "free", ...freeVencido }), true);
});
