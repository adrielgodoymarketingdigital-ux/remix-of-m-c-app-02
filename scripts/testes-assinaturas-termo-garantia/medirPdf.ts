// deno run -A --no-check --config scripts/testes-assinaturas-termo-garantia/deno.json \
//   scripts/testes-assinaturas-termo-garantia/medirPdf.ts [ref-git]
// PDF A4 do recibo de venda / termo de garantia de dispositivo nos cenários de
// cenariosPdf.ts: nº de folhas e se as assinaturas ficam sozinhas, ANTES
// (gerarReciboVendaPDF.ts da ref, padrão origin/main) e DEPOIS (a árvore atual).
import { fromFileUrl, join } from "jsr:@std/path@1";
import { docsCriados, limparRegistro } from "./jspdfInstrumentado.ts";
import { analisarPdf, type AnalisePdf } from "./analisePdf.ts";
import { todosCenarios } from "./cenariosPdf.ts";
import { gerarReciboVendaPDF as gerarDepois } from "../../src/lib/gerarReciboVendaPDF.ts";

type Gerar = typeof gerarDepois;
const AQUI = fromFileUrl(new URL(".", import.meta.url));
const REF = Deno.args[0] ?? "origin/main";

export async function carregarReferencia(ref: string): Promise<Gerar> {
  const git = new Deno.Command("git", { args: ["--no-pager", "show", `${ref}:src/lib/gerarReciboVendaPDF.ts`], cwd: AQUI });
  const { code, stdout, stderr } = await git.output();
  if (code !== 0) throw new Error(new TextDecoder().decode(stderr));
  const arquivo = join(AQUI, `.referencia-${Date.now()}.ts`);
  await Deno.writeFile(arquivo, stdout);
  try {
    return (await import(`file://${arquivo}`)).gerarReciboVendaPDF;
  } finally {
    await Deno.remove(arquivo);
  }
}

/** SAIDA_PDF=<pasta>: grava também os PDFs (antes-<cenário>.pdf / depois-<cenário>.pdf). */
const SAIDA_PDF = Deno.env.get("SAIDA_PDF");

export async function medir(gerar: Gerar, dados: Parameters<Gerar>[0], arquivo?: string): Promise<AnalisePdf & { docs: number }> {
  limparRegistro();
  const blob = await gerar(dados);
  if (SAIDA_PDF && arquivo) await Deno.writeFile(join(SAIDA_PDF, arquivo), new Uint8Array(await blob.arrayBuffer()));
  const docs = docsCriados.length;
  return { ...analisarPdf(docsCriados[docs - 1]), docs };
}

/** Nível de compactação pelo passo das linhas do termo (ESCALAS_PDF_A4). */
export const nivelPeloPasso = (passo: number) => (passo >= 3.95 ? 0 : passo >= 3.45 ? 1 : 2);

if (import.meta.main) {
  const gerarAntes = await carregarReferencia(REF);
  const sn = (b: boolean) => (b ? "SIM" : "não");
  console.log(`| cenário | ANTES folhas | ANTES assinatura sozinha? | DEPOIS folhas | DEPOIS assinatura sozinha? | DEPOIS nível | DEPOIS linhas do termo junto | fonte termo (pt) | textos iguais? |`);
  console.log(`|---|---|---|---|---|---|---|---|---|`);
  let problemas = 0;
  for (const c of todosCenarios()) {
    const a = await medir(gerarAntes, c.dados, `antes-${c.id}.pdf`);
    const d = await medir(gerarDepois, c.dados, `depois-${c.id}.pdf`);
    const iguais = JSON.stringify(a.textos) === JSON.stringify(d.textos);
    if (d.assinaturaSozinha || d.folhaSoRodape || !iguais || d.maiorYConteudo > 280 || d.fonteTermoPt < 7) problemas++;
    console.log(`| ${c.id} | ${a.folhas} | ${sn(a.assinaturaSozinha)}${a.assinaturaSozinha ? ` (folha ${a.folhaAssinaturas})` : ""} | ${d.folhas} | ${sn(d.assinaturaSozinha)} | ${nivelPeloPasso(d.passoTermoMm)}${d.folhas > 1 ? " + junto" : ""} | ${d.linhasTermoNaFolhaAssinaturas} | ${d.fonteTermoPt} | ${iguais ? "sim" : "NÃO"} |`);
  }
  console.log(problemas ? `\n${problemas} cenário(s) com problema` : "\nOK: assinatura nunca sozinha, nenhuma folha só com rodapé, nenhum texto sumiu, termo >= 7 pt");
  Deno.exit(problemas ? 1 : 0);
}
