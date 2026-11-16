// deno test -A --no-check --config scripts/testes-recibo-legal/deno.json scripts/testes-recibo-legal/
// Matriz por ponto de geração: a validação de loja, vendedor e dispositivo de cada tela
// tem de ser IGUAL à da origin/main (b44e6a5). As saídas esperadas abaixo foram tiradas
// do código original de cada tela (TabelaDispositivos, CardDispositivo, TabelaCompras,
// DialogVisualizacaoCompra), com os mesmos textos.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  REGRAS_CARTAO_DISPOSITIVO,
  REGRAS_DETALHES_COMPRA,
  REGRAS_LISTA_COMPRAS,
  REGRAS_LISTA_DISPOSITIVOS,
  type FalhaRecibo,
  type RegrasReciboLegal,
} from "../../src/lib/origem/regrasReciboLegal.ts";
import { BloqueioReciboLegal, gerarEBaixarReciboLegal, type DependenciasReciboLegal } from "../../src/lib/origem/gerarEBaixarReciboLegal.ts";
import { gerarReciboLegalPDF } from "../../src/lib/gerarReciboLegalPDF.ts";

type Linha = Record<string, unknown>;

// ---------------- lojas ----------------
const COMPLETA = {
  nome_loja: "Loja Teste", razao_social: "Loja Teste LTDA", cnpj: "00.000.000/0001-00", endereco: "Rua Teste, 1 - Centro",
  telefone: "(11) 3000-0000", email: "loja@teste.invalid", cep: "00000-000", logradouro: "Rua Teste", numero: "1",
  bairro: "Centro", cidade: "Cidade Teste", estado: "SP",
};
const LOJAS: Record<string, Linha | null> = {
  completa: COMPLETA,
  sem_cnpj: { ...COMPLETA, cnpj: "" },
  sem_email_e_cep: { ...COMPLETA, email: "", cep: null },
  sem_endereco_unico: { ...COMPLETA, endereco: null }, // só o endereço por partes (comum hoje)
  so_espacos_no_nome: { ...COMPLETA, nome_loja: "   " },
  inexistente: null,
};

const PADRAO_FALTA: Record<string, string> = {
  sem_email_e_cep: "E-mail, CEP",
  so_espacos_no_nome: "Nome da loja",
};
const LD_FALTA: Record<string, string> = {
  sem_cnpj: "CNPJ",
  sem_endereco_unico: "Endereço",
  inexistente: "Nome da loja, Razão social, CNPJ, Endereço, Telefone",
};

/** Saída esperada por ponto e por loja (null = passa). */
const ESPERADO_LOJA: Record<RegrasReciboLegal["ponto"], Record<string, FalhaRecibo | null>> = {
  lista_dispositivos: Object.fromEntries(Object.keys(LOJAS).map((k) => [k, LD_FALTA[k]
    ? { titulo: "Dados da loja incompletos", descricao: `Por favor, complete os seguintes campos nas configurações: ${LD_FALTA[k]}` }
    : null])),
  cartao_dispositivo: Object.fromEntries(Object.keys(LOJAS).map((k) => {
    const falta = k === "inexistente" ? "Configuração não encontrada" : PADRAO_FALTA[k];
    return [k, falta ? { titulo: "Dados da loja incompletos", descricao: `Complete os seguintes campos: ${falta}. Acesse Configurações para preencher.` } : null];
  })),
  lista_compras: Object.fromEntries(Object.keys(LOJAS).map((k) => {
    if (k === "inexistente") return [k, { titulo: "Configure os dados da loja primeiro" }];
    const falta = PADRAO_FALTA[k];
    return [k, falta ? { titulo: `Complete os dados da loja antes de gerar recibos. Faltam: ${falta}`, configurar: true } : null];
  })),
  detalhes_compra: Object.fromEntries(Object.keys(LOJAS).map((k) => {
    if (k === "inexistente") return [k, { titulo: "Erro ao buscar configuração", descricao: "Não foi possível encontrar as configurações da loja. Configure os dados da loja primeiro." }];
    const falta = PADRAO_FALTA[k];
    return [k, falta ? { titulo: "Dados da loja incompletos", descricao: `Por favor, complete os seguintes campos nas configurações: ${falta}. Clique para configurar.` } : null];
  })),
};

