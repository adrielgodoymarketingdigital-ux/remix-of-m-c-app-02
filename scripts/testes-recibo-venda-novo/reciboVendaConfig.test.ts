// deno test -A --no-check scripts/testes-recibo-venda-novo/
// Personalização do recibo de venda (src/lib/vendas/reciboVendaConfig.ts) e o
// efeito dela em montarReciboVenda. Dados 100% fictícios (cenários da página
// de teste do recibo novo).
//
// fixtures/modelos-cenarios-a38474c.json = modelos de todos os CENARIOS gerados
// com o reciboVendaModelo.ts da origin/main a38474c, ANTES desta mudança: é o
// "recibo de hoje".
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { CENARIOS } from "../../src/dev/reciboVendaNovo/cenarios.ts";
import {
  CAMPOS_TEXTO_RECIBO_VENDA,
  ehReciboVendaConfigPadrao,
  INTERRUPTORES_RECIBO_VENDA,
  type InterruptorReciboVenda,
  LIMITES_TEXTOS_RECIBO_VENDA,
  limparTextoRecibo,
  normalizarReciboVendaConfig,
  RECIBO_VENDA_CONFIG_PADRAO,
  reciboVendaConfigPadrao,
} from "../../src/lib/vendas/reciboVendaConfig.ts";
import { montarReciboVenda, type ReciboVendaModelo } from "../../src/lib/vendas/reciboVendaModelo.ts";

const HOJE: Record<string, unknown> = JSON.parse(
  Deno.readTextFileSync(new URL("./fixtures/modelos-cenarios-a38474c.json", import.meta.url)),
);
const json = (v: unknown) => JSON.parse(JSON.stringify(v));
const desligado = (k: InterruptorReciboVenda) => ({ mostrar: { [k]: false } });
const tudoDesligado = () => ({ mostrar: Object.fromEntries(INTERRUPTORES_RECIBO_VENDA.map((k) => [k, false])) });

/** Cenário com cada coisa que um interruptor esconde (para o teste não passar no vazio). */
const COMPLETO = (() => {
  const c = CENARIOS.find((x) => x.id === "modelo");
  assert(c, "cenário 'modelo' sumiu");
  return c;
})();

// ── Recibo de hoje ──────────────────────────────────────────────────────────

Deno.test("fixture cobre todos os CENARIOS", () => {
  assertEquals(Object.keys(HOJE).sort(), CENARIOS.map((c) => c.id).sort());
  assert(CENARIOS.length >= 8);
});

for (const c of CENARIOS) {
  Deno.test(`'${c.id}': sem config = null = {} = padrão = igual ao recibo de hoje`, () => {
    const sem = montarReciboVenda(c.entrada);
    assertEquals(json(sem), HOJE[c.id], "sem config difere do recibo de hoje (a38474c)");
    for (const cfg of [undefined, null, {}, RECIBO_VENDA_CONFIG_PADRAO, reciboVendaConfigPadrao(), { versao: 1 }, { mostrar: {}, textos: {} }]) {
      const m = montarReciboVenda(c.entrada, cfg);
      assertEquals(m, sem, `config ${JSON.stringify(cfg)}`);
      assert(!("textos" in m), "sem texto não pode criar a chave textos");
    }
  });
}

Deno.test("padrão: todos os interruptores ligados e todos os textos vazios", () => {
  for (const k of INTERRUPTORES_RECIBO_VENDA) assertEquals(RECIBO_VENDA_CONFIG_PADRAO.mostrar[k], true, k);
  for (const k of CAMPOS_TEXTO_RECIBO_VENDA) assertEquals(RECIBO_VENDA_CONFIG_PADRAO.textos[k], "", k);
  assertEquals(RECIBO_VENDA_CONFIG_PADRAO.versao, 1);
  assert(Object.isFrozen(RECIBO_VENDA_CONFIG_PADRAO) && Object.isFrozen(RECIBO_VENDA_CONFIG_PADRAO.mostrar));
  assertEquals(LIMITES_TEXTOS_RECIBO_VENDA, {
    topo: { caracteres: 300, linhas: 4 },
    agradecimento: { caracteres: 120, linhas: 1 },
    frase_rodape: { caracteres: 200, linhas: 2 },
    observacoes: { caracteres: 1500, linhas: 20 },
    politica_troca: { caracteres: 1500, linhas: 20 },
  });
});

