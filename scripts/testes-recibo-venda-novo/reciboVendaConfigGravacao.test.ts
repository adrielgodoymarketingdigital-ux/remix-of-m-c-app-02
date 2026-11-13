// Fase 2: quem grava, o que grava e como confere a gravação da
// personalização do recibo de venda. Rodar:
//   deno test -A --no-check scripts/testes-recibo-venda-novo/
import { assert, assertEquals, assertStrictEquals } from "jsr:@std/assert@1";
import {
  bytesReciboVendaConfig,
  decidirPermissaoConfigRecibo,
  interpretarResultadoGravacao,
  LIMITE_BYTES_RECIBO_VENDA_CONFIG,
  MENSAGENS_PERMISSAO_CONFIG_RECIBO,
  mensagemErroGravacaoReciboVendaConfig,
  prepararGravacaoReciboVendaConfig,
  type ContextoPermissaoConfigRecibo,
} from "../../src/lib/vendas/reciboVendaConfigGravacao.ts";
import {
  INTERRUPTORES_RECIBO_VENDA,
  LIMITES_TEXTOS_RECIBO_VENDA,
  limparTextoRecibo,
  normalizarReciboVendaConfig,
  RECIBO_VENDA_CONFIG_PADRAO,
  reciboVendaConfigPadrao,
} from "../../src/lib/vendas/reciboVendaConfig.ts";

const MATRIZ = { id: "linha-matriz", empresa_id: null };
const FILIAL = { id: "linha-filial", empresa_id: "filial-1" };
const AVISO_PROPRIETARIO = /configurado pelo proprietário/;

const ctx = (c: Partial<ContextoPermissaoConfigRecibo>): ContextoPermissaoConfigRecibo => ({
  papel: "dono",
  carregando: false,
  empresaIdSelecionada: null,
  linha: MATRIZ,
  ...c,
});

// ── Matriz de permissão ─────────────────────────────────────────────────────

Deno.test("permissão: dono na matriz edita", () => {
  const p = decidirPermissaoConfigRecibo(ctx({}));
  assertEquals(p, { podeEditar: true, motivo: "ok", mensagem: "" });
});

Deno.test("permissão: dono numa filial com linha própria edita", () => {
  const p = decidirPermissaoConfigRecibo(ctx({ empresaIdSelecionada: "filial-1", linha: FILIAL }));
  assertEquals(p.podeEditar, true);
  assertEquals(p.motivo, "ok");
});

Deno.test("permissão: dono numa filial SEM linha própria (lendo a da matriz) não salva e orienta a matriz", () => {
  const p = decidirPermissaoConfigRecibo(ctx({ empresaIdSelecionada: "filial-1", linha: MATRIZ }));
  assertEquals(p.podeEditar, false);
  assertEquals(p.motivo, "filial_sem_linha_propria");
  assert(/matriz/.test(p.mensagem));
});

Deno.test("permissão: linha de outra filial que não a escolhida não salva", () => {
  const p = decidirPermissaoConfigRecibo(ctx({ empresaIdSelecionada: "filial-2", linha: FILIAL }));
  assertEquals(p.podeEditar, false);
  assertEquals(p.motivo, "filial_sem_linha_propria");
});

Deno.test("permissão: matriz escolhida mas linha carregada é de filial não salva", () => {
  const p = decidirPermissaoConfigRecibo(ctx({ empresaIdSelecionada: null, linha: FILIAL }));
  assertEquals(p.podeEditar, false);
  assertEquals(p.motivo, "linha_de_outra_loja");
});

for (const papel of ["funcionario", "gerente"] as const) {
  for (const cenario of [
    { nome: "matriz", empresaIdSelecionada: null, linha: MATRIZ },
    { nome: "filial com linha", empresaIdSelecionada: "filial-1", linha: FILIAL },
    { nome: "filial sem linha", empresaIdSelecionada: "filial-1", linha: MATRIZ },
    { nome: "sem linha", empresaIdSelecionada: null, linha: null },
  ]) {
    Deno.test(`permissão: ${papel} (${cenario.nome}) só vê a prévia com aviso do proprietário`, () => {
      const p = decidirPermissaoConfigRecibo(ctx({ papel, ...cenario }));
      assertEquals(p.podeEditar, false);
      assertEquals(p.motivo, papel);
      assert(AVISO_PROPRIETARIO.test(p.mensagem), p.mensagem);
    });
  }
}

