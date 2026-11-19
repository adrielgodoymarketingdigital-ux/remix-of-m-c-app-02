// deno test -A --no-check --config scripts/testes-recibo-legal/deno.json scripts/testes-recibo-legal/
// Paginação do recibo legal de compra: bloco de altura fixa (assinaturas digitais,
// linhas de IMEI) quebra a página só quando não cabe na folha.
// - Recibo que hoje cabe na folha: PDF byte a byte igual ao da origin/main
//   (REFERENCIA), com relógio fixo — inclusive o caso de 296 mm.
// - Com IMEI 2 (e qualquer deslocamento): todo texto e toda imagem dentro da folha,
//   e nenhum texto some (mesma lista de textos da referência, mais o IMEI 2).
// Dados fictícios; Supabase trocado por stub que explode se for usado.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { FakeTime } from "jsr:@std/testing@1/time";
import { fromFileUrl, join } from "jsr:@std/path@1";
import { gerarReciboLegalPDF } from "../../src/lib/gerarReciboLegalPDF.ts";
import { pngDataUrl } from "./fixtures.ts";

// Último commit da origin/main que mexeu em src/lib/gerarReciboLegalPDF.ts.
const REFERENCIA = "9bbc7da40642a89f015964bb5b6cb6c8387af061";
const AQUI = fromFileUrl(new URL(".", import.meta.url));
const RELOGIO = new Date("2026-11-19T15:00:00Z").getTime();
const PT_POR_MM = 72 / 25.4;
const ALTURA_PT = 841.89;
const LARGURA_PT = 595.28;

async function carregarReferencia(): Promise<typeof gerarReciboLegalPDF> {
  const git = new Deno.Command("git", { args: ["--no-pager", "show", `${REFERENCIA}:src/lib/gerarReciboLegalPDF.ts`], cwd: AQUI });
  const { code, stdout, stderr } = await git.output();
  if (code !== 0) throw new Error(new TextDecoder().decode(stderr));
  const arquivo = join(AQUI, `.referencia-pag-${Date.now()}.ts`);
  await Deno.writeFile(arquivo, stdout);
  try {
    return (await import(`file://${arquivo}`)).gerarReciboLegalPDF;
  } finally {
    await Deno.remove(arquivo);
  }
}
const referencia = await carregarReferencia();

const normalizar = (pdf: string) =>
  pdf
    .replace(/\/CreationDate \(D:[^)]*\)/g, "/CreationDate (X)")
    .replace(/\/ID \[ <[0-9A-Fa-f]+> <[0-9A-Fa-f]+> \]/g, "/ID [X]");

// ---------- geometria do PDF (pontos, y a partir do pé da página) ----------
export interface Elemento { pagina: number; tipo: "texto" | "imagem" | "traco" | "retangulo"; y0: number; y1: number; texto?: string }

/** Streams de conteúdo das páginas, na ordem (imagens têm dicionário maior e ficam de fora). */
function paginas(pdf: string): string[] {
  return [...pdf.matchAll(/<<\n\/Length \d+\n>>\nstream\n([\s\S]*?)\nendstream/g)].map((m) => m[1]);
}

export function elementos(pdf: string): Elemento[] {
  const out: Elemento[] = [];
  paginas(pdf).forEach((s, i) => {
    const pagina = i + 1;
    const n = String.raw`(-?[\d.]+)`;
    for (const m of s.matchAll(new RegExp(`${n} ${n} Td\\n\\((.*)\\) Tj`, "g"))) {
      const y = Number(m[2]);
      out.push({ pagina, tipo: "texto", y0: y, y1: y, texto: m[3] });
    }
    for (const m of s.matchAll(new RegExp(`${n} 0\\.? 0\\.? ${n} ${n} ${n} cm\\n/I\\d+ Do`, "g"))) {
      const y = Number(m[4]);
      out.push({ pagina, tipo: "imagem", y0: y, y1: y + Number(m[2]) });
    }
    for (const m of s.matchAll(new RegExp(`${n} ${n} m\\n${n} ${n} l`, "g"))) {
      out.push({ pagina, tipo: "traco", y0: Math.min(Number(m[2]), Number(m[4])), y1: Math.max(Number(m[2]), Number(m[4])) });
    }
    for (const m of s.matchAll(new RegExp(`${n} ${n} ${n} ${n} re`, "g"))) {
      const y = Number(m[2]);
      const h = Number(m[4]);
      out.push({ pagina, tipo: "retangulo", y0: Math.min(y, y + h), y1: Math.max(y, y + h) });
    }
  });
  return out;
}

