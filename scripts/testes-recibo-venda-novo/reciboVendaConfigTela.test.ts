// Fase 3: lógica da tela "Personalizar recibo de venda" (agrupamento,
// contadores, alterações, prévia), venda de exemplo e textos pt-BR/es.
// Rodar: deno test -A --no-check scripts/testes-recibo-venda-novo/
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  contarTextoRecibo,
  GRUPOS_INTERRUPTORES_RECIBO_VENDA,
  haAlteracoesReciboVendaConfig,
  itensForaDaPrevia,
  modeloDesenhavelNaPrevia,
  rascunhoEhPadraoReciboVenda,
  SEMPRE_APARECE_RECIBO_VENDA,
  textosPassandoDoLimite,
} from "../../src/lib/vendas/reciboVendaConfigTela.ts";
import {
  CAMPOS_TEXTO_RECIBO_VENDA,
  INTERRUPTORES_RECIBO_VENDA,
  LIMITES_TEXTOS_RECIBO_VENDA,
  normalizarReciboVendaConfig,
  RECIBO_VENDA_CONFIG_PADRAO,
  reciboVendaConfigPadrao,
} from "../../src/lib/vendas/reciboVendaConfig.ts";
import { MENSAGENS_PERMISSAO_CONFIG_RECIBO } from "../../src/lib/vendas/reciboVendaConfigGravacao.ts";
import { entradaExemploRecibo, EXEMPLOS_RECIBO_VENDA, LOJA_EXEMPLO } from "../../src/lib/vendas/reciboVendaExemplo.ts";
import { montarReciboVenda } from "../../src/lib/vendas/reciboVendaModelo.ts";
import configuracoesPtBR from "../../src/locales/pt-BR/configuracoes.ts";
import configuracoesEs from "../../src/locales/es/configuracoes.ts";

const tudoDesligado = () => {
  const c = reciboVendaConfigPadrao();
  for (const k of INTERRUPTORES_RECIBO_VENDA) c.mostrar[k] = false;
  return c;
};

// ── Agrupamento ─────────────────────────────────────────────────────────────

Deno.test("grupos: os 17 interruptores aparecem uma vez cada, na ordem dos grupos da tela", () => {
  const todos = GRUPOS_INTERRUPTORES_RECIBO_VENDA.flatMap((g) => g.interruptores);
  assertEquals(todos.length, 17);
  assertEquals(new Set(todos).size, 17);
  assertEquals([...todos].sort(), [...INTERRUPTORES_RECIBO_VENDA].sort());
  assertEquals(GRUPOS_INTERRUPTORES_RECIBO_VENDA.map((g) => g.id), ["cabecalho", "cliente", "itens", "valores", "garantiaAssinaturas", "rodape"]);
  for (const g of GRUPOS_INTERRUPTORES_RECIBO_VENDA) assert(g.interruptores.length > 0, g.id);
});

Deno.test("grupos: cada interruptor no grupo certo", () => {
  const grupoDe = Object.fromEntries(GRUPOS_INTERRUPTORES_RECIBO_VENDA.flatMap((g) => g.interruptores.map((k) => [k, g.id])));
  assertEquals(grupoDe.logo, "cabecalho");
  assertEquals(grupoDe.qr, "cabecalho");
  assertEquals(grupoDe.cliente_cpf, "cliente");
  assertEquals(grupoDe.fotos_itens, "itens");
  assertEquals(grupoDe.descontos, "valores");
  assertEquals(grupoDe.parcelas, "valores");
  assertEquals(grupoDe.assinaturas, "garantiaAssinaturas");
  assertEquals(grupoDe.vendedor, "garantiaAssinaturas");
  assertEquals(grupoDe.rodape, "rodape");
});

Deno.test("sempre aparece: 5 itens, nenhum é interruptor", () => {
  assertEquals([...SEMPRE_APARECE_RECIBO_VENDA], ["numeroData", "itens", "total", "formaPagamento", "seloCancelada"]);
  for (const k of SEMPRE_APARECE_RECIBO_VENDA) assertFalse((INTERRUPTORES_RECIBO_VENDA as readonly string[]).includes(k));
});

// ── Contadores ──────────────────────────────────────────────────────────────

