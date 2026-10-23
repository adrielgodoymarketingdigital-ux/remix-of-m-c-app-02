// deno test --no-check --no-lock --node-modules-dir=none -A scripts/testes-xml-compra/
// Etapa 4 da importação de XML (gravar): payload da RPC importar_nfe_compra,
// previsão acumulada do custo médio, limite do plano, liberação do botão e
// mensagens de erro. Só XMLs e cadastros fictícios; nada vai à rede.
import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { JSDOM } from "npm:jsdom@25.0.1";
import { lerXmlNfe } from "../../src/lib/nfe/lerXmlNfe.ts";
import { lerDadosTributaveis } from "../../src/lib/nfe/dadosTributaveisNfe.ts";
import type { CandidatoEstoque } from "../../src/lib/nfe/sugestaoVinculo.ts";
import {
  acumularPrevisaoCustoMedio,
  decisaoInicial,
  montarLinha,
  resumirImportacao,
  type DecisaoItem,
} from "../../src/lib/nfe/planoImportacao.ts";
import {
  caminhoXmlCompra,
  codigoBarrasParaNovo,
  conferirLimitePlano,
  erroUploadEhObjetoExistente,
  formatarDataHoraBrasilia,
  interpretarErroImportacao,
  lerRetornoImportacao,
  MENSAGEM_ERRO_GENERICO,
  montarPayloadImportacao,
  motivosBloqueio,
  textoJaImportada,
  type EstadoConfirmacao,
} from "../../src/lib/nfe/gravarImportacao.ts";
import { CNPJ_EMITENTE_FICTICIO, gerarXmlNfe, imeiFicticio } from "./fixtures.ts";

const janela = new JSDOM("").window;
const criarParser = () => new janela.DOMParser() as unknown as DOMParser;

const cand = (p: Partial<CandidatoEstoque> & { id: string }): CandidatoEstoque => ({
  tipo: "produto", nome: p.id, variacaoLabel: null, sku: null, codigoBarras: null, quantidade: 0, custo: null, ...p,
});
const P1 = cand({ id: "11111111-1111-4111-8111-111111111111", quantidade: 10, custo: 4 });
const K1 = cand({ id: "22222222-2222-4222-8222-222222222222", tipo: "peca", quantidade: 3, custo: 7.5 });

/** Lê o XML e monta as linhas com as decisões dadas (o resto = decisão inicial sem sugestão). */
function plano(xml: string, decisoes: Record<number, Partial<DecisaoItem>> = {}, cmGeral = true) {
  const resultado = lerXmlNfe(xml, { criarParser });
  const trib = lerDadosTributaveis(xml, { criarParser });
  const linhas = acumularPrevisaoCustoMedio(resultado.itens.map((it) =>
    montarLinha(it, { ...decisaoInicial(it, null, trib.get(it.nItem)), ...decisoes[it.nItem] }, cmGeral)
  ));
  return { resultado, trib, linhas };
}

// Nota fictícia parecida com a da etapa 2 (6 itens: vínculo, caixa, fracionado, aparelho...).
const XML = gerarXmlNfe({
  nNF: "5678",
  dhEmi: "2026-10-15T10:30:00-03:00",
  itens: [
    { cProd: "FIC-PEL-01", cEAN: "7891234567895", xProd: "PELICULA 3D FICTICIA", qCom: "10.0000", vUnCom: "5.0000000000", vProd: "50.00", vDesc: "2.00", vFrete: "1.00" },
    { cProd: "FIC-CAP-02", cEAN: "SEM GTIN", xProd: "CAPA SILICONE FICT", qCom: "5.0000", vUnCom: "8.0000000000", vProd: "40.00", vICMSST: "3.50", vIPI: "1.50" },
    { cProd: "CX-CABO-1", cEAN: "7891234567802", cEANTrib: "SEM GTIN", xProd: "CABO FICTICIO CAIXA", uCom: "CX", qCom: "2.0000", uTrib: "UN", qTrib: "24.0000", vUnCom: "60.0000000000", vProd: "120.00" },
    { cProd: "FITA-M", cEAN: "SEM GTIN", xProd: "FITA ADESIVA METRO", uCom: "M", qCom: "2.5000", vUnCom: "2.0000000000", vProd: "5.00" },
    { cProd: "CEL-X", cEAN: "SEM GTIN", xProd: "CELULAR FICTICIO X", qCom: "1.0000", vUnCom: "1250.0000000000", vProd: "1250.00", infAdProd: `IMEI: ${imeiFicticio("35000000000041")}` },
    { cProd: "SUP-77", cEAN: "7891234567890", xProd: "SUPORTE FICTICIO", qCom: "3.0000", vUnCom: "10.0000000000", vProd: "30.00" },
  ],
});