Deno.test("itens que nunca se escondem não existem como interruptor", () => {
  const proibidos = ["numero", "data", "itens", "total", "forma_pagamento", "pagamento", "cancelada", "situacao", "quantidade"];
  for (const p of proibidos) assert(!(INTERRUPTORES_RECIBO_VENDA as readonly string[]).includes(p), p);
});

// ── Normalização ────────────────────────────────────────────────────────────

Deno.test("entrada lixo cai no padrão", () => {
  const lixos: unknown[] = [
    undefined, null, "", "texto", 0, 42, NaN, true, false, [], [1, 2], () => 1, new Date(), Symbol("x"),
    { versao: 2, mostrar: { qr: false } }, // versão futura
    { versao: "1", mostrar: { qr: false } }, // versão de tipo errado
    { versao: null, mostrar: { qr: false } },
    { mostrar: "qr", textos: ["oi"] },
    { mostrar: [false, false], textos: 5 },
    Object.create({ mostrar: { qr: false } }), // não é objeto simples
  ];
  for (const l of lixos) {
    const cfg = normalizarReciboVendaConfig(l);
    assertEquals(cfg, reciboVendaConfigPadrao(), String(l));
    assert(ehReciboVendaConfigPadrao(cfg));
  }
});

Deno.test("parcial e tipos errados: só false exato desliga; texto só se for string", () => {
  const cfg = normalizarReciboVendaConfig({
    mostrar: { qr: false, logo: "false", vendedor: 0, troca: null, garantias: undefined, assinaturas: false, inexistente: false },
    textos: { topo: "  Olá  ", agradecimento: 123, observacoes: { a: 1 }, desconhecido: "x" },
    extra: "ignorado",
  });
  assertEquals(cfg.mostrar.qr, false);
  assertEquals(cfg.mostrar.assinaturas, false);
  for (const k of ["logo", "vendedor", "troca", "garantias"] as const) assertEquals(cfg.mostrar[k], true, k);
  assertEquals(cfg.textos, { topo: "Olá", agradecimento: "", frase_rodape: "", observacoes: "", politica_troca: "" });
  assert(!("inexistente" in cfg.mostrar) && !("extra" in cfg) && !("desconhecido" in cfg.textos));
});

Deno.test("normalizar não altera a entrada nem o padrão", () => {
  const entrada = { mostrar: { qr: false }, textos: { topo: " a " } };
  const copia = structuredClone(entrada);
  const cfg = normalizarReciboVendaConfig(entrada);
  cfg.mostrar.logo = false;
  assertEquals(entrada, copia);
  assertEquals(RECIBO_VENDA_CONFIG_PADRAO.mostrar.logo, true);
  assertEquals(normalizarReciboVendaConfig(null).mostrar.logo, true);
});

Deno.test("textos salvos acima do limite são cortados ao normalizar", () => {
  const cfg = normalizarReciboVendaConfig({
    textos: {
      topo: "a".repeat(1000),
      agradecimento: "linha 1\nlinha 2",
      frase_rodape: "1\n2\n3",
      observacoes: Array.from({ length: 30 }, (_, i) => `obs ${i + 1}`).join("\n"),
      politica_troca: "p".repeat(5000),
    },
  });
  assertEquals(cfg.textos.topo.length, 300);
  assertEquals(cfg.textos.agradecimento, "linha 1");
  assertEquals(cfg.textos.frase_rodape, "1\n2");
  assertEquals(cfg.textos.observacoes.split("\n").length, 20);
  assertEquals(cfg.textos.politica_troca.length, 1500);
});

// ── Limpeza de texto ────────────────────────────────────────────────────────