const mm = (yPt: number) => Math.round(((ALTURA_PT - yPt) / PT_POR_MM) * 10) / 10;

/** Elementos que saem da folha. Texto: a linha de base precisa ficar acima do pé (≥ 1 pt). */
function foraDaFolha(pdf: string, tipos: Elemento["tipo"][] = ["texto", "imagem", "traco", "retangulo"]): string[] {
  return elementos(pdf)
    .filter((e) => tipos.includes(e.tipo))
    .filter((e) => (e.tipo === "texto" ? e.y0 < 1 : e.y0 < -0.01) || e.y1 > ALTURA_PT + 0.01)
    .map((e) => `p${e.pagina} ${e.tipo} ${e.texto ?? ""} em ${mm(e.y0)} mm`);
}

const textos = (pdf: string) => elementos(pdf).filter((e) => e.tipo === "texto").map((e) => e.texto!);

// ---------- dados fictícios ----------
const LOJA = { nome_loja: "Loja Teste Ficticia", cnpj: "00.000.000/0001-00", telefone: "(11) 90000-0000", logradouro: "Rua Exemplo", numero: "100", bairro: "Centro", cidade: "Cidade Teste", estado: "SP", cep: "00000-000" };
const VENDEDOR = { nome: "Fulano de Teste", tipo: "fisica" as const, cpf_cnpj: "000.000.000-00", telefone: "(11) 91111-1111" };
const DISP = { tipo: "celular", marca: "Marca X", modelo: "Modelo Y", cor: "Preto", capacidade_gb: 128, condicao: "usado", numero_serie: "SERIE-FICT-01", imei: "351234567890123" };
const COM_IMEI2 = { ...DISP, imei2: "359876543210987" };
const ASS = pngDataUrl(60, 20, [0, 0, 0]);
// Sem assinatura_*_data: o gerador usa new Date() e o relógio fixo entra na prova.
const COMPRA = { id: "00000000-0000-0000-0000-000000000009", data_compra: "2026-11-10T14:30:00", created_at: "2026-11-10T17:30:00Z", valor_pago: 900, forma_pagamento: "pix", condicao_aparelho: "usado", assinatura_vendedor: ASS, assinatura_cliente: ASS };
const COMPRA_SEM_ASS = { ...COMPRA, assinatura_vendedor: undefined, assinatura_cliente: undefined };
const fotos = (n: number) => Array.from({ length: n }, (_, i) => pngDataUrl(40 + i, 30, [200, 50 * i, 0]));

type Entrada = { dispositivo: Record<string, unknown>; compra: Record<string, unknown>; imagens?: unknown };
async function gerar(fn: typeof gerarReciboLegalPDF, e: Entrada): Promise<string> {
  const w = console.warn;
  console.warn = () => {};
  const relogio = new FakeTime(RELOGIO);
  try {
    const doc = await fn({ loja: LOJA, vendedor: VENDEDOR, ...e } as Parameters<typeof gerarReciboLegalPDF>[0]);
    return doc.output();
  } finally {
    relogio.restore();
    console.warn = w;
  }
}