const DECISOES: Record<number, Partial<DecisaoItem>> = {
  1: { acao: "vincular", vinculo: P1 },
  2: { acao: "vincular", vinculo: K1, atualizarCustoMedio: false },
  3: { acao: "novo", tipoNovo: "peca", precoVenda: "19,90" },
  4: { acao: "ignorar" },
  6: { acao: "novo" },
};

Deno.test("payload: só itens a importar, em ordem, tudo inteiro, contrato da RPC", () => {
  const { resultado, trib, linhas } = plano(XML, DECISOES);
  const p = montarPayloadImportacao(resultado, linhas, trib, { empresaId: "matriz-id", isFilial: false });

  assertEquals(p.empresa_id, null, "matriz vai como null mesmo com o id da linha matriz");
  assert(!("user_id" in p), "nunca envia user_id");
  assertEquals(p.nota, {
    chave: resultado.nota!.chave,
    numero: "5678",
    serie: "1",
    modelo: "55",
    tp_amb: "1",
    emitente_cnpj: CNPJ_EMITENTE_FICTICIO,
    emitente_nome: "FORNECEDOR FICTICIO DE ACESSORIOS LTDA",
    data_emissao: "2026-10-15T10:30:00-03:00",
    valor_total_centavos: 149500,
  });
  assertEquals(p.itens.map((i) => i.n_item), [1, 2, 3, 6], "ignorado (4) e aparelho (5) fora, em ordem de nItem");
  assertEquals(p.itens[0], {
    n_item: 1, c_prod: "FIC-PEL-01", descricao: "PELICULA 3D FICTICIA", quantidade: 10, fator: 1,
    custo_unitario_centavos: 490, tipo_destino: "produto", acao: "vinculado", item_id: P1.id, atualizar_custo_medio: true,
  });
  assertEquals(p.itens[1].tipo_destino, "peca");
  assertEquals(p.itens[1].atualizar_custo_medio, false);
  assertEquals(p.itens[1].custo_unitario_centavos, 900);
  assertEquals(p.itens[2], {
    n_item: 3, c_prod: "CX-CABO-1", descricao: "CABO FICTICIO CAIXA", quantidade: 24, fator: 12,
    custo_unitario_centavos: 500, tipo_destino: "peca", acao: "novo", novo_nome: "CABO FICTICIO CAIXA",
    novo_codigo_barras: "7891234567802", novo_preco_centavos: 1990,
  });
  // Item 6: EAN com dígito errado → o leitor já devolve null → não vai; preço vazio → não vai.
  assertEquals(p.itens[3].novo_codigo_barras, undefined);
  assertEquals(p.itens[3].novo_preco_centavos, undefined);
  assertEquals(p.itens[3].item_id, undefined);
  assertEquals(p.itens[3].atualizar_custo_medio, undefined);

  // Nada de float: todo número (fora o fator) é inteiro seguro.
  for (const it of p.itens) {
    for (const k of ["n_item", "quantidade", "custo_unitario_centavos", "novo_preco_centavos"] as const) {
      if (it[k] !== undefined) assert(Number.isSafeInteger(it[k]), `${k} inteiro no item ${it.n_item}`);
    }
  }
  assert(Number.isSafeInteger(p.nota.valor_total_centavos));
});

Deno.test("payload: filial envia o id da filial; item com erro não entra; nota inválida lança", () => {
  const { resultado, trib, linhas } = plano(XML, { ...DECISOES, 4: { acao: "novo" } });
  assertEquals(linhas.find((l) => l.nItem === 4)!.situacao, "erro");
  const p = montarPayloadImportacao(resultado, linhas, trib, { empresaId: "filial-id", isFilial: true });
  assertEquals(p.empresa_id, "filial-id");
  assertEquals(p.itens.map((i) => i.n_item), [1, 2, 3, 6], "o fracionado com erro fica fora");

  const invalida = plano(gerarXmlNfe({ nNFDivergente: "999" }));
  assertThrows(() => montarPayloadImportacao(invalida.resultado, invalida.linhas, invalida.trib, { empresaId: null, isFilial: false }));
});

