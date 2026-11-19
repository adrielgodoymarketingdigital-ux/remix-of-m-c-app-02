// Processo filho de datasReciboLegal.test.ts: roda com o TZ do ambiente (UTC, São
// Paulo, Tóquio, Manaus) e imprime, em JSON, os textos de data de cada cenário.
import { gerarReciboLegalPDF } from "../../src/lib/gerarReciboLegalPDF.ts";
import { CENARIOS, gerar, textosDeData } from "./cenariosDatas.ts";

const saida: Record<string, string[]> = {};
for (const [nome, c] of Object.entries(CENARIOS)) saida[nome] = textosDeData(await gerar(gerarReciboLegalPDF, c.compra));
console.log(JSON.stringify({ fuso: Intl.DateTimeFormat().resolvedOptions().timeZone, saida }));
