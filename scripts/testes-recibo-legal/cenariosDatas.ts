// Cenários fictícios da hora no recibo legal de compra (datasReciboLegal.test.ts e
// imprimirDatas.ts). Relógio fixo em RELOGIO (12:00 em Brasília).
import { FakeTime } from "jsr:@std/testing@1/time";
import type { gerarReciboLegalPDF } from "../../src/lib/gerarReciboLegalPDF.ts";
import { datasAssinaturaAposCadastro } from "../../src/lib/origem/datasReciboLegal.ts";
import { pngDataUrl } from "./fixtures.ts";

export const RELOGIO = new Date("2026-11-19T15:00:00Z").getTime();
export const FUSOS = ["UTC", "America/Sao_Paulo", "Asia/Tokyo", "America/Manaus"];

const LOJA = { nome_loja: "Loja Teste Ficticia", cnpj: "00.000.000/0001-00", telefone: "(11) 90000-0000", logradouro: "Rua Exemplo", numero: "100", bairro: "Centro", cidade: "Cidade Teste", estado: "SP", cep: "00000-000" };
const VENDEDOR = { nome: "Fulano de Teste", tipo: "fisica" as const, cpf_cnpj: "000.000.000-00", telefone: "(11) 91111-1111" };
const DISP = { tipo: "celular", marca: "Marca X", modelo: "Modelo Y", cor: "Preto", capacidade_gb: 128, condicao: "usado", numero_serie: "SERIE-FICT-01", imei: "351234567890123" };
const ASS = pngDataUrl(60, 20, [0, 0, 0]);

// Linha como o banco devolve: data_compra é date; created_at e assinaturas, timestamptz em UTC.
const COMPRA = {
  id: "00000000-0000-0000-0000-000000000042",
  data_compra: "2026-11-19",
  created_at: "2026-11-19T17:32:41.123456+00:00",
  valor_pago: 900,
  forma_pagamento: "pix",
  condicao_aparelho: "usado",
};
const COM_ASSINATURAS = {
  assinatura_vendedor: ASS,
  assinatura_vendedor_ip: "10.0.0.1",
  assinatura_vendedor_data: "2026-11-19T17:33:05.5+00:00",
  assinatura_cliente: ASS,
  assinatura_cliente_ip: "10.0.0.2",
  assinatura_cliente_data: "2026-11-19T17:33:59+00:00",
};

// Como OrigemDispositivos.handleSubmitCompra monta a compra do PDF logo após o insert.
const linhaInserida = { ...COMPRA, ...COM_ASSINATURAS, assinatura_vendedor_data: "2026-11-19T17:32:40.9+00:00", assinatura_cliente_data: "2026-11-19T17:32:40.9+00:00" };
const formulario = { assinatura_vendedor: ASS, assinatura_vendedor_ip: "10.0.0.1", assinatura_cliente: ASS, assinatura_cliente_ip: "10.0.0.2" };
const aposCadastro = (linha: Record<string, unknown>) => ({
  ...linha,
  fotos: [],
  ...formulario,
  ...datasAssinaturaAposCadastro(formulario, linha, new Date(RELOGIO).toISOString()),
});

export interface Cenario {
  compra: Record<string, unknown>;
  /** Textos de data esperados, na ordem do PDF: Data da compra, assinaturas, "Cidade, data". */
  esperado: string[];
}