Deno.test("payload: CPF de produtor e dhEmi com outro fuso passam sem alteração", () => {
  const xml = gerarXmlNfe({ dhEmi: "2026-10-01T23:59:59-04:00" });
  const { resultado, trib, linhas } = plano(xml);
  const p = montarPayloadImportacao(resultado, linhas, trib, { empresaId: null, isFilial: false });
  assertEquals(p.nota.data_emissao, "2026-10-01T23:59:59-04:00");
  assert(/^\d{14}$/.test(p.nota.emitente_cnpj));
});

Deno.test("código de barras do cadastro novo: só GTIN válido de 8 a 14 dígitos", () => {
  assertEquals(codigoBarrasParaNovo({ ean: "7891234567895" }), "7891234567895");
  assertEquals(codigoBarrasParaNovo({ ean: null }, { eanTrib: "7891234567895" }), "7891234567895");
  assertEquals(codigoBarrasParaNovo({ ean: "7891234567890" }), null, "dígito verificador errado");
  assertEquals(codigoBarrasParaNovo({ ean: "123" }), null);
  assertEquals(codigoBarrasParaNovo({ ean: "SEM GTIN" }), null);
  assertEquals(codigoBarrasParaNovo({ ean: null }, null), null);
});

Deno.test("plano: preço de venda, limites da RPC e cProd vazio viram erro do item", () => {
  const xml = gerarXmlNfe({
    itens: [
      { cProd: "A1", qCom: "1.0000", vUnCom: "10.0000000000", vProd: "10.00" },
      { cProd: "A2", qCom: "100000.0000", vUnCom: "1.0000000000", vProd: "100000.00" },
      { cProd: "A3", qCom: "1.0000", vUnCom: "100000.0000000000", vProd: "100000.00" },
      { cProd: " ", qCom: "1.0000", vUnCom: "1.0000000000", vProd: "1.00" },
    ],
  });
  const { linhas } = plano(xml, { 1: { acao: "novo", precoVenda: "abc" } });
  assert(linhas[0].erros.some((e) => e.includes("Preço de venda inválido")));
  assert(linhas[1].erros.some((e) => e.includes("Quantidade acima do máximo")));
  assert(linhas[2].erros.some((e) => e.includes("acima do máximo (R$ 99.999,99)")));
  assert(linhas[3].erros.some((e) => e.includes("cProd")));
  const ok = plano(xml, { 1: { acao: "novo", precoVenda: "12,5" } }).linhas[0];
  assertEquals(ok.precoVendaCentavos, 1250);
  assertEquals(ok.situacao, "importar");
});

Deno.test("custo médio previsto acumula na ordem dos itens quando o produto se repete", () => {
  const xml = gerarXmlNfe({
    itens: [
      { cProd: "L1", qCom: "10.0000", vUnCom: "4.9000000000", vProd: "49.00" },
      { cProd: "L2", qCom: "2.0000", vUnCom: "3.0000000000", vProd: "6.00" },
      { cProd: "L3", qCom: "5.0000", vUnCom: "6.0000000000", vProd: "30.00" },
    ],
  });
  const { linhas, resultado } = plano(xml, {
    1: { acao: "vincular", vinculo: P1 },
    2: { acao: "vincular", vinculo: K1 },
    3: { acao: "vincular", vinculo: P1 },
  });
  // P1: 10 un. a 4,00. Item 1: +10 a 4,90 → (40,00 + 49,00)/20 = 4,45.
  // Item 3: parte de 20 un. a 4,45: (89,00 + 30,00)/25 = 4,76 (sem acumular daria 5,00).
  assertEquals([linhas[0].quantidadeAntes, linhas[0].custoAtualCentavos, linhas[0].custoDepoisCentavos], [10, 400, 445]);
  assertEquals([linhas[2].quantidadeAntes, linhas[2].custoAtualCentavos, linhas[2].custoDepoisCentavos], [20, 445, 476]);
  assertEquals(linhas[2].itensAnteriores, [1]);
  assertEquals(linhas[1].itensAnteriores, [], "peça sozinha não muda");
  assertEquals(linhas[1].custoDepoisCentavos, 570, "K1: (3×7,50 + 2×3,00)/5 = 5,70");
  assertEquals(resumirImportacao(resultado, linhas).avisos.length, 1);
});