Deno.test("limparTextoRecibo: quebras, controles, espaços e linhas em branco", () => {
  assertEquals(limparTextoRecibo("a\r\nb\rc\u2028d\u2029e", 100, 10), "a\nb\nc\nd\ne");
  assertEquals(limparTextoRecibo("a\u0000b\u0007c\u001Bd\u007Fe\u200Ef\u202Eg\uFEFFh", 100, 10), "abcdefgh");
  assertEquals(limparTextoRecibo("a\tb", 100, 10), "a b");
  assertEquals(limparTextoRecibo("   olá    mundo   ", 100, 10), "olá mundo");
  assertEquals(limparTextoRecibo("\n\n  \ntopo\n\n\n\n\nmeio\n \n\t\nfim\n\n\n", 100, 10), "topo\n\nmeio\n\nfim");
  assertEquals(limparTextoRecibo("   \n\n\t ", 100, 10), "");
});

Deno.test("limparTextoRecibo: limites de caracteres e de linhas", () => {
  assertEquals(limparTextoRecibo("abcdef", 3, 5), "abc");
  assertEquals(limparTextoRecibo("abc def", 4, 5), "abc", "corte não deixa espaço no fim");
  assertEquals(limparTextoRecibo("1\n2\n3\n4\n5", 100, 3), "1\n2\n3");
  assertEquals(limparTextoRecibo("1\n\n2", 100, 2), "1", "linha em branco conta como linha e não sobra no fim");
  assertEquals(limparTextoRecibo("ab\ncd", 4, 5), "ab\nc", "quebra de linha conta como caractere");
  assertEquals(limparTextoRecibo("ação", 3, 1), "açã");
  assertEquals(limparTextoRecibo("👍🏽👍🏽👍🏽", 2, 1), "👍🏽👍🏽", "emoji com modificador não é partido");
  assertEquals(limparTextoRecibo("ok", 0, 5), "");
  assertEquals(limparTextoRecibo("ok", 5, 0), "");
  assertEquals(limparTextoRecibo("ok", NaN, 5), "");
});

Deno.test("limparTextoRecibo: não-texto vira vazio", () => {
  for (const v of [null, undefined, 1, true, {}, [], ["a"]]) assertEquals(limparTextoRecibo(v, 100, 10), "");
});

Deno.test("texto com HTML, script, ${} e {{x}} sai como texto inerte (nada é interpretado)", () => {
  const perigosos = [
    "<script>alert(1)</script>",
    '<img src=x onerror="alert(1)">',
    "${alert(1)} `${1+1}`",
    "{{cliente}} {{loja}} {{x}}",
    "javascript:alert(1)",
    "&lt;b&gt; &amp; <b>negrito</b>",
  ];
  for (const p of perigosos) {
    assertEquals(limparTextoRecibo(p, 500, 5), p, p);
    const cfg = normalizarReciboVendaConfig({ textos: { topo: p, observacoes: p, politica_troca: p, agradecimento: p, frase_rodape: p } });
    const m = montarReciboVenda(COMPLETO.entrada, cfg);
    assertEquals(m.textos, { topo: p, observacoes: p, politicaTroca: p });
    assertEquals(m.rodape?.agradecimento, p);
    assertEquals(m.rodape?.frase, p);
  }
});

// ── Interruptores no modelo ─────────────────────────────────────────────────

/** Caminho (no modelo) de cada coisa que o interruptor esconde, e o valor esperado quando desligado. */
function efeito(k: InterruptorReciboVenda, m: ReciboVendaModelo): unknown {
  switch (k) {
    case "logo": return m.cabecalho.logoUrl;
    case "contatos_cabecalho": return m.cabecalho.contatos;
    case "qr": return m.qr;
    case "cliente_cpf": return m.cliente.cpf;
    case "cliente_telefone": return m.cliente.telefone;
    case "cliente_endereco": return m.cliente.endereco;
    case "loja_cnpj": return m.loja.cnpj;
    case "vendedor": return [m.vendedor, m.assinaturas?.vendedor];
    case "fotos_itens": return [m.itens.map((i) => i.fotoUrl), m.mostrarFotoItens];
    case "detalhes_aparelho": return m.itens.filter((i) => i.etiqueta).map((i) => i.detalhes);
    case "valor_unitario": return m.itens.map((i) => i.valorUnitario);
    case "descontos": return m.resumo.filter((l) => l.negativo);
    case "troca": return m.troca;
    case "parcelas": return m.pagamento.formas.map((f) => f.parcelas);
    case "garantias": return m.garantias;
    case "assinaturas": return m.assinaturas;
    case "rodape": return m.rodape;
  }
}