const CASOS: Record<string, Entrada> = {
  "sem fotos, 2 assinaturas": { dispositivo: DISP, compra: COMPRA },
  "sem assinaturas": { dispositivo: DISP, compra: COMPRA_SEM_ASS },
  "só assinatura do funcionário": { dispositivo: DISP, compra: { ...COMPRA, assinatura_cliente: undefined } },
  "só assinatura do vendedor": { dispositivo: DISP, compra: { ...COMPRA, assinatura_vendedor: undefined } },
  "fotos (2) + assinaturas": { dispositivo: DISP, compra: { ...COMPRA, fotos: ["https://x/1.jpg", "https://x/2.jpg"] }, imagens: { fotos: fotos(2) } },
  "fotos (5, uma falhou) + assinaturas": { dispositivo: DISP, compra: { ...COMPRA, fotos: ["a", "b", "c", "d", "e"] }, imagens: { fotos: [...fotos(2), null, ...fotos(2)] } },
  "documentos (imagem) + assinaturas": { dispositivo: DISP, compra: { ...COMPRA, documento_vendedor_frente: "https://x/f.jpg", documento_vendedor_verso: "https://x/v.jpg" }, imagens: { fotos: [], documentoFrente: pngDataUrl(80, 50), documentoVerso: pngDataUrl(80, 50) } },
  "documentos (PDF) + observações + assinaturas": { dispositivo: DISP, compra: { ...COMPRA, documento_vendedor_frente: "https://x/f.pdf", documento_vendedor_verso: "https://x/v.pdf", observacoes: "Observação fictícia." } },
  "tudo: docs, 3 fotos, observações longas, assinaturas": { dispositivo: DISP, compra: { ...COMPRA, documento_vendedor_frente: "f.jpg", documento_vendedor_verso: "v.jpg", fotos: ["a", "b", "c"], observacoes: "Texto fictício. ".repeat(60) }, imagens: { fotos: fotos(3), documentoFrente: pngDataUrl(80, 50), documentoVerso: null } },
};

// Deslocamentos: cada linha de observação empurra o fim do recibo 5 mm.
const DESLOCAMENTOS = Array.from({ length: 26 }, (_, k) => k);
const comObs = (e: Entrada, k: number): Entrada =>
  k === 0 ? e : { ...e, compra: { ...e.compra, observacoes: Array.from({ length: k }, (_, i) => `linha ficticia ${i + 1}`).join("\n") } };

// ---------------- recibo que hoje cabe: idêntico ----------------

Deno.test("caso de 296 mm (sem IMEI 2): 'Data:' da 2ª assinatura continua em 296 mm e o PDF é idêntico", async () => {
  const antes = await gerar(referencia, CASOS["sem fotos, 2 assinaturas"]);
  const depois = await gerar(gerarReciboLegalPDF, CASOS["sem fotos, 2 assinaturas"]);
  assertEquals(normalizar(depois), normalizar(antes));
  const datas = elementos(depois).filter((e) => e.texto?.startsWith("Data: 19/11/2026"));
  assertEquals(datas.map((d) => [d.pagina, mm(d.y0)]), [[1, 247], [1, 296]]);
  assertEquals(foraDaFolha(depois, ["texto", "imagem"]), []);
});

Deno.test("sem IMEI 2: todos os casos e deslocamentos que hoje cabem na folha saem byte a byte iguais", async () => {
  let comparados = 0;
  let cortadosHoje = 0;
  for (const [nome, caso] of Object.entries(CASOS)) {
    for (const k of DESLOCAMENTOS) {
      const e = comObs(caso, k);
      const antes = await gerar(referencia, e);
      const depois = await gerar(gerarReciboLegalPDF, e);
      if (foraDaFolha(antes, ["texto", "imagem"]).length === 0) {
        assertEquals(normalizar(depois), normalizar(antes), `${nome} +${k} linhas`);
        comparados++;
      } else {
        // Hoje sai cortado: agora tem de caber, sem perder texto.
        cortadosHoje++;
        assertEquals(foraDaFolha(depois, ["texto", "imagem"]), [], `${nome} +${k}`);
        assertEquals(textos(depois), textos(antes), `${nome} +${k}: textos`);
      }
    }
  }
  assert(comparados > 150, `comparados ${comparados}`);
  assert(cortadosHoje > 0, "a varredura precisa passar por recibos que hoje saem cortados");
});

// ---------------- com IMEI 2: nada sai da folha, nada some ----------------

