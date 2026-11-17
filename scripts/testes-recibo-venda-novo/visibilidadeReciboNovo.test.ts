// deno test --no-check scripts/testes-recibo-venda-novo/
// Regra única do recibo de venda novo e da tela "Personalizar" (opt-in por loja).
// `loja` é a linha de configuracoes_loja que o diálogo de recibo JÁ leu
// (useConfiguracaoLoja): funcionário → linha do dono; gerente de filial → linha
// própria; filial sem linha própria → linha da matriz; carregando/falhou → null.
import { assertEquals } from "jsr:@std/assert@1";
import {
  lojaPersonalizouReciboVenda,
  type PapelLojaRecibo,
  PERSONALIZACAO_RECIBO_VENDA_LIBERADA,
  reciboVendaNovoVisivelPara,
  telaPersonalizarReciboVisivelPara,
} from "../../src/lib/vendas/visibilidadeReciboNovo.ts";

const CONFIG = { versao: 1, mostrar: { qr: false }, textos: { agradecimento: "Valeu!" } };
const linha = (recibo_venda_config: unknown, extra: Record<string, unknown> = {}) => ({ id: "cfg", nome_loja: "Loja", ...extra, recibo_venda_config });
const SEM_CONFIG = linha(null);
const COM_CONFIG = linha(CONFIG);

Deno.test("constante: personalização liberada (freio desligado)", () => {
  assertEquals(PERSONALIZACAO_RECIBO_VENDA_LIBERADA, true);
});

Deno.test("recibo novo: admin sempre, com ou sem config, até carregando", () => {
  for (const loja of [COM_CONFIG, SEM_CONFIG, null, undefined, linha("lixo")]) {
    assertEquals(reciboVendaNovoVisivelPara({ isAdmin: true, loja }), true);
    assertEquals(reciboVendaNovoVisivelPara({ isAdmin: true, loja }, false), true, "freio não tira do admin");
  }
});

Deno.test("recibo novo: dono sem personalização = recibo de sempre", () => {
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: SEM_CONFIG }), false);
});

Deno.test("recibo novo: dono com personalização = recibo novo", () => {
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: COM_CONFIG }), true);
  // {} e versão futura também são personalização salva (o kit desenha o padrão nesses casos).
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: linha({}) }), true);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: linha({ versao: 99 }) }), true);
});

Deno.test("recibo novo: funcionário imprime pela linha do dono", () => {
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: linha(CONFIG, { user_id: "dono" }) }), true);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: linha(null, { user_id: "dono" }) }), false);
});

Deno.test("recibo novo: gerente de filial segue a linha que o hook devolve", () => {
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: linha(CONFIG, { user_id: "gerente", empresa_id: "filial" }) }), true);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: linha(null, { user_id: "gerente", empresa_id: "filial" }) }), false);
});

Deno.test("recibo novo: filial com linha própria vale a da filial; sem linha própria vale a da matriz", () => {
  // Com linha própria: a da filial manda, mesmo com a matriz personalizada.
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: linha(null, { empresa_id: "filial" }) }), false);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: linha(CONFIG, { empresa_id: "filial" }) }), true);
  // Sem linha própria: o hook devolve a da matriz (empresa_id null).
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: linha(CONFIG, { empresa_id: null }) }), true);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: linha(null, { empresa_id: null }) }), false);
});

Deno.test("recibo novo: coluna ausente, NULL ou inválida = recibo de sempre", () => {
  const semColuna = { id: "cfg", nome_loja: "Loja" };
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: semColuna }), false);
  for (const invalido of [null, undefined, "texto", "{\"versao\":1}", 0, 1, true, false, [], [CONFIG]]) {
    assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: linha(invalido) }), false, `valor ${JSON.stringify(invalido)}`);
  }
});

Deno.test("recibo novo: configuração carregando ou que falhou = recibo de sempre", () => {
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: null }), false);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: undefined }), false);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false }), false);
});

Deno.test("recibo novo: freio de emergência (liberado=false) = só admin", () => {
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: COM_CONFIG }, false), false);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: false, loja: SEM_CONFIG }, false), false);
  assertEquals(reciboVendaNovoVisivelPara({ isAdmin: true, loja: SEM_CONFIG }, false), true);
});

Deno.test("lojaPersonalizouReciboVenda: só objeto conta", () => {
  assertEquals(lojaPersonalizouReciboVenda(COM_CONFIG), true);
  assertEquals(lojaPersonalizouReciboVenda(linha({})), true);
  for (const x of [null, undefined, "", "loja", 1, [], SEM_CONFIG, linha([]), linha("x")]) {
    assertEquals(lojaPersonalizouReciboVenda(x), false, JSON.stringify(x));
  }
});

Deno.test("tela Personalizar: admin sempre; dono sim; funcionário, gerente e carregando não", () => {
  const casos: [PapelLojaRecibo | null | undefined, boolean, boolean][] = [
    // papel, admin, esperado
    ["dono", false, true],
    ["funcionario", false, false],
    ["gerente", false, false],
    [null, false, false],
    [undefined, false, false],
    ["dono", true, true],
    ["funcionario", true, true],
    ["gerente", true, true],
    [null, true, true],
  ];
  for (const [papel, isAdmin, esperado] of casos) {
    assertEquals(telaPersonalizarReciboVisivelPara({ isAdmin, papel }), esperado, `${papel} admin=${isAdmin}`);
  }
});

Deno.test("tela Personalizar: freio de emergência = só admin", () => {
  assertEquals(telaPersonalizarReciboVisivelPara({ isAdmin: false, papel: "dono" }, false), false);
  assertEquals(telaPersonalizarReciboVisivelPara({ isAdmin: true, papel: "dono" }, false), true);
  assertEquals(telaPersonalizarReciboVisivelPara({ isAdmin: true, papel: "funcionario" }, false), true);
});

Deno.test("matriz papel × personalização (recibo novo / tela)", () => {
  // [nome, papel, admin, linha que o diálogo leu, recibo novo?, tela?]
  const tabela: [string, PapelLojaRecibo, boolean, { recibo_venda_config?: unknown } | null, boolean, boolean][] = [
    ["admin sem config", "dono", true, SEM_CONFIG, true, true],
    ["admin com config", "dono", true, COM_CONFIG, true, true],
    ["dono sem config", "dono", false, SEM_CONFIG, false, true],
    ["dono com config", "dono", false, COM_CONFIG, true, true],
    ["funcionário, dono sem config", "funcionario", false, SEM_CONFIG, false, false],
    ["funcionário, dono com config", "funcionario", false, COM_CONFIG, true, false],
    ["gerente, linha sem config", "gerente", false, SEM_CONFIG, false, false],
    ["gerente, linha com config", "gerente", false, COM_CONFIG, true, false],
    ["dono, falha ao carregar", "dono", false, null, false, true],
  ];
  for (const [nome, papel, isAdmin, loja, recibo, tela] of tabela) {
    assertEquals(reciboVendaNovoVisivelPara({ isAdmin, loja }), recibo, `${nome}: recibo`);
    assertEquals(telaPersonalizarReciboVisivelPara({ isAdmin, papel }), tela, `${nome}: tela`);
  }
});
