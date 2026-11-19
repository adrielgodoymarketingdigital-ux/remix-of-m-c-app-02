// deno test -A --no-check --config scripts/testes-recibo-legal/deno.json scripts/testes-recibo-legal/
// IMEI 2 no recibo legal de compra (aparelho dual SIM).
// 1) Regras puras das linhas de IMEI (0, 1 e 2 IMEIs, vazio, espaços, iguais, longo).
// 2) Compra SEM IMEI 2: o PDF desta branch é byte a byte igual ao da origin/main
//    (REFERENCIA), com relógio fixo, ignorando só /CreationDate e /ID.
// 3) Compra COM IMEI 2: a lista de textos é a de antes com a linha "IMEI 2: ..."
//    logo depois de "IMEI: ...", e texto longo quebra sem passar da margem.
// 4) O orquestrador leva o imei2 do cadastro do aparelho (select * de dispositivos).
// Dados fictícios; Supabase trocado por stub que explode se for usado.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { FakeTime } from "jsr:@std/testing@1/time";
import { fromFileUrl, join } from "jsr:@std/path@1";
import jsPDF from "jspdf";
import { gerarReciboLegalPDF } from "../../src/lib/gerarReciboLegalPDF.ts";
import { linhasImeiRecibo, quebrarLinhasQueNaoCabem } from "../../src/lib/origem/linhasImeiRecibo.ts";
import { gerarEBaixarReciboLegal, type DependenciasReciboLegal } from "../../src/lib/origem/gerarEBaixarReciboLegal.ts";
import { REGRAS_DETALHES_COMPRA } from "../../src/lib/origem/regrasReciboLegal.ts";

// Último commit da origin/main que mexeu em src/lib/gerarReciboLegalPDF.ts antes do IMEI 2.
const REFERENCIA = "9bbc7da40642a89f015964bb5b6cb6c8387af061";
const AQUI = fromFileUrl(new URL(".", import.meta.url));
const RELOGIO = new Date("2026-11-19T15:00:00Z").getTime();

// Mesma largura do gerador: margemDireita - margemEsquerda - 5 (mm).
const LARGURA_TEXTO = 195 - 15 - 5;

async function carregarReferencia(): Promise<typeof gerarReciboLegalPDF> {
  const git = new Deno.Command("git", { args: ["--no-pager", "show", `${REFERENCIA}:src/lib/gerarReciboLegalPDF.ts`], cwd: AQUI });
  const { code, stdout, stderr } = await git.output();
  if (code !== 0) throw new Error(new TextDecoder().decode(stderr));
  const arquivo = join(AQUI, `.referencia-imei-${Date.now()}.ts`);
  await Deno.writeFile(arquivo, stdout);
  try {
    return (await import(`file://${arquivo}`)).gerarReciboLegalPDF;
  } finally {
    await Deno.remove(arquivo);
  }
}

const normalizar = (pdf: string) =>
  pdf
    .replace(/\/CreationDate \(D:[^)]*\)/g, "/CreationDate (X)")
    .replace(/\/ID \[ <[0-9A-Fa-f]+> <[0-9A-Fa-f]+> \]/g, "/ID [X]");

/** Textos do PDF na ordem em que foram escritos: [x, y, texto] em pontos. */
function textosDoPdf(pdf: string): { x: number; y: number; texto: string }[] {
  const out: { x: number; y: number; texto: string }[] = [];
  // y pode sair negativo: texto abaixo do fim da página (ver pendência das assinaturas digitais).
  const re = /(-?[\d.]+) (-?[\d.]+) Td\n\((.*)\) Tj/g;
  for (const m of pdf.matchAll(re)) out.push({ x: Number(m[1]), y: Number(m[2]), texto: m[3] });
  return out;
}

const LOJA = { razao_social: "Loja Teste LTDA", email: "loja@teste.invalid", nome_loja: "Loja Teste Ficticia", cnpj: "00.000.000/0001-00", telefone: "(11) 90000-0000", logradouro: "Rua Exemplo", numero: "100", bairro: "Centro", cidade: "Cidade Teste", estado: "SP", cep: "00000-000" };
const VENDEDOR = { nome: "Fulano de Teste", tipo: "fisica" as const, cpf_cnpj: "000.000.000-00", telefone: "(11) 91111-1111" };
const DISP = { tipo: "celular", marca: "Marca X", modelo: "Modelo Y", cor: "Preto", capacidade_gb: 128, condicao: "usado", numero_serie: "SERIE-FICT-01" };
// Sem assinatura_*_data: assim o gerador usa new Date() e o relógio fixo entra na prova.
const COMPRA = { id: "00000000-0000-0000-0000-000000000009", data_compra: "2026-11-10T14:30:00", valor_pago: 900, forma_pagamento: "pix", condicao_aparelho: "usado", assinatura_vendedor: "x", assinatura_cliente: "x" };