Deno.test("custo médio acumulado: linha sem atualizar mantém o custo e soma a quantidade", () => {
  const xml = gerarXmlNfe({
    itens: [
      { cProd: "L1", qCom: "10.0000", vUnCom: "4.9000000000", vProd: "49.00" },
      { cProd: "L2", qCom: "5.0000", vUnCom: "6.0000000000", vProd: "30.00" },
    ],
  });
  const { linhas, resultado } = plano(xml, {
    1: { acao: "vincular", vinculo: P1, atualizarCustoMedio: false },
    2: { acao: "vincular", vinculo: P1 },
  });
  assertEquals(linhas[0].custoDepoisCentavos, 400);
  // Item 2 parte de 20 un. a 4,00: (80,00 + 30,00)/25 = 4,40.
  assertEquals([linhas[1].quantidadeAntes, linhas[1].custoAtualCentavos, linhas[1].custoDepoisCentavos], [20, 400, 440]);
  const r = resumirImportacao(resultado, linhas);
  assert(r.avisos.some((a) => a.texto.includes("Os itens 1, 2") && a.texto.includes("custo médio")));
});

Deno.test("resumo: novos por tipo e nota já importada vira pendência", () => {
  const { resultado, linhas } = plano(XML, DECISOES);
  const r = resumirImportacao(resultado, linhas);
  assertEquals([r.novos, r.novosProdutos, r.novosPecas], [2, 1, 1]);
  assert(r.prontoParaGravar);
  const r2 = resumirImportacao(resultado, linhas, textoJaImportada({ criadaEm: "2026-10-20T13:05:00Z" }));
  assertEquals(r2.pendencias.map((p) => p.texto), ["Esta nota já foi importada em 20/10/2026 10:05."]);
  assert(!r2.prontoParaGravar);
});

Deno.test("limite do plano: conta os novos contra produtos+peças do mês", () => {
  assertEquals(conferirLimitePlano(5, { permitido: true, usados: 0, limite: -1 }), null, "ilimitado");
  assertEquals(conferirLimitePlano(0, { permitido: false, usados: 10, limite: 10 }), null, "sem novos não bloqueia");
  assertEquals(conferirLimitePlano(3, { permitido: true, usados: 7, limite: 10 }), null, "cabe exato");
  const m = conferirLimitePlano(4, { permitido: true, usados: 7, limite: 10 })!;
  assert(m.includes("até 10") && m.includes("cadastrados 7") && m.includes("criaria 4") && m.includes("cabem mais 3"), m);
  assert(conferirLimitePlano(1, { permitido: false, usados: 10, limite: 10 })!.includes("criaria 1 cadastro novo."));
});

Deno.test("botão: motivos de bloqueio", () => {
  const { resultado, linhas } = plano(XML, DECISOES);
  const resumo = resumirImportacao(resultado, linhas);
  const base: EstadoConfirmacao = {
    podeImportar: true, resumo, notaOk: true, verificandoNota: false, falhaVerificacaoNota: false, verificandoLimite: false, bloqueioLimite: null,
  };
  assertEquals(motivosBloqueio(base), []);
  assert(motivosBloqueio({ ...base, podeImportar: false })[0].includes("administradores"));
  assertEquals(motivosBloqueio({ ...base, notaOk: false }).at(-1), "Nota não pode ser importada.");
  assert(motivosBloqueio({ ...base, verificandoNota: true }).length === 1);
  assert(motivosBloqueio({ ...base, falhaVerificacaoNota: true }).length === 1);
  assertEquals(motivosBloqueio({ ...base, bloqueioLimite: "estourou" }), ["estourou"]);
  const comPendencia = plano(XML, { ...DECISOES, 4: { acao: "novo" } }); // item 4 fracionado com erro
  assertEquals(motivosBloqueio({ ...base, resumo: resumirImportacao(comPendencia.resultado, comPendencia.linhas) }), ["Resolva as pendências acima."]);
  const tudoIgnorado = plano(XML, { 1: { acao: "ignorar" }, 2: { acao: "ignorar" }, 3: { acao: "ignorar" }, 4: { acao: "ignorar" }, 6: { acao: "ignorar" } });
  assertEquals(motivosBloqueio({ ...base, resumo: resumirImportacao(tudoIgnorado.resultado, tudoIgnorado.linhas) }), ["Resolva as pendências acima."]);
});