Deno.test("permissão: carregando (papel nulo/indefinido ou config carregando) nega", () => {
  for (const c of [{ papel: null }, { papel: undefined }, { carregando: true }] as Partial<ContextoPermissaoConfigRecibo>[]) {
    const p = decidirPermissaoConfigRecibo(ctx(c));
    assertEquals(p.podeEditar, false);
    assertEquals(p.motivo, "carregando");
  }
});

Deno.test("permissão: papel desconhecido (lixo) nega com aviso do proprietário", () => {
  for (const papel of ["admin", "", "DONO", 1, true, {}] as unknown[]) {
    const p = decidirPermissaoConfigRecibo(ctx({ papel: papel as ContextoPermissaoConfigRecibo["papel"] }));
    assertEquals(p.podeEditar, false, String(papel));
    assertEquals(p.motivo, "papel_desconhecido");
    assert(AVISO_PROPRIETARIO.test(p.mensagem));
  }
});

Deno.test("permissão: dono sem linha carregada (ou linha sem id) não salva e não cria linha", () => {
  for (const linha of [null, undefined, {}, { id: "" }, { id: null, empresa_id: null }]) {
    const p = decidirPermissaoConfigRecibo(ctx({ linha }));
    assertEquals(p.podeEditar, false);
    assertEquals(p.motivo, "sem_configuracao");
  }
});

Deno.test("permissão: empresa_id vazio vale como matriz (null)", () => {
  assertEquals(decidirPermissaoConfigRecibo(ctx({ empresaIdSelecionada: "", linha: { id: "x", empresa_id: null } })).podeEditar, true);
  assertEquals(decidirPermissaoConfigRecibo(ctx({ empresaIdSelecionada: undefined, linha: { id: "x", empresa_id: "" } })).podeEditar, true);
});

Deno.test("permissão: só 'ok' tem mensagem vazia; todo motivo tem mensagem", () => {
  for (const [motivo, msg] of Object.entries(MENSAGENS_PERMISSAO_CONFIG_RECIBO)) {
    assertEquals(msg === "", motivo === "ok", motivo);
  }
});

// ── O que gravar ────────────────────────────────────────────────────────────

Deno.test("gravação: padrão (e tudo que normaliza para o padrão) grava NULL", () => {
  for (const r of [
    undefined,
    null,
    {},
    RECIBO_VENDA_CONFIG_PADRAO,
    reciboVendaConfigPadrao(),
    { versao: 1 },
    { mostrar: {}, textos: {} },
    { mostrar: { logo: true, qr: "false", troca: 0 }, textos: { topo: "   \n\n  ", observacoes: 123 } },
  ]) {
    assertEquals(prepararGravacaoReciboVendaConfig(r), { ok: true, valor: null }, JSON.stringify(r));
  }
});

Deno.test("gravação: lixo vira padrão e grava NULL", () => {
  for (const r of ["texto", 42, true, [], [1, 2], () => 1, new Date(), { versao: 2, mostrar: { qr: false } }, { versao: "1", mostrar: { qr: false } }]) {
    assertEquals(prepararGravacaoReciboVendaConfig(r), { ok: true, valor: null }, String(r));
  }
});

Deno.test("gravação: config parcial grava o objeto normalizado e completo", () => {
  const r = prepararGravacaoReciboVendaConfig({
    mostrar: { qr: false, cliente_cpf: false, logo: "não" },
    textos: { topo: "  Loja   oficial \r\n\r\n\r\n  Desde 2010 ", agradecimento: 99 },
    extra: "ignorado",
  });
  assert(r.ok);
  if (!r.ok) return;
  const esperado = reciboVendaConfigPadrao();
  esperado.mostrar.qr = false;
  esperado.mostrar.cliente_cpf = false;
  esperado.textos.topo = "Loja oficial\n\nDesde 2010";
  assertEquals(r.valor, esperado);
  assertEquals(Object.keys(r.valor!).sort(), ["mostrar", "textos", "versao"]);
  assertEquals(Object.keys(r.valor!.mostrar).length, INTERRUPTORES_RECIBO_VENDA.length);
  assertStrictEquals(r.valor!.versao, 1);
});

Deno.test("gravação: valor preparado normaliza para ele mesmo (idempotente) e é objeto JSON", () => {
  const r = prepararGravacaoReciboVendaConfig({ mostrar: { parcelas: false }, textos: { politica_troca: "Troca em 7 dias." } });
  assert(r.ok && r.valor);
  if (!r.ok || !r.valor) return;
  assertEquals(normalizarReciboVendaConfig(JSON.parse(JSON.stringify(r.valor))), r.valor);
  assertEquals(prepararGravacaoReciboVendaConfig(r.valor), r);
});

