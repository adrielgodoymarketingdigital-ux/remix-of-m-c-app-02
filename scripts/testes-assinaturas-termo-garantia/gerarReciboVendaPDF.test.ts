// deno test -A --no-check --config scripts/testes-assinaturas-termo-garantia/deno.json scripts/testes-assinaturas-termo-garantia/
// PDF A4 do recibo / termo de garantia de dispositivo nos cenários de cenariosPdf.ts,
// comparado com a origin/main (REFERENCIA):
//  - assinatura nunca sozinha numa folha, nenhuma folha só com rodapé;
//  - nenhum texto some (mesmos textos, na mesma ordem); nada passa para o rodapé;
//  - termo >= 7 pt;
//  - documento que hoje cabe numa folha sem quebra: PDF byte a byte igual;
//  - térmico (80mm e 58mm): PDF byte a byte igual em todos os cenários.
// "Byte a byte" = tudo menos a linha /ID do trailer, que o jsPDF sorteia a cada PDF
// (dois PDFs da MESMA versão também diferem nela).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { FakeTime } from "jsr:@std/testing@1/time";
import { gerarReciboVendaPDF } from "../../src/lib/gerarReciboVendaPDF.ts";
import { FONTE_MINIMA_TERMO_PT } from "../../src/lib/recibo/compactacaoReciboVendaA4.ts";
import { montarCenario, todosCenarios } from "./cenariosPdf.ts";
import { carregarReferencia, medir, nivelPeloPasso } from "./medirPdf.ts";

// Commit da origin/main de onde a branch saiu (último que tem o gerarReciboVendaPDF de antes).
const REFERENCIA = "673fb42";
const RELOGIO = new Date("2026-11-20T17:30:00Z").getTime();
const gerarAntes = await carregarReferencia(REFERENCIA);

async function bytes(gerar: typeof gerarReciboVendaPDF, dados: Parameters<typeof gerarReciboVendaPDF>[0]): Promise<string> {
  const t = new FakeTime(RELOGIO);
  try {
    const texto = new TextDecoder("latin1").decode(await (await gerar(dados)).arrayBuffer());
    assertEquals(texto.match(/^\/ID \[ <[0-9A-F]{32}> <[0-9A-F]{32}> \]$/gm)?.length, 1);
    return texto.replace(/^\/ID \[ <[0-9A-F]{32}> <[0-9A-F]{32}> \]$/m, "/ID");
  } finally {
    t.restore();
  }
}

for (const c of todosCenarios()) {
  Deno.test(`A4 ${c.id}: assinatura nunca sozinha e nenhum texto some`, async () => {
    const antes = await medir(gerarAntes, c.dados);
    const depois = await medir(gerarReciboVendaPDF, c.dados);
    assertEquals(depois.assinaturaSozinha, false, `assinatura sozinha na folha ${depois.folhaAssinaturas}`);
    assert(depois.linhasTermoNaFolhaAssinaturas >= 1);
    assertEquals(depois.folhaSoRodape, false);
    assertEquals(depois.textos, antes.textos);
    assert(depois.maiorYConteudo <= 280, `conteúdo em ${depois.maiorYConteudo} mm, em cima do rodapé`);
    assert(depois.fonteTermoPt >= FONTE_MINIMA_TERMO_PT);
    assert(depois.folhas <= antes.folhas, "nunca mais folhas que antes");
    // Nível 2 só quando o nível 1 não cabe, etc.: o caso "troca curta" é o que só cabe no 2.
    if (c.id === "medio-1ap-recibo-troca-curta") assertEquals([depois.folhas, nivelPeloPasso(depois.passoTermoMm)], [1, 2]);
    if (c.id === "medio-1ap-recibo") assertEquals([depois.folhas, nivelPeloPasso(depois.passoTermoMm)], [1, 1]);
    if (c.id === "medio-1ap-recibo-troca-completa") assertEquals([depois.folhas, nivelPeloPasso(depois.passoTermoMm)], [2, 0]);
  });
}

Deno.test("A4 que hoje cabe numa folha (sem quebra): PDF byte a byte igual ao da origin/main", async () => {
  let iguais = 0;
  for (const c of todosCenarios()) {
    const antes = await medir(gerarAntes, c.dados);
    if (antes.folhas !== 1) continue;
    assertEquals(await bytes(gerarReciboVendaPDF, c.dados), await bytes(gerarAntes, c.dados), c.id);
    iguais++;
  }
  assert(iguais >= 3, `só ${iguais} cenário(s) de uma folha`);
});

Deno.test("térmico 80mm e 58mm: PDF byte a byte igual ao da origin/main em todos os cenários", async () => {
  for (const c of todosCenarios()) {
    for (const formato of ["80mm", "58mm"] as const) {
      const dados = { ...c.dados, formato };
      assertEquals(await bytes(gerarReciboVendaPDF, dados), await bytes(gerarAntes, dados), `${c.id} ${formato}`);
    }
  }
});

Deno.test("sem aparelho nenhum: não quebra (documento de sempre ou compactado)", async () => {
  const dados = { ...montarCenario("curto", 1, "recibo").dados, dispositivos: [] };
  const d = await medir(gerarReciboVendaPDF, dados);
  assertEquals(d.folhas, 1);
});