function esperadoDesligado(k: InterruptorReciboVenda, m: ReciboVendaModelo): unknown {
  switch (k) {
    case "logo": case "qr": case "cliente_cpf": case "cliente_telefone": case "cliente_endereco":
    case "loja_cnpj": case "troca": case "assinaturas": case "rodape":
      return null;
    case "contatos_cabecalho": case "descontos": case "garantias":
      return [];
    case "vendedor": return [null, m.loja.nome];
    case "fotos_itens": return [m.itens.map(() => null), false];
    case "detalhes_aparelho": return m.itens.filter((i) => i.etiqueta).map(() => []);
    case "valor_unitario": return m.itens.map(() => null);
    case "parcelas": return m.pagamento.formas.map(() => []);
  }
}

/** Remove do modelo tudo o que o interruptor k pode mexer (para comparar o resto). */
function semEfeito(k: InterruptorReciboVenda, m: ReciboVendaModelo) {
  const c = structuredClone(m) as ReciboVendaModelo;
  const zera = (o: Record<string, unknown>, ...ch: string[]) => ch.forEach((x) => (o[x] = "*"));
  switch (k) {
    case "logo": zera(c.cabecalho as never, "logoUrl"); break;
    case "contatos_cabecalho": zera(c.cabecalho as never, "contatos"); break;
    case "qr": zera(c as never, "qr"); break;
    case "cliente_cpf": zera(c.cliente as never, "cpf"); break;
    case "cliente_telefone": zera(c.cliente as never, "telefone"); break;
    case "cliente_endereco": zera(c.cliente as never, "endereco"); break;
    case "loja_cnpj": zera(c.loja as never, "cnpj"); break;
    case "vendedor": zera(c as never, "vendedor"); if (c.assinaturas) zera(c.assinaturas as never, "vendedor"); break;
    case "fotos_itens": c.itens.forEach((i) => zera(i as never, "fotoUrl")); zera(c as never, "mostrarFotoItens"); break;
    case "detalhes_aparelho": c.itens.filter((i) => i.etiqueta).forEach((i) => zera(i as never, "detalhes")); break;
    case "valor_unitario": c.itens.forEach((i) => zera(i as never, "valorUnitario")); break;
    case "descontos": c.resumo = c.resumo.filter((l) => !l.negativo); break;
    case "troca": zera(c as never, "troca"); break;
    case "parcelas": c.pagamento.formas.forEach((f) => zera(f as never, "parcelas")); break;
    case "garantias": zera(c as never, "garantias"); break;
    case "assinaturas": zera(c as never, "assinaturas"); break;
    case "rodape": zera(c as never, "rodape"); break;
  }
  return c;
}

Deno.test("o cenário de prova tem algo para cada interruptor esconder", () => {
  const m = montarReciboVenda(COMPLETO.entrada);
  for (const k of INTERRUPTORES_RECIBO_VENDA) {
    // Algum cenário precisa mostrar algo diferente do "desligado" (senão o teste passaria no vazio).
    const algum = CENARIOS.some((c) => {
      const mc = montarReciboVenda(c.entrada);
      return JSON.stringify(efeito(k, mc)) !== JSON.stringify(esperadoDesligado(k, mc));
    });
    assert(algum, `nenhum cenário tem '${k}' para esconder`);
  }
  assert(m.itens.length > 0);
});