type Disp = Record<string, unknown>;
async function gerar(fn: typeof gerarReciboLegalPDF, dispositivo: Disp): Promise<string> {
  const w = console.warn;
  const e = console.error;
  console.warn = () => {};
  console.error = () => {};
  try {
    const doc = await fn({ loja: LOJA, vendedor: VENDEDOR, dispositivo, compra: COMPRA } as Parameters<typeof gerarReciboLegalPDF>[0]);
    return doc.output();
  } finally {
    console.warn = w;
    console.error = e;
  }
}

// ---------------- 1) regras puras ----------------

Deno.test("linhas: 0, 1 e 2 IMEIs", () => {
  assertEquals(linhasImeiRecibo(undefined, undefined), []);
  assertEquals(linhasImeiRecibo(null, null), []);
  assertEquals(linhasImeiRecibo("", ""), []);
  assertEquals(linhasImeiRecibo("351234567890123"), ["IMEI: 351234567890123"]);
  assertEquals(linhasImeiRecibo("351234567890123", null), ["IMEI: 351234567890123"]);
  assertEquals(linhasImeiRecibo("351234567890123", "359876543210987"), ["IMEI: 351234567890123", "IMEI 2: 359876543210987"]);
});

Deno.test("linhas: IMEI 2 vazio ou só espaços não sai; com espaços em volta sai aparado", () => {
  assertEquals(linhasImeiRecibo("351234567890123", ""), ["IMEI: 351234567890123"]);
  assertEquals(linhasImeiRecibo("351234567890123", "   "), ["IMEI: 351234567890123"]);
  assertEquals(linhasImeiRecibo("351234567890123", "\t \n"), ["IMEI: 351234567890123"]);
  assertEquals(linhasImeiRecibo("351234567890123", "  359876543210987 "), ["IMEI: 351234567890123", "IMEI 2: 359876543210987"]);
});

Deno.test("linhas: IMEI 1 segue a regra antiga (sem aparar) para não mudar o PDF de hoje", () => {
  assertEquals(linhasImeiRecibo("  "), ["IMEI:   "]);
  assertEquals(linhasImeiRecibo(" 351 "), ["IMEI:  351 "]);
});

Deno.test("linhas: IMEI 2 igual ao IMEI sai também (o recibo mostra o cadastro)", () => {
  assertEquals(linhasImeiRecibo("351234567890123", "351234567890123"), ["IMEI: 351234567890123", "IMEI 2: 351234567890123"]);
});

Deno.test("linhas: só IMEI 2 cadastrado sai como IMEI 2", () => {
  assertEquals(linhasImeiRecibo(null, "359876543210987"), ["IMEI 2: 359876543210987"]);
  assertEquals(linhasImeiRecibo("", "359876543210987"), ["IMEI 2: 359876543210987"]);
});

Deno.test("quebra: linha que cabe não passa pelo splitTextToSize; a longa quebra", () => {
  const quebradas: string[] = [];
  const medir = (t: string) => t.length; // 1 unidade por caractere
  const quebrar = (t: string, l: number) => {
    quebradas.push(t);
    const out: string[] = [];
    for (let i = 0; i < t.length; i += l) out.push(t.slice(i, i + l));
    return out;
  };
  assertEquals(quebrarLinhasQueNaoCabem(["IMEI: 1", "IMEI 2: 2"], 10, medir, quebrar), ["IMEI: 1", "IMEI 2: 2"]);
  assertEquals(quebradas, []);
  assertEquals(quebrarLinhasQueNaoCabem(["IMEI: 1", "IMEI 2: 123456789"], 10, medir, quebrar), ["IMEI: 1", "IMEI 2: 12", "3456789"]);
  assertEquals(quebradas, ["IMEI 2: 123456789"]);
  // exatamente na largura: não quebra
  assertEquals(quebrarLinhasQueNaoCabem(["0123456789"], 10, medir, quebrar), ["0123456789"]);
});

// ---------------- 2) sem IMEI 2: PDF igual ao de antes ----------------