Deno.test("IMEI 2, sem fotos, 2 assinaturas: 'Data:' não sai da folha (2ª assinatura vai para a página 2)", async () => {
  const e = { ...CASOS["sem fotos, 2 assinaturas"], dispositivo: COM_IMEI2 };
  const pdf = await gerar(gerarReciboLegalPDF, e);
  assertEquals(foraDaFolha(pdf), []);
  const els = elementos(pdf);
  const rotulo = els.find((x) => x.texto?.startsWith("Vendedor do Dispositivo"))!;
  const datas = els.filter((x) => x.texto?.startsWith("Data: 19/11/2026"));
  assertEquals([rotulo.pagina, mm(rotulo.y0)], [2, 20]);
  assertEquals(datas.map((d) => [d.pagina, mm(d.y0)]), [[1, 252], [2, 61]]);
  // Imagem da 2ª assinatura na mesma página do rótulo dela.
  const imgs = els.filter((x) => x.tipo === "imagem");
  assertEquals(imgs.map((i) => i.pagina), [1, 2]);
  // Nada some: textos da referência + a linha do IMEI 2.
  const ref = textos(await gerar(referencia, e));
  const novos = textos(pdf);
  assertEquals(novos.filter((t) => !t.startsWith("IMEI 2: ")), ref);
  assertEquals(novos.filter((t) => t.startsWith("IMEI 2: ")), ["IMEI 2: 359876543210987"]);
});

Deno.test("IMEI 2 em todos os casos e deslocamentos: tudo dentro da folha e nenhum texto some", async () => {
  let gerados = 0;
  for (const [nome, caso] of Object.entries(CASOS)) {
    for (const k of DESLOCAMENTOS) {
      const e = comObs({ ...caso, dispositivo: COM_IMEI2 }, k);
      const pdf = await gerar(gerarReciboLegalPDF, e);
      assertEquals(foraDaFolha(pdf, ["texto", "imagem"]), [], `${nome} +${k}`);
      const ref = textos(await gerar(referencia, e));
      assertEquals(textos(pdf).filter((t) => !t.startsWith("IMEI 2: ")), ref, `${nome} +${k}: textos`);
      gerados++;
    }
  }
  assertEquals(gerados, Object.keys(CASOS).length * DESLOCAMENTOS.length);
});

Deno.test("IMEIs longos que quebram: dentro da folha e da margem direita, nenhum texto some", async () => {
  for (const imei2 of ["9".repeat(150), Array.from({ length: 30 }, (_, i) => `IMEI${i}`).join(" ")]) {
    for (const caso of [CASOS["sem fotos, 2 assinaturas"], CASOS["fotos (2) + assinaturas"]]) {
      const pdf = await gerar(gerarReciboLegalPDF, { ...caso, dispositivo: { ...DISP, imei: "1".repeat(120), imei2 } });
      assertEquals(foraDaFolha(pdf, ["texto", "imagem"]), []);
      const t = textos(pdf);
      const juntado = t.join("").replace(/\s/g, "");
      assert(juntado.includes(`IMEI:${"1".repeat(120)}`.replace(/\s/g, "")));
      assert(juntado.includes(`IMEI2:${imei2}`.replace(/\s/g, "")));
      for (const x of elementos(pdf).filter((x) => x.tipo === "texto")) assert(x.y0 <= ALTURA_PT);
    }
  }
  assert(LARGURA_PT > 0);
});

Deno.test("sem assinaturas e com IMEI 2: só a linha nova muda, nada sai da folha", async () => {
  const e = { ...CASOS["sem assinaturas"], dispositivo: COM_IMEI2 };
  const pdf = await gerar(gerarReciboLegalPDF, e);
  assertEquals(foraDaFolha(pdf), []);
  assertEquals(textos(pdf).filter((t) => !t.startsWith("IMEI 2: ")), textos(await gerar(referencia, e)));
});