for (const k of INTERRUPTORES_RECIBO_VENDA) {
  Deno.test(`interruptor '${k}' desligado esconde só o seu campo, em todos os cenários`, () => {
    for (const c of CENARIOS) {
      const antes = montarReciboVenda(c.entrada);
      const depois = montarReciboVenda(c.entrada, desligado(k));
      assertEquals(efeito(k, depois), esperadoDesligado(k, antes), `${c.id}: ${k}`);
      assertEquals(semEfeito(k, depois), semEfeito(k, antes), `${c.id}: '${k}' mexeu em outra coisa`);
      assertEquals(montarReciboVenda(c.entrada), antes, "montar não pode alterar a entrada");
    }
  });
}

Deno.test("descontos desligados: o total continua líquido e o subtotal fica", () => {
  const c = CENARIOS.find((x) => montarReciboVenda(x.entrada).resumo.some((l) => l.negativo));
  assert(c, "nenhum cenário com desconto");
  const antes = montarReciboVenda(c.entrada);
  const depois = montarReciboVenda(c.entrada, desligado("descontos"));
  assertEquals(depois.faixaTotal, antes.faixaTotal);
  assertEquals(depois.resumo, [antes.resumo[0]]);
  assertEquals(depois.resumo[0].rotulo, "Subtotal");
});

Deno.test("detalhes do aparelho desligados: produto e peça continuam com o SKU", () => {
  for (const c of CENARIOS) {
    const antes = montarReciboVenda(c.entrada);
    const depois = montarReciboVenda(c.entrada, desligado("detalhes_aparelho"));
    antes.itens.forEach((i, n) => {
      if (!i.etiqueta) assertEquals(depois.itens[n].detalhes, i.detalhes, `${c.id} item ${n + 1}`);
    });
  }
});

Deno.test("nunca se escondem: número, data, itens (nome/qtd/total), total, forma de pagamento e selo CANCELADA", () => {
  for (const c of CENARIOS) {
    const antes = montarReciboVenda(c.entrada);
    const depois = montarReciboVenda(c.entrada, tudoDesligado());
    assertEquals(depois.titulo, antes.titulo, c.id);
    assert(depois.titulo.dataHora, `${c.id}: data`);
    assertEquals(depois.situacao, antes.situacao, c.id);
    assertEquals(depois.faixaTotal, antes.faixaTotal, c.id);
    assertEquals(depois.tituloItens, antes.tituloItens, c.id);
    assertEquals(depois.itens.map((i) => [i.numero, i.nome, i.quantidade, i.total, i.etiqueta]), antes.itens.map((i) => [i.numero, i.nome, i.quantidade, i.total, i.etiqueta]), c.id);
    assertEquals(depois.pagamento.formas.map((f) => [f.nome, f.valor, f.detalhe, f.tom]), antes.pagamento.formas.map((f) => [f.nome, f.valor, f.detalhe, f.tom]), c.id);
    assertEquals(depois.pagamento.observacao, antes.pagamento.observacao, c.id);
    assertEquals(depois.cliente.nome, antes.cliente.nome, c.id);
    assertEquals(depois.cabecalho.nomeLoja, antes.cabecalho.nomeLoja, c.id);
    assertEquals(depois.loja.nome, antes.loja.nome, c.id);
    assert(depois.titulo.numero, `${c.id}: número`);
  }
  const cancelada = CENARIOS.find((c) => c.id === "cancelada");
  assert(cancelada, "cenário 'cancelada' sumiu");
  const m = montarReciboVenda(cancelada.entrada, tudoDesligado());
  assertEquals(m.situacao.tipo, "cancelada");
  assertEquals(m.situacao.rotulo, "VENDA CANCELADA");
  assert(m.faixaTotal.cancelada);
});

// ── Textos no modelo ────────────────────────────────────────────────────────

