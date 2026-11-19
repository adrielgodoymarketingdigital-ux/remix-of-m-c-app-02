// deno test -A --no-check --config scripts/testes-recibo-legal/deno.json scripts/testes-recibo-legal/
// Hora da compra no recibo legal (antes saía sempre "00:00") e datas em Brasília.
// 1) Lógica pura (datasReciboLegal.ts).
// 2) PDF antes (origin/main) × depois, relógio fixo: a ÚNICA diferença é o texto
//    das datas; os textos novos são os esperados.
// 3) Mesmos textos com o processo em UTC, São Paulo, Tóquio e Manaus (processos filhos).
// Prova de que os testes pegam erros: ./mutantes.sh. Dados fictícios; Supabase é stub.
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { fromFileUrl, join } from "jsr:@std/path@1";
import { gerarReciboLegalPDF } from "../../src/lib/gerarReciboLegalPDF.ts";
import {
  datasAssinaturaAposCadastro,
  dataHoraBrasiliaRecibo,
  textoDataAssinaturaRecibo,
  textoDataCompraRecibo,
} from "../../src/lib/origem/datasReciboLegal.ts";
import { CENARIOS, FUSOS, gerar, semDatas, textosDeData } from "./cenariosDatas.ts";

// origin/main de quando a correção foi feita (último commit que mexeu no gerador).
const REFERENCIA = "d28318f1eafdde5f1c59e40817c8f406d38d0d08";
const AQUI = fromFileUrl(new URL(".", import.meta.url));
const AGORA = "2026-11-19T15:00:00.000Z"; // 12:00 em Brasília

// ---------------- 1) lógica pura ----------------

Deno.test("data da compra: mesmo dia ganha a hora do cadastro em Brasília", () => {
  assertEquals(textoDataCompraRecibo("2026-11-19", "2026-11-19T17:32:41.123456+00:00", AGORA), "19/11/2026 às 14:32");
  assertEquals(textoDataCompraRecibo("2026-11-19", "2026-11-19T14:32:00-03:00", AGORA), "19/11/2026 às 14:32");
});

Deno.test("data da compra: outro dia ou sem created_at sai só a data, nunca 00:00", () => {
  assertEquals(textoDataCompraRecibo("2026-11-10", "2026-11-19T17:32:00+00:00", AGORA), "10/11/2026");
  // Mesmo dia do mês, mas mês (ou ano) anterior: continua retroativa.
  assertEquals(textoDataCompraRecibo("2026-10-19", "2026-11-19T17:32:00+00:00", AGORA), "19/10/2026");
  assertEquals(textoDataCompraRecibo("2025-11-19", "2026-11-19T17:32:00+00:00", AGORA), "19/11/2025");
  assertEquals(textoDataCompraRecibo("2026-11-19", undefined, AGORA), "19/11/2026");
  assertEquals(textoDataCompraRecibo("2026-11-19", null, AGORA), "19/11/2026");
  assertEquals(textoDataCompraRecibo("2026-11-19", "", AGORA), "19/11/2026");
  assertEquals(textoDataCompraRecibo("2026-11-19", "lixo", AGORA), "19/11/2026");
});

Deno.test("data da compra: perto da meia-noite vale o dia de Brasília", () => {
  // 23:50 em Brasília = 02:50 do dia seguinte em UTC.
  assertEquals(textoDataCompraRecibo("2026-11-19", "2026-11-20T02:50:00+00:00", AGORA), "19/11/2026 às 23:50");
  assertEquals(textoDataCompraRecibo("2026-11-20", "2026-11-20T02:50:00+00:00", AGORA), "20/11/2026");
  // 00:10 em Brasília = 03:10 em UTC.
  assertEquals(textoDataCompraRecibo("2026-11-20", "2026-11-20T03:10:00+00:00", AGORA), "20/11/2026 às 00:10");
  assertEquals(textoDataCompraRecibo("2026-11-19", "2026-11-20T03:10:00+00:00", AGORA), "19/11/2026");
});

Deno.test("data da compra: o dia de data_compra nunca passa por fuso", () => {
  assertEquals(textoDataCompraRecibo("2026-01-01", undefined, AGORA), "01/01/2026");
  assertEquals(textoDataCompraRecibo("2026-12-31", undefined, AGORA), "31/12/2026");
  // Timestamp no lugar da data (dados antigos de teste): vale só o dia escrito.
  assertEquals(textoDataCompraRecibo("2026-11-10T23:30:00Z", undefined, AGORA), "10/11/2026");
});

Deno.test("data da compra: sem data_compra vale o agora em Brasília", () => {
  assertEquals(textoDataCompraRecibo(undefined, "2026-11-19T17:32:00+00:00", AGORA), "19/11/2026 às 12:00");
  assertEquals(textoDataCompraRecibo("", undefined, AGORA), "19/11/2026 às 12:00");
});