// ---------------- vendedores ----------------
const pessoa = (extra: Linha) => ({ id: "p1", nome: "Pessoa Teste", tipo: "fisica", cpf_cnpj: "000.000.000-00", ...extra });
const VENDEDORES: Record<string, Linha> = {
  pessoa_completa: { pessoa_id: "p1", origem_pessoas: pessoa({}), fornecedor_id: null, fornecedores: null },
  pessoa_sem_cpf: { pessoa_id: "p1", origem_pessoas: pessoa({ cpf_cnpj: null }), fornecedor_id: null, fornecedores: null },
  pessoa_sem_nome: { pessoa_id: "p1", origem_pessoas: pessoa({ nome: "" }), fornecedor_id: null, fornecedores: null },
  fornecedor_sem_cpf: { pessoa_id: null, origem_pessoas: null, fornecedor_id: "f1", fornecedores: { nome: "Fornecedor Teste" } },
  fornecedor_sem_nome: { pessoa_id: null, origem_pessoas: null, fornecedor_id: "f1", fornecedores: null },
  nenhum: { pessoa_id: null, origem_pessoas: null, fornecedor_id: null, fornecedores: null },
  pessoa_apagada: { pessoa_id: "p1", origem_pessoas: null, fornecedor_id: null, fornecedores: null },
};
const BLOQ_NOME_CPF: FalhaRecibo = { titulo: "Dados do vendedor incompletos", descricao: "Por favor, complete os dados do vendedor (Nome e CPF/CNPJ)" };
/** string = passa com esse nome no recibo; objeto = bloqueia com essa mensagem. */
const ESPERADO_VENDEDOR: Record<RegrasReciboLegal["ponto"], Record<string, string | FalhaRecibo>> = {
  lista_dispositivos: { pessoa_completa: "Pessoa Teste", pessoa_sem_cpf: BLOQ_NOME_CPF, pessoa_sem_nome: BLOQ_NOME_CPF, fornecedor_sem_cpf: BLOQ_NOME_CPF, fornecedor_sem_nome: BLOQ_NOME_CPF, nenhum: BLOQ_NOME_CPF, pessoa_apagada: BLOQ_NOME_CPF },
  cartao_dispositivo: { pessoa_completa: "Pessoa Teste", pessoa_sem_cpf: BLOQ_NOME_CPF, pessoa_sem_nome: BLOQ_NOME_CPF, fornecedor_sem_cpf: BLOQ_NOME_CPF, fornecedor_sem_nome: BLOQ_NOME_CPF, nenhum: BLOQ_NOME_CPF, pessoa_apagada: BLOQ_NOME_CPF },
  // TabelaCompras: `compra.origem_pessoas || { nome: fornecedores?.nome || "Vendedor não identificado" }` — nunca bloqueia.
  lista_compras: { pessoa_completa: "Pessoa Teste", pessoa_sem_cpf: "Pessoa Teste", pessoa_sem_nome: "", fornecedor_sem_cpf: "Fornecedor Teste", fornecedor_sem_nome: "Vendedor não identificado", nenhum: "Vendedor não identificado", pessoa_apagada: "Vendedor não identificado" },
  detalhes_compra: {
    pessoa_completa: "Pessoa Teste",
    pessoa_sem_cpf: "Pessoa Teste",
    pessoa_sem_nome: { titulo: "Dados do vendedor incompletos", descricao: "Por favor, complete o nome do vendedor" },
    fornecedor_sem_cpf: "Fornecedor Teste",
    fornecedor_sem_nome: "Fornecedor não identificado",
    nenhum: { titulo: "Erro", descricao: "Compra sem pessoa ou fornecedor associado" },
    pessoa_apagada: { titulo: "Erro ao buscar vendedor", descricao: "Não foi possível encontrar os dados do vendedor" },
  },
};

// ---------------- dispositivos ----------------
const DISP_OK = { id: "d1", empresa_id: "E-disp", tipo: "celular", marca: "Marca X", modelo: "Modelo Y", condicao: "usado" };
const DISPOSITIVOS: Record<string, Linha> = {
  completo: DISP_OK,
  sem_marca_e_tipo: { ...DISP_OK, marca: null, tipo: "" },
  sem_modelo: { ...DISP_OK, modelo: "" },
};
const ESPERADO_DISP: Record<RegrasReciboLegal["ponto"], Record<string, FalhaRecibo | null>> = {
  lista_dispositivos: { completo: null, sem_marca_e_tipo: null, sem_modelo: null },
  cartao_dispositivo: { completo: null, sem_marca_e_tipo: null, sem_modelo: null },
  lista_compras: { completo: null, sem_marca_e_tipo: null, sem_modelo: null },
  detalhes_compra: {
    completo: null,
    sem_marca_e_tipo: { titulo: "Dados do dispositivo incompletos", descricao: "Por favor, complete os seguintes campos: Marca, Tipo" },
    sem_modelo: { titulo: "Dados do dispositivo incompletos", descricao: "Por favor, complete os seguintes campos: Modelo" },
  },
};