Deno.test("erros da RPC viram mensagens em português, sem detalhe técnico", () => {
  const ja = interpretarErroImportacao({ code: "23505", message: "Esta nota já foi importada nesta loja em 20/10/2026 10:05" });
  assertEquals(ja.tipo, "ja_importada");
  assertEquals(textoJaImportada({ mensagemRpc: ja.mensagem }), "Esta nota já foi importada em 20/10/2026 10:05.");
  assertEquals(interpretarErroImportacao({ code: "23505", message: "duplicate key value violates unique constraint" }).mensagem, "Esta nota já foi importada nesta loja.");
  assertEquals(textoJaImportada({ mensagemRpc: "x" }), "Esta nota já foi importada nesta loja.");

  const trava = interpretarErroImportacao({ code: "42501", message: "Importação de XML em liberação: disponível só para administradores" });
  assertEquals(trava, { tipo: "sem_acesso", mensagem: "Você não tem permissão para importar esta nota nesta loja." });
  assertEquals(interpretarErroImportacao({ code: "42501", message: "Item 3: produto/peça não encontrado nesta loja" }).mensagem,
    "Você não tem permissão para importar esta nota nesta loja. Item 3: produto/peça não encontrado nesta loja.");

  assertEquals(interpretarErroImportacao({ code: "22023", message: "Item 2: a quantidade deve ser um número inteiro entre 1 e 99999" }),
    { tipo: "invalido", mensagem: "Dados inválidos: Item 2: a quantidade deve ser um número inteiro entre 1 e 99999." });

  for (const e of [{ code: "PGRST202", message: "Could not find the function public.importar_nfe_compra(payload) {\"itens\":[]}" }, { code: "XX000", message: "internal" }, null, {}]) {
    const r = interpretarErroImportacao(e);
    assertEquals(r, { tipo: "generico", mensagem: MENSAGEM_ERRO_GENERICO });
    assert(!r.mensagem.includes("{"), "nunca mostra payload/JSON");
  }
});

Deno.test("upload: objeto que já existe conta como sucesso; outros erros não", () => {
  assert(erroUploadEhObjetoExistente({ message: "The resource already exists", status: 400, statusCode: "409" }));
  assert(erroUploadEhObjetoExistente({ message: "Duplicate", status: 409 }));
  assert(!erroUploadEhObjetoExistente({ message: "new row violates row-level security policy", status: 403, statusCode: "403" }));
  assert(!erroUploadEhObjetoExistente({ message: "Failed to fetch" }));
  assert(!erroUploadEhObjetoExistente(null));
  assertEquals(caminhoXmlCompra("00000000-0000-4000-8000-0000000000a1", "3".repeat(44)), `00000000-0000-4000-8000-0000000000a1/${"3".repeat(44)}.xml`);
});

Deno.test("retorno da RPC e data em Brasília", () => {
  assertEquals(lerRetornoImportacao({ importacao_id: "x", itens: 4, vinculados: 2, novos: 2, unidades: 42, custo_total_centavos: 24400, xml_anexado: true }),
    { importacaoId: "x", itens: 4, vinculados: 2, novos: 2, unidades: 42, custoTotalCentavos: 24400, xmlAnexado: true });
  assertEquals(lerRetornoImportacao(null), null);
  assertEquals(lerRetornoImportacao({ importacao_id: "x" }), null);
  assertEquals(formatarDataHoraBrasilia("2026-10-20T02:30:00Z"), "19/10/2026 23:30");
  assertEquals(formatarDataHoraBrasilia("2026-10-20T13:05:00.123456+00:00"), "20/10/2026 10:05");
});