Deno.test("contador: vazio e não-texto = 0 caracteres e 0 linhas, com os limites da fase 1", () => {
  for (const campo of CAMPOS_TEXTO_RECIBO_VENDA) {
    for (const v of ["", "   \n\n  ", null, undefined, 42]) {
      const c = contarTextoRecibo(campo, v);
      assertEquals([c.caracteres, c.linhas, c.passou], [0, 0, false], `${campo} ${String(v)}`);
      assertEquals(c.maxCaracteres, LIMITES_TEXTOS_RECIBO_VENDA[campo].caracteres);
      assertEquals(c.maxLinhas, LIMITES_TEXTOS_RECIBO_VENDA[campo].linhas);
    }
  }
});

Deno.test("contador: conta o texto limpo (espaços e linhas em branco a mais não contam)", () => {
  const c = contarTextoRecibo("observacoes", "  Troca   em 7 dias \r\n\r\n\r\n\r\n  Sem caixa, sem troca  ");
  assertEquals(c.caracteres, "Troca em 7 dias\n\nSem caixa, sem troca".length);
  assertEquals(c.linhas, 3);
  assertFalse(c.passou);
});

Deno.test("contador: emoji composto e acento contam 1 caractere visível", () => {
  assertEquals(contarTextoRecibo("topo", "\u{1F468}‍\u{1F469}‍\u{1F467}").caracteres, 1);
  assertEquals(contarTextoRecibo("topo", "é").caracteres, 1);
  assertEquals(contarTextoRecibo("topo", "Olá 👋🏽").caracteres, 5);
});

Deno.test("contador: no limite não passou; um a mais passou (caracteres e linhas)", () => {
  for (const campo of CAMPOS_TEXTO_RECIBO_VENDA) {
    const { caracteres, linhas } = LIMITES_TEXTOS_RECIBO_VENDA[campo];
    assertFalse(contarTextoRecibo(campo, "a".repeat(caracteres)).passou, campo);
    const c1 = contarTextoRecibo(campo, "a".repeat(caracteres + 1));
    assert(c1.passouCaracteres && c1.passou, campo);
    assertFalse(contarTextoRecibo(campo, Array(linhas).fill("x").join("\n")).passouLinhas, campo);
    const c2 = contarTextoRecibo(campo, Array(linhas + 1).fill("x").join("\n"));
    assert(c2.passouLinhas && c2.passou, campo);
  }
});

Deno.test("textosPassandoDoLimite: lista só os campos acima do limite; lixo = nenhum", () => {
  const r = reciboVendaConfigPadrao();
  r.textos.topo = "a".repeat(301);
  r.textos.agradecimento = "linha 1\nlinha 2";
  r.textos.observacoes = "ok";
  assertEquals(textosPassandoDoLimite(r), ["topo", "agradecimento"]);
  assertEquals(textosPassandoDoLimite(reciboVendaConfigPadrao()), []);
  for (const lixo of [null, undefined, "x", [], { textos: "x" }]) assertEquals(textosPassandoDoLimite(lixo), []);
});

// ── Alterações ──────────────────────────────────────────────────────────────

Deno.test("alterações: igual ao salvo = sem alteração (inclusive só espaços a mais)", () => {
  const salvo = normalizarReciboVendaConfig({ mostrar: { qr: false }, textos: { topo: "Loja oficial" } });
  const r = structuredClone(salvo);
  assertFalse(haAlteracoesReciboVendaConfig(salvo, r));
  r.textos.topo = "  Loja   oficial  \n\n";
  assertFalse(haAlteracoesReciboVendaConfig(salvo, r));
});

Deno.test("alterações: mudar um interruptor ou um texto conta", () => {
  const salvo = reciboVendaConfigPadrao();
  for (const k of INTERRUPTORES_RECIBO_VENDA) {
    const r = reciboVendaConfigPadrao();
    r.mostrar[k] = false;
    assert(haAlteracoesReciboVendaConfig(salvo, r), k);
  }
  for (const k of CAMPOS_TEXTO_RECIBO_VENDA) {
    const r = reciboVendaConfigPadrao();
    r.textos[k] = "x";
    assert(haAlteracoesReciboVendaConfig(salvo, r), k);
  }
});

Deno.test("alterações: texto que passou do limite não parece igual ao salvo cortado", () => {
  const salvo = normalizarReciboVendaConfig({ textos: { topo: "a".repeat(300) } });
  const r = structuredClone(salvo);
  r.textos.topo = "a".repeat(320);
  assert(haAlteracoesReciboVendaConfig(salvo, r));
});