Deno.test("gravação: não altera o rascunho recebido", () => {
  const rascunho = { mostrar: { qr: false }, textos: { topo: "  a  " } };
  const copia = structuredClone(rascunho);
  prepararGravacaoReciboVendaConfig(rascunho);
  assertEquals(rascunho, copia);
});

Deno.test("gravação: textos no limite com caracteres comuns cabem no CHECK do banco", () => {
  const textos: Record<string, string> = {};
  for (const [k, { caracteres }] of Object.entries(LIMITES_TEXTOS_RECIBO_VENDA)) textos[k] = "ç".repeat(caracteres);
  const r = prepararGravacaoReciboVendaConfig({ textos });
  assert(r.ok && r.valor);
});

Deno.test("gravação: emoji compostos que estouram 16384 bytes dão erro (nunca chegam ao banco)", () => {
  const familia = "\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}"; // 1 caractere visível, 25 bytes
  const r = prepararGravacaoReciboVendaConfig({ textos: { observacoes: familia.repeat(1500), politica_troca: familia.repeat(1500) } });
  assertEquals(r.ok, false);
  if (r.ok) return;
  assert(/grandes demais/.test(r.erro));
});

Deno.test("gravação: estimativa de bytes nunca fica abaixo do texto do jsonb (com espaços)", () => {
  const cfg = normalizarReciboVendaConfig({ mostrar: { qr: false }, textos: { topo: "olá ✨" } });
  // Simula o texto do jsonb do Postgres: espaço depois de ":" e "," estruturais.
  const jsonbTexto = JSON.stringify(cfg, null, 0)
    .replace(/"(\w+)":/g, '"$1": ')
    .replace(/,(?=")/g, ", ");
  const reais = new TextEncoder().encode(jsonbTexto).length;
  assert(bytesReciboVendaConfig(cfg) >= reais, `${bytesReciboVendaConfig(cfg)} < ${reais}`);
  assert(bytesReciboVendaConfig(cfg) < LIMITE_BYTES_RECIBO_VENDA_CONFIG);
});

Deno.test("gravação: metade de emoji solta (surrogate sem par) sai do texto (o jsonb recusaria)", () => {
  assertEquals(limparTextoRecibo("a\uD83Db\uDE00c", 100, 5), "abc");
  assertEquals(limparTextoRecibo("ok \u{1F600}", 100, 5), "ok \u{1F600}");
  const r = prepararGravacaoReciboVendaConfig({ textos: { topo: "\uD800" } });
  assertEquals(r, { ok: true, valor: null });
  const r2 = prepararGravacaoReciboVendaConfig({ textos: { topo: "x\uDFFF" } });
  assert(r2.ok && r2.valor);
  if (r2.ok && r2.valor) assert(!/\\ud[89a-f]/i.test(JSON.stringify(r2.valor)));
});

// ── Conferência do resultado ────────────────────────────────────────────────

Deno.test("resultado: exatamente 1 linha é sucesso", () => {
  assertEquals(interpretarResultadoGravacao(1), { ok: true });
});

Deno.test("resultado: 0 linhas é erro claro (nada foi salvo)", () => {
  for (const n of [0, null, undefined]) {
    const r = interpretarResultadoGravacao(n);
    assertEquals(r.ok, false);
    if (!r.ok) assert(/Nada foi salvo/.test(r.erro));
  }
});

Deno.test("resultado: 2 ou mais linhas (ou valor estranho) é erro", () => {
  for (const n of [2, 3, 100, -1, 1.5, "1", NaN, true, [1]]) {
    const r = interpretarResultadoGravacao(n);
    assertEquals(r.ok, false, String(n));
  }
});

Deno.test("erro do Supabase: coluna ausente, CHECK e genérico", () => {
  assert(/ainda não está disponível/.test(mensagemErroGravacaoReciboVendaConfig({ code: "PGRST204", message: "Could not find the 'recibo_venda_config' column" })));
  assert(/ainda não está disponível/.test(mensagemErroGravacaoReciboVendaConfig({ code: "42703", message: "x" })));
  assert(/grandes demais/.test(mensagemErroGravacaoReciboVendaConfig({ code: "23514", message: "violates check constraint" })));
  for (const e of [null, undefined, {}, { code: "42501", message: "permission denied" }]) {
    assert(/Não foi possível salvar/.test(mensagemErroGravacaoReciboVendaConfig(e)));
  }
});
