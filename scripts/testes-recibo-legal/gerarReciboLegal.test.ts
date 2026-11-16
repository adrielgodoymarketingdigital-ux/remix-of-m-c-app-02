// deno test -A --no-check --config scripts/testes-recibo-legal/deno.json scripts/testes-recibo-legal/
// 1) Sem o parâmetro `imagens`, o PDF do gerador desta branch é byte a byte igual
//    ao da origin/main (REFERENCIA abaixo), ignorando só /CreationDate e /ID.
// 2) Com `imagens`, cada foto/documento preparado vira uma imagem no PDF e o
//    que falhou vira o quadro cinza — sem baixar nada por URL.
// Dados fictícios; Supabase trocado por stub que explode se for usado.
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { fromFileUrl, join } from "jsr:@std/path@1";
import { gerarReciboLegalPDF } from "../../src/lib/gerarReciboLegalPDF.ts";
import { pngDataUrl } from "./fixtures.ts";

// Último commit da origin/main que mexeu em src/lib/gerarReciboLegalPDF.ts.
const REFERENCIA = "3b6e8a7519163d2fb13708fcbc5e9fdeb777b827";
const AQUI = fromFileUrl(new URL(".", import.meta.url));

async function carregarReferencia(): Promise<typeof gerarReciboLegalPDF> {
  const git = new Deno.Command("git", { args: ["--no-pager", "show", `${REFERENCIA}:src/lib/gerarReciboLegalPDF.ts`], cwd: AQUI });
  const { code, stdout, stderr } = await git.output();
  if (code !== 0) throw new Error(new TextDecoder().decode(stderr));
  // Fica na pasta dos testes (para usar o mesmo deno.json) e é apagado no fim.
  const arquivo = join(AQUI, `.referencia-${Date.now()}.ts`);
  await Deno.writeFile(arquivo, stdout);
  try {
    const mod = await import(`file://${arquivo}`);
    return mod.gerarReciboLegalPDF;
  } finally {
    await Deno.remove(arquivo);
  }
}

/** Remove só o que muda a cada geração. */
const normalizar = (pdf: string) =>
  pdf
    .replace(/\/CreationDate \(D:[^)]*\)/g, "/CreationDate (X)")
    .replace(/\/ID \[ <[0-9A-Fa-f]+> <[0-9A-Fa-f]+> \]/g, "/ID [X]");

const contarImagens = (pdf: string) => (pdf.match(/\/Subtype \/Image/g) ?? []).length;

const LOJA = {
  nome_loja: "Loja Teste Ficticia",
  cnpj: "00.000.000/0001-00",
  telefone: "(11) 90000-0000",
  logradouro: "Rua Exemplo",
  numero: "100",
  bairro: "Centro",
  cidade: "Cidade Teste",
  estado: "SP",
  cep: "00000-000",
};
const VENDEDOR = { nome: "Fulano de Teste", tipo: "fisica" as const, cpf_cnpj: "000.000.000-00", rg: "00.000.000-0", telefone: "(11) 91111-1111", endereco: "Rua Ficticia, 1" };
const DISPOSITIVO = { tipo: "celular", marca: "Marca X", modelo: "Modelo Y", cor: "Preto", imei: "000000000000000", capacidade_gb: 128, condicao: "usado" };
const ASSINATURA = pngDataUrl(60, 20, [0, 0, 0]);

const BASE = {
  id: "00000000-0000-0000-0000-000000000001",
  data_compra: "2026-11-10T14:30:00",
  valor_pago: 1234.5,
  forma_pagamento: "pix",
  condicao_aparelho: "usado",
  observacoes: "Observação fictícia de teste.",
};