Deno.test("alterações: null, {}, lixo e versão inválida valem como padrão", () => {
  for (const x of [null, undefined, {}, "x", [], { versao: 2, mostrar: { qr: false } }, { versao: "1", textos: { topo: "a" } }]) {
    assertFalse(haAlteracoesReciboVendaConfig(RECIBO_VENDA_CONFIG_PADRAO, x), JSON.stringify(x));
    assert(rascunhoEhPadraoReciboVenda(x));
  }
});

Deno.test("restaurar padrão: só fica disponível fora do padrão", () => {
  assert(rascunhoEhPadraoReciboVenda(reciboVendaConfigPadrao()));
  const r = reciboVendaConfigPadrao();
  r.textos.frase_rodape = "Volte sempre";
  assertFalse(rascunhoEhPadraoReciboVenda(r));
  r.textos.frase_rodape = "   ";
  assert(rascunhoEhPadraoReciboVenda(r));
});

// ── Venda de exemplo ────────────────────────────────────────────────────────

Deno.test("exemplos: os 5 do seletor montam o recibo, com a loja de exemplo ou a real", () => {
  assertEquals([...EXEMPLOS_RECIBO_VENDA], ["simples", "com-garantia", "com-troca", "parcelado", "cancelada"]);
  for (const id of EXEMPLOS_RECIBO_VENDA) {
    const m = montarReciboVenda(entradaExemploRecibo(id));
    assertEquals(m.cabecalho.nomeLoja, LOJA_EXEMPLO.nome_loja, id);
    const real = montarReciboVenda(entradaExemploRecibo(id, { loja: { nome_loja: "Minha Loja Real", telefone: "(11) 1111-2222" } }));
    assertEquals(real.cabecalho.nomeLoja, "Minha Loja Real", id);
    assertEquals(real.cabecalho.logoUrl, null, id);
  }
});

Deno.test("exemplos: cada um mostra o que o nome promete", () => {
  const m = (id: (typeof EXEMPLOS_RECIBO_VENDA)[number]) => montarReciboVenda(entradaExemploRecibo(id));
  const simples = m("simples");
  assertEquals(simples.garantias, []);
  assert(simples.resumo.some((l) => l.negativo && l.rotulo.startsWith("Cupom")));
  assert(m("com-garantia").garantias.some((g) => g.titulo === "TERMO DE GARANTIA"));
  assert(m("com-troca").troca);
  assert(m("parcelado").pagamento.formas.some((f) => f.parcelas.length === 4));
  assertEquals(m("cancelada").situacao.tipo, "cancelada");
});

Deno.test("exemplos: modelo novo a cada chamada (a prévia não compartilha objetos)", () => {
  const a = entradaExemploRecibo("com-troca");
  const b = entradaExemploRecibo("com-troca");
  assert(a !== b && a.itens !== b.itens);
  assertEquals(a, b);
});

// ── Prévia ──────────────────────────────────────────────────────────────────

Deno.test("prévia: sem personalização nada fica fora e o modelo vai igual", () => {
  for (const id of EXEMPLOS_RECIBO_VENDA) {
    const modelo = montarReciboVenda(entradaExemploRecibo(id), reciboVendaConfigPadrao());
    assertEquals(itensForaDaPrevia(modelo), []);
    assert(modeloDesenhavelNaPrevia(modelo) === modelo);
  }
});

Deno.test("prévia: assinaturas/rodapé desligados e textos novos ficam no aviso", () => {
  const cfg = tudoDesligado();
  cfg.textos.topo = "Topo";
  cfg.textos.observacoes = "Obs";
  cfg.textos.politica_troca = "Política";
  for (const id of EXEMPLOS_RECIBO_VENDA) {
    const modelo = montarReciboVenda(entradaExemploRecibo(id), cfg);
    assertEquals(itensForaDaPrevia(modelo), ["assinaturas", "rodape", "topo", "observacoes", "politicaTroca"], id);
  }
  const soAgradecimento = reciboVendaConfigPadrao();
  soAgradecimento.textos.agradecimento = "Valeu!";
  assertEquals(itensForaDaPrevia(montarReciboVenda(entradaExemploRecibo("simples"), soAgradecimento)), []);
});