Deno.test("agradecimento e frase do rodapé só trocam quando preenchidos", () => {
  const antes = montarReciboVenda(COMPLETO.entrada);
  const so1 = montarReciboVenda(COMPLETO.entrada, { textos: { agradecimento: "Valeu, volte sempre!" } });
  assertEquals(so1.rodape?.agradecimento, "Valeu, volte sempre!");
  assertEquals(so1.rodape?.frase, antes.rodape?.frase);
  assertEquals(so1.rodape?.contatos, antes.rodape?.contatos);
  assert(!("textos" in so1), "agradecimento não é bloco novo");
  const so2 = montarReciboVenda(COMPLETO.entrada, { textos: { frase_rodape: "Fale com a gente." } });
  assertEquals(so2.rodape?.agradecimento, antes.rodape?.agradecimento);
  assertEquals(so2.rodape?.frase, "Fale com a gente.");
  const vazios = montarReciboVenda(COMPLETO.entrada, { textos: { agradecimento: "   ", frase_rodape: "\n\n" } });
  assertEquals(vazios, antes);
  const semRodape = montarReciboVenda(COMPLETO.entrada, { mostrar: { rodape: false }, textos: { agradecimento: "x" } });
  assertEquals(semRodape.rodape, null);
});

Deno.test("blocos novos vão para modelo.textos; o resto do recibo não muda", () => {
  const antes = montarReciboVenda(COMPLETO.entrada);
  const m = montarReciboVenda(COMPLETO.entrada, {
    versao: 1,
    textos: { topo: "  Aviso\r\n\r\n\r\nimportante ", observacoes: "Obs 1\nObs 2", politica_troca: "Troca em 7 dias." },
  });
  assertEquals(m.textos, { topo: "Aviso\n\nimportante", observacoes: "Obs 1\nObs 2", politicaTroca: "Troca em 7 dias." });
  const { textos: _t, ...resto } = m;
  assertEquals(resto, antes);
  const so = montarReciboVenda(COMPLETO.entrada, { textos: { observacoes: "só obs" } });
  assertEquals(so.textos, { topo: null, observacoes: "só obs", politicaTroca: null });
});

Deno.test("config com tudo mudado continua diferente do padrão (sanidade)", () => {
  const cfg = normalizarReciboVendaConfig({ ...tudoDesligado(), textos: { topo: "x" } });
  assert(!ehReciboVendaConfigPadrao(cfg));
  assertNotEquals(montarReciboVenda(COMPLETO.entrada, cfg), montarReciboVenda(COMPLETO.entrada));
});

// ── Fase 4: cupom some junto com os descontos ───────────────────────────────

Deno.test("fase 4: descontos desligados tiram desconto E cupom; subtotal fica; total continua líquido", () => {
  const cenario = CENARIOS.find((c) => c.id === "desconto")!;
  const antes = montarReciboVenda(cenario.entrada);
  assertEquals(antes.resumo.map((l) => l.rotulo), ["Subtotal", "Desconto", "Cupom (BEMVINDO)"]);
  const depois = montarReciboVenda(cenario.entrada, { mostrar: { descontos: false } });
  assertEquals(depois.resumo, [antes.resumo[0]]);
  assertEquals(depois.faixaTotal, antes.faixaTotal);
  assertEquals(depois.pagamento, antes.pagamento);
  assertEquals(depois.itens, antes.itens);
});

Deno.test("fase 4: com descontos desligados nenhuma linha que não seja desconto/cupom some, em todos os cenários", () => {
  for (const c of CENARIOS) {
    const antes = montarReciboVenda(c.entrada);
    const depois = montarReciboVenda(c.entrada, { mostrar: { descontos: false } });
    const esperado = antes.resumo.filter((l) => !(l.rotulo === "Desconto" || l.rotulo.startsWith("Cupom")));
    assertEquals(depois.resumo, esperado, c.id);
    assertEquals(depois.faixaTotal, antes.faixaTotal, c.id);
  }
});

Deno.test("fase 4: só cupom (sem desconto manual) também some", () => {
  const cenario = CENARIOS.find((c) => c.id === "desconto")!;
  const soCupom = { ...cenario.entrada, descontoManual: 0 };
  const antes = montarReciboVenda(soCupom);
  assertEquals(antes.resumo.map((l) => l.rotulo), ["Subtotal", "Cupom (BEMVINDO)"]);
  assertEquals(montarReciboVenda(soCupom, { mostrar: { descontos: false } }).resumo.map((l) => l.rotulo), ["Subtotal"]);
});