const PONTOS: RegrasReciboLegal[] = [REGRAS_LISTA_DISPOSITIVOS, REGRAS_CARTAO_DISPOSITIVO, REGRAS_LISTA_COMPRAS, REGRAS_DETALHES_COMPRA];

// ---------------- 1) regras isoladas ----------------
for (const regras of PONTOS) {
  Deno.test(`[${regras.ponto}] loja: bloqueia e passa exatamente como antes`, () => {
    for (const [nome, loja] of Object.entries(LOJAS)) {
      assertEquals(regras.validarLoja(loja), ESPERADO_LOJA[regras.ponto][nome], `${regras.ponto} / loja ${nome}`);
    }
  });
  Deno.test(`[${regras.ponto}] vendedor: bloqueia e passa exatamente como antes`, () => {
    for (const [nome, v] of Object.entries(VENDEDORES)) {
      const r = regras.resolverVendedor({ id: "c1", ...v } as never);
      const esperado = ESPERADO_VENDEDOR[regras.ponto][nome];
      if (typeof esperado === "string") {
        assert("vendedor" in r, `${regras.ponto} / ${nome}: devia passar`);
        assertEquals(r.vendedor.nome, esperado, `${regras.ponto} / ${nome}`);
      } else {
        assert("falha" in r, `${regras.ponto} / ${nome}: devia bloquear`);
        assertEquals(r.falha, esperado, `${regras.ponto} / ${nome}`);
      }
    }
  });
  Deno.test(`[${regras.ponto}] dispositivo: só o diálogo de detalhes valida Marca/Modelo/Tipo`, () => {
    for (const [nome, d] of Object.entries(DISPOSITIVOS)) {
      assertEquals(regras.validarDispositivo(d as never), ESPERADO_DISP[regras.ponto][nome], `${regras.ponto} / ${nome}`);
    }
  });
}

// ---------------- 2) pelo orquestrador (de ponta a ponta, sem gravar) ----------------
function montar(compra: Linha, loja: Linha | null, dispositivo: Linha = DISP_OK) {
  const chamadas = { salvar: 0, atualizar: 0, lojaDe: [] as (string | null)[], pdfs: [] as string[] };
  const deps: DependenciasReciboLegal = {
    buscarCompra: async () => ({ compra: compra as never, dispositivo: dispositivo as never }),
    buscarLoja: async (empresa) => { chamadas.lojaDe.push(empresa); return loja; },
    carregarImagens: async () => ({ fotos: [], documentoFrente: null, documentoVerso: null, fotosIgnoradas: 0, resumoFotos: { total: 0, falhas: 0, porMotivo: {} }, resumoDocumentos: { total: 0, falhas: 0, porMotivo: {} } }),
    gerarPdf: gerarReciboLegalPDF,
    salvar: async (pdf) => { chamadas.salvar++; chamadas.pdfs.push(pdf.output()); return "https://storage.falso/novo.pdf"; },
    atualizarTermo: async () => { chamadas.atualizar++; return 1; },
  };
  return { deps, chamadas };
}
const compraCom = (vendedor: string) => ({ id: "c1", empresa_id: "E-compra", dispositivo_id: "d1", data_compra: "2026-11-10", valor_pago: 10, forma_pagamento: "pix", fotos: [], termo_pdf_url: null, ...VENDEDORES[vendedor] });