Deno.test("prévia: modelo desenhável nunca tem assinaturas/rodapé nulos e não muda o resto", () => {
  for (const id of EXEMPLOS_RECIBO_VENDA) {
    const modelo = montarReciboVenda(entradaExemploRecibo(id), tudoDesligado());
    assertEquals(modelo.assinaturas, null);
    assertEquals(modelo.rodape, null);
    const d = modeloDesenhavelNaPrevia(modelo);
    assertEquals(d.assinaturas, { vendedor: "", comprador: "" });
    assertEquals(d.rodape, { agradecimento: "", frase: "", contatos: [] });
    const { assinaturas: _a, rodape: _r, ...resto } = d;
    const { assinaturas: _a2, rodape: _r2, ...restoOriginal } = modelo;
    assertEquals(resto, restoOriginal);
    assertEquals(modelo.assinaturas, null, "não altera o modelo recebido");
  }
});

// ── Textos pt-BR / es ───────────────────────────────────────────────────────

type Arvore = Record<string, unknown>;
const rv = (o: unknown) => (o as { reciboVenda: Arvore }).reciboVenda;

for (const [idioma, textos] of [["pt-BR", rv(configuracoesPtBR)], ["es", rv(configuracoesEs)]] as const) {
  Deno.test(`textos ${idioma}: todo interruptor, grupo, campo, exemplo, item e motivo tem texto`, () => {
    const t = textos as Record<string, Record<string, string>>;
    for (const k of INTERRUPTORES_RECIBO_VENDA) {
      assert(t.interruptores[k]?.trim(), `interruptores.${k}`);
      assert(typeof t.dicas[k] === "string", `dicas.${k}`);
    }
    for (const g of GRUPOS_INTERRUPTORES_RECIBO_VENDA) assert(t.grupos[g.id]?.trim(), `grupos.${g.id}`);
    for (const k of SEMPRE_APARECE_RECIBO_VENDA) assert(t.sempreAparece[k]?.trim(), `sempreAparece.${k}`);
    for (const k of CAMPOS_TEXTO_RECIBO_VENDA) {
      assert(t.campos[k]?.trim(), `campos.${k}`);
      assert(t.dicasCampos[k]?.trim(), `dicasCampos.${k}`);
    }
    for (const e of EXEMPLOS_RECIBO_VENDA) assert(t.exemplos[e]?.trim(), `exemplos.${e}`);
    for (const k of ["assinaturas", "rodape", "topo", "observacoes", "politicaTroca"]) assert(t.itensForaDaPrevia[k]?.trim(), k);
    for (const m of Object.keys(MENSAGENS_PERMISSAO_CONFIG_RECIBO)) {
      if (m === "ok") continue;
      assert(t.permissao[m]?.trim(), `permissao.${m}`);
    }
  });
}

Deno.test("textos pt-BR: motivos de permissão iguais aos da lógica pura; aviso fixo literal", () => {
  const t = rv(configuracoesPtBR) as Record<string, Record<string, string> | string>;
  for (const [m, msg] of Object.entries(MENSAGENS_PERMISSAO_CONFIG_RECIBO)) {
    if (m === "ok") continue;
    assertEquals((t.permissao as Record<string, string>)[m], msg, m);
  }
  assertEquals(t.aviso, "Vale para recibo A4 novo, inclusive reimpressões. O recibo 80mm/58mm não muda.");
  assertEquals(t.titulo, "Personalizar recibo de venda");
});

Deno.test("textos es: termos pedidos e glossário (usted, sem vosotros)", () => {
  const t = rv(configuracoesEs) as Record<string, Record<string, string> | string>;
  assertEquals(t.titulo, "Personalizar recibo de venta");
  assertEquals(t.mostrarTitulo, "Mostrar en el recibo");
  assertEquals((t.campos as Record<string, string>).agradecimento, "Mensaje de agradecimiento");
  assertEquals((t.campos as Record<string, string>).politica_troca, "Política de cambios");
  assertEquals(t.restaurar, "Restaurar estándar");
  const tudo = JSON.stringify(t);
  for (const proibido of [/vosotros/i, /\btú\b/i, /\bpieza/i, /\bmóvil/i, /\bordenador/i]) assertFalse(proibido.test(tudo), String(proibido));
});