export const CENARIOS: Record<string, Cenario> = {
  "compra do mesmo dia": {
    compra: { ...COMPRA, ...COM_ASSINATURAS },
    esperado: ["Data: 19/11/2026 às 14:32", "Data: 19/11/2026 às 14:33:05", "Data: 19/11/2026 às 14:33:59", "Cidade Teste, 19/11/2026 às 14:32"],
  },
  "compra retroativa (outro dia)": {
    compra: { ...COMPRA, data_compra: "2026-11-10" },
    esperado: ["Data: 10/11/2026", "Cidade Teste, 10/11/2026"],
  },
  "sem created_at": {
    compra: { ...COMPRA, created_at: undefined },
    esperado: ["Data: 19/11/2026", "Cidade Teste, 19/11/2026"],
  },
  "cadastro 23:50 em Brasília (já é dia 20 em UTC)": {
    compra: { ...COMPRA, created_at: "2026-11-20T02:50:00+00:00" },
    esperado: ["Data: 19/11/2026 às 23:50", "Cidade Teste, 19/11/2026 às 23:50"],
  },
  "cadastro 00:10 em Brasília, compra do mesmo dia": {
    compra: { ...COMPRA, data_compra: "2026-11-20", created_at: "2026-11-20T03:10:00+00:00" },
    esperado: ["Data: 20/11/2026 às 00:10", "Cidade Teste, 20/11/2026 às 00:10"],
  },
  "cadastro 00:10 em Brasília, compra do dia anterior": {
    compra: { ...COMPRA, created_at: "2026-11-20T03:10:00+00:00" },
    esperado: ["Data: 19/11/2026", "Cidade Teste, 19/11/2026"],
  },
  "assinaturas sem data gravada (vale o agora)": {
    compra: { ...COMPRA, ...COM_ASSINATURAS, assinatura_vendedor_data: undefined, assinatura_cliente_data: undefined },
    esperado: ["Data: 19/11/2026 às 14:32", "Data: 19/11/2026 às 12:00:00", "Data: 19/11/2026 às 12:00:00", "Cidade Teste, 19/11/2026 às 14:32"],
  },
  "sem data_compra (vale o agora)": {
    compra: { ...COMPRA, data_compra: undefined },
    esperado: ["Data: 19/11/2026 às 12:00", "Cidade Teste, 19/11/2026 às 12:00"],
  },
  "recibo logo após cadastrar (OrigemDispositivos)": {
    compra: aposCadastro(linhaInserida),
    esperado: ["Data: 19/11/2026 às 14:32", "Data: 19/11/2026 às 14:32:40", "Data: 19/11/2026 às 14:32:40", "Cidade Teste, 19/11/2026 às 14:32"],
  },
  "após cadastrar, linha sem data de assinatura (vale o agora)": {
    compra: aposCadastro({ ...linhaInserida, assinatura_vendedor_data: null, assinatura_cliente_data: null }),
    esperado: ["Data: 19/11/2026 às 14:32", "Data: 19/11/2026 às 12:00:00", "Data: 19/11/2026 às 12:00:00", "Cidade Teste, 19/11/2026 às 14:32"],
  },
  "com fotos e documentos (layout não muda)": {
    compra: { ...COMPRA, ...COM_ASSINATURAS, fotos: ["a", "b"], documento_vendedor_frente: "f.jpg", documento_vendedor_verso: "https://x/v.pdf", observacoes: "Observação fictícia." },
    esperado: ["Data: 19/11/2026 às 14:32", "Data: 19/11/2026 às 14:33:05", "Data: 19/11/2026 às 14:33:59", "Cidade Teste, 19/11/2026 às 14:32"],
  },
};

const IMAGENS = { fotos: [pngDataUrl(40, 30), pngDataUrl(30, 40)], documentoFrente: pngDataUrl(80, 50), documentoVerso: null };

export async function gerar(fn: typeof gerarReciboLegalPDF, compra: Record<string, unknown>): Promise<string> {
  const w = console.warn;
  console.warn = () => {};
  const relogio = new FakeTime(RELOGIO);
  try {
    const imagens = Array.isArray(compra.fotos) && compra.fotos.length ? IMAGENS : undefined;
    const doc = await fn({ loja: LOJA, vendedor: VENDEDOR, dispositivo: DISP, compra, ...(imagens ? { imagens } : {}) } as Parameters<typeof gerarReciboLegalPDF>[0]);
    return doc.output();
  } finally {
    relogio.restore();
    console.warn = w;
  }
}

// Textos com data no PDF: "Data: ..." (compra e assinaturas) e "Cidade Teste, ..." (local e data).
const RE_TEXTO_DATA = /\(((?:Data: |Cidade Teste, )[^)]*)\) Tj/g;

export const textosDeData = (pdf: string): string[] => [...pdf.matchAll(RE_TEXTO_DATA)].map((m) => m[1]);

/**
 * PDF sem o que muda a cada geração, com cada texto de data trocado por um
 * marcador e sem os números que só dependem do tamanho desses textos (/Length
 * dos streams, posições da tabela xref e startxref). O resto, byte a byte.
 */
export const semDatas = (pdf: string) =>
  pdf
    .replace(/\/CreationDate \(D:[^)]*\)/g, "/CreationDate (X)")
    .replace(/\/ID \[ <[0-9A-Fa-f]+> <[0-9A-Fa-f]+> \]/g, "/ID [X]")
    .replace(RE_TEXTO_DATA, "(<DATA>) Tj")
    .replace(/\/Length \d+\n>>\nstream/g, "/Length X\n>>\nstream")
    .replace(/^\d{10} 00000 n $/gm, "XREF")
    .replace(/startxref\n\d+\n/, "startxref\nX\n");