Deno.test("linhas de IMEI no pé da folha (endereço longo empurra a seção 3): nenhuma sai da folha", async () => {
  let viraram = 0;
  for (let n = 0; n <= 60; n++) {
    const endereco = Array.from({ length: n * 12 }, (_, i) => `Rua${i}`).join(" ");
    const e = { dispositivo: { ...DISP, imei: "1".repeat(300), imei2: "2".repeat(300) }, compra: COMPRA_SEM_ASS };
    const w = console.warn;
    console.warn = () => {};
    const relogio = new FakeTime(RELOGIO);
    let pdf: string;
    try {
      pdf = (await gerarReciboLegalPDF({ loja: LOJA, vendedor: { ...VENDEDOR, endereco }, ...e } as Parameters<typeof gerarReciboLegalPDF>[0])).output();
    } finally {
      relogio.restore();
      console.warn = w;
    }
    const imeis = elementos(pdf).filter((x) => x.tipo === "texto" && /^[12]+$|^IMEI/.test(x.texto!));
    assertEquals(imeis.filter((x) => x.y0 < 1).map((x) => mm(x.y0)), [], `endereço com ${n} linhas`);
    if (new Set(imeis.map((x) => x.pagina)).size > 1) viraram++;
  }
  assert(viraram > 0, "a varredura precisa pegar linhas de IMEI que viram a página");
});

Deno.test("varredura de 1 em 1 mm antes das assinaturas: cabe = idêntico; não cabe = vira a página", async () => {
  // Mexem só antes da seção de assinaturas: endereço da loja (-4 mm), linhas de
  // endereço do vendedor (+4 mm cada), situação da conta (+5), série (-5), IMEI 2 (+5).
  const posicoes = new Set<number>();
  let idem = 0;
  let viraram = 0;
  for (const comImei2 of [false, true]) for (const semEndLoja of [false, true]) for (let nEnd = 0; nEnd <= 3; nEnd++)
  for (const situacao of [false, true]) for (const semSerie of [false, true]) {
    const loja = semEndLoja ? { ...LOJA, logradouro: undefined } : LOJA;
    const endereco = nEnd === 0 ? undefined : Array.from({ length: nEnd * 12 - 4 }, (_, i) => `Rua${i}`).join(" ");
    const dispositivo = { ...(comImei2 ? COM_IMEI2 : DISP), numero_serie: semSerie ? undefined : DISP.numero_serie };
    const compra = { ...COMPRA, situacao_conta: situacao ? "Desbloqueada" : undefined };
    const rodar = async (fn: typeof gerarReciboLegalPDF) => {
      const w = console.warn;
      console.warn = () => {};
      const relogio = new FakeTime(RELOGIO);
      try {
        return (await fn({ loja, vendedor: { ...VENDEDOR, endereco }, dispositivo, compra } as Parameters<typeof gerarReciboLegalPDF>[0])).output();
      } finally {
        relogio.restore();
        console.warn = w;
      }
    };
    const nome = JSON.stringify({ comImei2, semEndLoja, nEnd, situacao, semSerie });
    const antes = await rodar(referencia);
    const depois = await rodar(gerarReciboLegalPDF);
    const dataRef = elementos(antes).filter((x) => x.texto?.startsWith("Data: 19/11/2026")).at(-1)!;
    if (dataRef.pagina === 1) posicoes.add(mm(dataRef.y0));
    assertEquals(foraDaFolha(depois, ["texto", "imagem"]), [], nome);
    assertEquals(textos(depois).filter((t) => !t.startsWith("IMEI 2: ")), textos(antes), `${nome}: textos`);
    if (!comImei2 && foraDaFolha(antes, ["texto", "imagem"]).length === 0) {
      assertEquals(normalizar(depois), normalizar(antes), nome);
      idem++;
    } else if (foraDaFolha(antes, ["texto", "imagem"]).length > 0) viraram++;
  }
  // Passa por "Data:" em 296 mm (cabe) e em 297 mm (linha de base no pé: a descida sairia da folha).
  assert(posicoes.has(296) && posicoes.has(297), [...posicoes].sort((x, y) => x - y).join(","));
  assert(idem > 10 && viraram > 0, `idem ${idem} viraram ${viraram}`);
});