const SEM_IMEI2: Record<string, Disp> = {
  "1 IMEI, imei2 ausente": { ...DISP, imei: "351234567890123" },
  "1 IMEI, imei2 undefined": { ...DISP, imei: "351234567890123", imei2: undefined },
  "1 IMEI, imei2 vazio": { ...DISP, imei: "351234567890123", imei2: "" },
  "1 IMEI, imei2 só espaços": { ...DISP, imei: "351234567890123", imei2: "   " },
  "sem IMEI nenhum": { ...DISP },
  "IMEI vazio": { ...DISP, imei: "" },
  "IMEI só espaços (sai como hoje)": { ...DISP, imei: "   " },
  "sem série, sem cor, com IMEI": { tipo: "celular", marca: "M", modelo: "N", condicao: "novo", imei: "351234567890123" },
};

Deno.test("sem IMEI 2: PDF byte a byte igual ao da origin/main (relógio fixo)", async () => {
  const referencia = await carregarReferencia();
  const relogio = new FakeTime(RELOGIO);
  try {
    for (const [nome, disp] of Object.entries(SEM_IMEI2)) {
      const antes = await gerar(referencia, disp);
      const depois = await gerar(gerarReciboLegalPDF, disp);
      assert(antes.length > 1000, nome);
      assertEquals(textosDoPdf(depois), textosDoPdf(antes), `textos diferentes em "${nome}"`);
      assertEquals(normalizar(depois), normalizar(antes), `PDF diferente em "${nome}"`);
    }
  } finally {
    relogio.restore();
  }
});

Deno.test("o relógio fixo entra no PDF (a prova não depende da hora)", async () => {
  const pdf = await (async () => {
    const r = new FakeTime(RELOGIO);
    try { return await gerar(gerarReciboLegalPDF, SEM_IMEI2["1 IMEI, imei2 ausente"]); } finally { r.restore(); }
  })();
  const d = new Date(RELOGIO);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  assert(textosDoPdf(pdf).some((t) => t.texto.startsWith(`Data: ${dd}/${mm}/${d.getFullYear()}`)));
});

// ---------------- 3) com IMEI 2 ----------------

Deno.test("com IMEI 2: mesma lista de textos de antes + 'IMEI 2' logo abaixo do IMEI", async () => {
  const referencia = await carregarReferencia();
  const relogio = new FakeTime(RELOGIO);
  try {
    const disp = { ...DISP, imei: "351234567890123", imei2: "359876543210987" };
    const antes = textosDoPdf(await gerar(referencia, disp));
    const depois = textosDoPdf(await gerar(gerarReciboLegalPDF, disp));
    const i = depois.findIndex((t) => t.texto === "IMEI: 351234567890123");
    assert(i >= 0);
    assertEquals(depois[i + 1].texto, "IMEI 2: 359876543210987");
    assertEquals(depois[i + 1].x, depois[i].x, "mesma margem");
    // 5 mm abaixo (pontos: 5 * 72 / 25.4)
    assert(Math.abs(depois[i].y - depois[i + 1].y - (5 * 72) / 25.4) < 0.01);
    assertEquals(depois[i + 2].texto, "Número de Série: SERIE-FICT-01");
    // Tirando a linha nova, os textos são os mesmos e na mesma ordem.
    assertEquals(depois.filter((_, k) => k !== i + 1).map((t) => t.texto), antes.map((t) => t.texto));
  } finally {
    relogio.restore();
  }
});

Deno.test("com IMEI 2 igual ao IMEI: saem as duas linhas", async () => {
  const pdf = textosDoPdf(await gerar(gerarReciboLegalPDF, { ...DISP, imei: "351234567890123", imei2: "351234567890123" }));
  const textos = pdf.map((t) => t.texto);
  assert(textos.includes("IMEI: 351234567890123"));
  assert(textos.includes("IMEI 2: 351234567890123"));
});

Deno.test("só IMEI 2 no cadastro: sai 'IMEI 2' e nenhuma linha 'IMEI:'", async () => {
  const textos = textosDoPdf(await gerar(gerarReciboLegalPDF, { ...DISP, imei2: "359876543210987" })).map((t) => t.texto);
  assert(textos.includes("IMEI 2: 359876543210987"));
  assert(!textos.some((t) => t.startsWith("IMEI: ")));
});