const CENARIOS: Record<string, Record<string, unknown>> = {
  "sem fotos e sem documentos": { ...BASE },
  "mínimo (sem observações)": { id: BASE.id, data_compra: BASE.data_compra, valor_pago: 10, forma_pagamento: "dinheiro" },
  "com assinaturas (data URL)": {
    ...BASE,
    assinatura_vendedor: ASSINATURA,
    assinatura_vendedor_ip: "10.0.0.1",
    assinatura_vendedor_data: "2026-11-10T14:31:00",
    assinatura_cliente: ASSINATURA,
    assinatura_cliente_ip: "10.0.0.2",
    assinatura_cliente_data: "2026-11-10T14:32:00",
  },
  "fotos como data URL (caminho antigo)": { ...BASE, fotos: [pngDataUrl(40, 30), pngDataUrl(30, 40)] },
  "documentos .pdf simples e imagem": { ...BASE, documento_vendedor_frente: "https://t/rg.pdf", documento_vendedor_verso: pngDataUrl(50, 30) },
  "documento PDF com ?token (regra antiga)": { ...BASE, documento_vendedor_frente: "https://t/sign/rg.pdf?token=abc" },
  "foto vazia na lista": { ...BASE, fotos: ["", pngDataUrl(10, 10)] },
};

const gerar = async (fn: typeof gerarReciboLegalPDF, compra: Record<string, unknown>, imagens?: unknown) =>
  (await fn({ loja: LOJA, vendedor: VENDEDOR, dispositivo: DISPOSITIVO, compra, ...(imagens ? { imagens } : {}) } as Parameters<typeof gerarReciboLegalPDF>[0])).output();

const avisos = console.warn;

Deno.test("sem o parâmetro novo: PDF igual ao da origin/main em todos os cenários", async () => {
  console.warn = () => {};
  try {
    const referencia = await carregarReferencia();
    for (const [nome, compra] of Object.entries(CENARIOS)) {
      const antes = normalizar(await gerar(referencia, compra));
      const depois = normalizar(await gerar(gerarReciboLegalPDF, compra));
      assert(antes.length > 1000, nome);
      assertEquals(depois, antes, `PDF diferente no cenário "${nome}"`);
    }
  } finally {
    console.warn = avisos;
  }
});

Deno.test("a normalização só ignora data e ID (um texto diferente é detectado)", async () => {
  const a = normalizar(await gerar(gerarReciboLegalPDF, CENARIOS["sem fotos e sem documentos"]));
  const b = normalizar(await gerar(gerarReciboLegalPDF, { ...CENARIOS["sem fotos e sem documentos"], valor_pago: 1234.51 }));
  assertNotEquals(a, b);
});

Deno.test("com imagens preparadas: conta imagens, falha vira quadro cinza, não usa URL", async () => {
  console.warn = () => {};
  try {
    const compra = {
      ...BASE,
      // URLs que não existem: se o gerador tentasse baixá-las, viraria quadro cinza e a contagem cairia.
      fotos: ["https://nao.existe/1.jpg", "https://nao.existe/2.jpg", "https://nao.existe/3.jpg"],
      documento_vendedor_frente: "https://nao.existe/rg-frente.jpg?token=a",
      documento_vendedor_verso: "https://nao.existe/sign/rg-verso.pdf?token=b",
    };
    const semParametro = await gerar(gerarReciboLegalPDF, compra);
    assertEquals(contarImagens(semParametro), 0);

    const pdf = await gerar(gerarReciboLegalPDF, compra, {
      fotos: [pngDataUrl(40, 30, [255, 0, 0]), null, pngDataUrl(30, 40, [0, 0, 255])],
      documentoFrente: pngDataUrl(50, 30, [0, 255, 0]),
      documentoVerso: null,
    });
    assertEquals(contarImagens(pdf), 3); // 2 fotos + frente
    assert(pdf.includes("(Foto 2)"), "foto que falhou vira o quadro 'Foto 2'");
    assert(pdf.includes("Verso: [Arquivo PDF - Ver anexo]"), "PDF com ?token reconhecido no caminho novo");
    assert(!pdf.includes("(Foto 1)") && !pdf.includes("(Foto 3)"));
  } finally {
    console.warn = avisos;
  }
});

Deno.test("com imagens preparadas: documento que falhou vira quadro cinza", async () => {
  console.warn = () => {};
  try {
    const pdf = await gerar(
      gerarReciboLegalPDF,
      { ...BASE, documento_vendedor_frente: "https://nao.existe/f.jpg" },
      { fotos: [], documentoFrente: null },
    );
    assertEquals(contarImagens(pdf), 0);
    assert(pdf.includes("(Documento Frente)"));
  } finally {
    console.warn = avisos;
  }
});