Deno.test("assinatura: timestamp UTC sai em Brasília com segundos; sem data vale o agora", () => {
  assertEquals(textoDataAssinaturaRecibo("2026-11-19T17:33:05.5+00:00", AGORA), "19/11/2026 às 14:33:05");
  assertEquals(textoDataAssinaturaRecibo("2026-11-20T02:59:59+00:00", AGORA), "19/11/2026 às 23:59:59");
  assertEquals(textoDataAssinaturaRecibo("2026-11-20T03:00:00+00:00", AGORA), "20/11/2026 às 00:00:00");
  assertEquals(textoDataAssinaturaRecibo(undefined, AGORA), "19/11/2026 às 12:00:00");
  assertEquals(textoDataAssinaturaRecibo("lixo", AGORA), "19/11/2026 às 12:00:00");
  assertEquals(dataHoraBrasiliaRecibo("lixo"), null);
});

Deno.test("após cadastrar: assinaturas com a data gravada; sem ela, o agora; sem assinatura, nada", () => {
  const gravada = { assinatura_vendedor_data: "2026-11-19T17:32:40+00:00", assinatura_cliente_data: "2026-11-19T17:32:41+00:00" };
  assertEquals(datasAssinaturaAposCadastro({ assinatura_vendedor: "x", assinatura_cliente: "y" }, gravada, AGORA), {
    assinatura_vendedor_data: "2026-11-19T17:32:40+00:00",
    assinatura_cliente_data: "2026-11-19T17:32:41+00:00",
  });
  assertEquals(datasAssinaturaAposCadastro({ assinatura_vendedor: "x" }, {}, AGORA), {
    assinatura_vendedor_data: AGORA,
    assinatura_cliente_data: undefined,
  });
  assertEquals(datasAssinaturaAposCadastro({}, gravada, AGORA), { assinatura_vendedor_data: undefined, assinatura_cliente_data: undefined });
});

// ---------------- 2) PDF antes × depois ----------------

async function carregarReferencia(): Promise<typeof gerarReciboLegalPDF> {
  const git = new Deno.Command("git", { args: ["--no-pager", "show", `${REFERENCIA}:src/lib/gerarReciboLegalPDF.ts`], cwd: AQUI });
  const { code, stdout, stderr } = await git.output();
  if (code !== 0) throw new Error(new TextDecoder().decode(stderr));
  const arquivo = join(AQUI, `.referencia-datas-${Date.now()}.ts`);
  await Deno.writeFile(arquivo, stdout);
  try {
    return (await import(`file://${arquivo}`)).gerarReciboLegalPDF;
  } finally {
    await Deno.remove(arquivo);
  }
}

Deno.test("PDF antes × depois: só o texto das datas muda, e muda para o esperado", async () => {
  const referencia = await carregarReferencia();
  for (const [nome, c] of Object.entries(CENARIOS)) {
    const antes = await gerar(referencia, c.compra);
    const depois = await gerar(gerarReciboLegalPDF, c.compra);
    assert(antes.length > 1000, nome);
    assertEquals(semDatas(depois), semDatas(antes), `algo além das datas mudou em "${nome}"`);
    assertEquals(textosDeData(antes).length, c.esperado.length, `"${nome}" (antes)`);
    assertEquals(textosDeData(depois), c.esperado, `"${nome}"`);
  }
});

Deno.test("o bug de antes: compra de data pura saía 00:00", async () => {
  const referencia = await carregarReferencia();
  const antes = textosDeData(await gerar(referencia, CENARIOS["compra do mesmo dia"].compra));
  // No fuso do aparelho, meia-noite local: "00:00" em qualquer fuso.
  assert(antes[0].endsWith("às 00:00"), antes[0]);
});

Deno.test("a comparação pega mudança fora das datas", async () => {
  const c = CENARIOS["compra do mesmo dia"].compra;
  const a = semDatas(await gerar(gerarReciboLegalPDF, c));
  const b = semDatas(await gerar(gerarReciboLegalPDF, { ...c, valor_pago: 901 }));
  assertNotEquals(a, b);
});

// ---------------- 3) independente do fuso do aparelho ----------------

Deno.test("mesmos textos com o processo em UTC, São Paulo, Tóquio e Manaus", async () => {
  const esperado = Object.fromEntries(Object.entries(CENARIOS).map(([n, c]) => [n, c.esperado]));
  for (const fuso of FUSOS) {
    const filho = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", "--no-check", "--config", join(AQUI, "deno.json"), join(AQUI, "imprimirDatas.ts")],
      env: { TZ: fuso },
      cwd: AQUI,
    });
    const { code, stdout, stderr } = await filho.output();
    assertEquals(code, 0, new TextDecoder().decode(stderr));
    const r = JSON.parse(new TextDecoder().decode(stdout).trim().split("\n").at(-1)!);
    assertEquals(r.fuso, fuso, "o processo filho não ficou no fuso pedido");
    assertEquals(r.saida, esperado, `fuso ${fuso}`);
  }
});