Deno.test("texto longo: quebra em várias linhas, nenhuma passa da margem e nada se perde", async () => {
  const medidor = new jsPDF();
  medidor.setFont("helvetica", "normal");
  medidor.setFontSize(9);
  const longos: Record<string, string> = {
    "sem espaços": "9".repeat(150),
    "com espaços": Array.from({ length: 30 }, (_, k) => `IMEI${k}`).join(" "),
  };
  for (const [nome, imei2] of Object.entries(longos)) {
    assert(medidor.getTextWidth(`IMEI 2: ${imei2}`) > LARGURA_TEXTO, `${nome}: o texto precisa ser maior que a linha`);
    const textos = textosDoPdf(await gerar(gerarReciboLegalPDF, { ...DISP, imei: "351234567890123", imei2 }));
    const i = textos.findIndex((t) => t.texto.startsWith("IMEI 2: "));
    const j = textos.findIndex((t) => t.texto.startsWith("Número de Série: "));
    const pedacos = textos.slice(i, j).map((t) => t.texto);
    assert(pedacos.length >= 2, `${nome}: quebrou`);
    for (const p of pedacos) assert(medidor.getTextWidth(p) <= LARGURA_TEXTO + 0.01, `${nome}: "${p}" passa da margem`);
    assertEquals(pedacos.join("").replace(/\s/g, ""), `IMEI 2: ${imei2}`.replace(/\s/g, ""), `${nome}: nada se perde`);
    // linhas consecutivas, 5 mm cada
    for (let k = i + 1; k <= j; k++) assert(Math.abs(textos[k - 1].y - textos[k].y - (5 * 72) / 25.4) < 0.01, `${nome}: espaçamento`);
  }
});

// ---------------- 4) orquestrador ----------------

Deno.test("orquestrador: o imei2 do cadastro do aparelho chega ao PDF", async () => {
  const capturados: Parameters<typeof gerarReciboLegalPDF>[0][] = [];
  const deps: DependenciasReciboLegal = {
    buscarCompra: async () => ({
      compra: { id: "c-imei", dispositivo_id: "d-imei", pessoa_id: "p1", data_compra: "2026-11-10T14:30:00", valor_pago: 1, forma_pagamento: "pix", origem_pessoas: { id: "p1", nome: "Fulano", tipo: "fisica", cpf_cnpj: "000.000.000-00" }, fotos: [] } as never,
      dispositivo: { id: "d-imei", tipo: "celular", marca: "M", modelo: "N", condicao: "usado", imei: "351234567890123", imei2: "359876543210987" },
    }),
    buscarLoja: async () => LOJA,
    carregarImagens: async () => ({ fotos: [], documentoFrente: null, documentoVerso: null, resumoFotos: { total: 0, falhas: 0 }, resumoDocumentos: { total: 0, falhas: 0 }, fotosIgnoradas: 0 }) as never,
    gerarPdf: async (d) => { capturados.push(d); return gerarReciboLegalPDF(d); },
    salvar: async () => "https://storage.falso/x.pdf",
    atualizarTermo: async () => 1,
  };
  await gerarEBaixarReciboLegal("c-imei", deps, REGRAS_DETALHES_COMPRA);
  assertEquals(capturados[0].dispositivo.imei, "351234567890123");
  assertEquals(capturados[0].dispositivo.imei2, "359876543210987");
});

Deno.test("orquestrador: imei2 null no banco vira undefined (PDF como antes)", async () => {
  const capturados: Parameters<typeof gerarReciboLegalPDF>[0][] = [];
  const deps: DependenciasReciboLegal = {
    buscarCompra: async () => ({
      compra: { id: "c-imei-2", dispositivo_id: "d", pessoa_id: "p1", data_compra: "2026-11-10T14:30:00", valor_pago: 1, forma_pagamento: "pix", origem_pessoas: { id: "p1", nome: "Fulano", tipo: "fisica", cpf_cnpj: "000.000.000-00" }, fotos: [] } as never,
      dispositivo: { id: "d", tipo: "celular", marca: "M", modelo: "N", condicao: "usado", imei: "351234567890123", imei2: null },
    }),
    buscarLoja: async () => LOJA,
    carregarImagens: async () => ({ fotos: [], documentoFrente: null, documentoVerso: null, resumoFotos: { total: 0, falhas: 0 }, resumoDocumentos: { total: 0, falhas: 0 }, fotosIgnoradas: 0 }) as never,
    gerarPdf: async (d) => { capturados.push(d); return gerarReciboLegalPDF(d); },
    salvar: async () => "https://storage.falso/y.pdf",
    atualizarTermo: async () => 1,
  };
  await gerarEBaixarReciboLegal("c-imei-2", deps, REGRAS_DETALHES_COMPRA);
  assertEquals(capturados[0].dispositivo.imei2, undefined);
});