for (const regras of PONTOS) {
  Deno.test(`[${regras.ponto}] orquestrador: matriz loja × vendedor — bloqueado não grava, liberado gera`, async () => {
    for (const nomeLoja of Object.keys(LOJAS)) {
      for (const nomeVend of Object.keys(VENDEDORES)) {
        const { deps, chamadas } = montar(compraCom(nomeVend), LOJAS[nomeLoja]);
        const falhaLoja = ESPERADO_LOJA[regras.ponto][nomeLoja];
        const vend = ESPERADO_VENDEDOR[regras.ponto][nomeVend];
        // Mesma ordem das telas: loja primeiro, depois vendedor.
        const esperado = falhaLoja ?? (typeof vend === "string" ? null : vend);
        const caso = `${regras.ponto} / loja ${nomeLoja} / vendedor ${nomeVend}`;
        let obtido: FalhaRecibo | null = null;
        try {
          await gerarEBaixarReciboLegal(`c-${regras.ponto}-${nomeLoja}-${nomeVend}`, deps, regras);
        } catch (e) {
          if (!(e instanceof BloqueioReciboLegal)) throw e;
          obtido = e.falha;
        }
        assertEquals(obtido, esperado, caso);
        assertEquals(chamadas.salvar, esperado ? 0 : 1, `${caso}: gravou?`);
        assertEquals(chamadas.atualizar, esperado ? 0 : 1, `${caso}: atualizou?`);
      }
    }
  });

  Deno.test(`[${regras.ponto}] orquestrador: filial da loja vem de onde a tela pegava`, async () => {
    const { deps, chamadas } = montar(compraCom("pessoa_completa"), COMPLETA);
    await gerarEBaixarReciboLegal(`c-filial-${regras.ponto}`, deps, regras);
    assertEquals(chamadas.lojaDe, [regras.ponto === "lista_dispositivos" || regras.ponto === "cartao_dispositivo" ? "E-disp" : "E-compra"]);
  });

  Deno.test(`[${regras.ponto}] orquestrador: loja no PDF como a tela mandava`, async () => {
    const { deps, chamadas } = montar(compraCom("pessoa_completa"), COMPLETA);
    await gerarEBaixarReciboLegal(`c-pdf-${regras.ponto}`, deps, regras);
    const temCidade = chamadas.pdfs[0].includes("Cidade Teste/SP");
    // Detalhes mandava só nome, razão social, CNPJ, endereço e telefone.
    assertEquals(temCidade, regras.ponto !== "detalhes_compra", "endereço por partes no PDF");
    assert(chamadas.pdfs[0].includes("Rua Teste, 1 - Centro") || chamadas.pdfs[0].includes("Rua Teste, 1"), "algum endereço");
  });
}

Deno.test("[detalhes_compra] orquestrador: dispositivo incompleto bloqueia depois de loja e vendedor", async () => {
  const { deps, chamadas } = montar(compraCom("pessoa_completa"), COMPLETA, DISPOSITIVOS.sem_marca_e_tipo);
  let falha: FalhaRecibo | null = null;
  try { await gerarEBaixarReciboLegal("c-disp-detalhes", deps, REGRAS_DETALHES_COMPRA); } catch (e) { falha = (e as BloqueioReciboLegal).falha; }
  assertEquals(falha, ESPERADO_DISP.detalhes_compra.sem_marca_e_tipo);
  assertEquals(chamadas.salvar, 0);
  // Nas outras telas o mesmo dispositivo passa (elas não validavam).
  for (const regras of [REGRAS_LISTA_DISPOSITIVOS, REGRAS_CARTAO_DISPOSITIVO, REGRAS_LISTA_COMPRAS]) {
    const m = montar(compraCom("pessoa_completa"), COMPLETA, DISPOSITIVOS.sem_marca_e_tipo);
    await gerarEBaixarReciboLegal(`c-disp-${regras.ponto}`, m.deps, regras);
    assertEquals(m.chamadas.salvar, 1, regras.ponto);
  }
});

Deno.test("mensagens de erro inesperado iguais às de cada tela", () => {
  assertEquals(REGRAS_LISTA_DISPOSITIVOS.falhaInesperada(undefined), { titulo: "Erro ao gerar recibo", descricao: "Erro desconhecido" });
  assertEquals(REGRAS_CARTAO_DISPOSITIVO.falhaInesperada("x"), { titulo: "Erro ao gerar recibo", descricao: "x" });
  assertEquals(REGRAS_LISTA_COMPRAS.falhaInesperada(undefined), { titulo: "Erro ao gerar recibo" });
  assertEquals(REGRAS_LISTA_COMPRAS.falhaInesperada("x"), { titulo: "x" });
  assertEquals(REGRAS_DETALHES_COMPRA.falhaInesperada(undefined), { titulo: "Erro ao gerar recibo", descricao: "Erro ao gerar recibo legal" });
  assertEquals(REGRAS_LISTA_DISPOSITIVOS.falhaCompraNaoEncontrada, { titulo: "Erro", descricao: "Não foi possível encontrar os dados da compra" });
  assertEquals(REGRAS_CARTAO_DISPOSITIVO.falhaCompraNaoEncontrada, { titulo: "Erro", descricao: "Não foi possível encontrar os dados da compra" });
  assertEquals(REGRAS_LISTA_COMPRAS.falhaDispositivoNaoEncontrado, { titulo: "Erro ao buscar dados do dispositivo" });
  assertEquals(REGRAS_DETALHES_COMPRA.falhaDispositivoNaoEncontrado, { titulo: "Erro ao buscar dispositivo", descricao: "Não foi possível encontrar os dados do dispositivo" });
});
