// Lê o registro do jsPDF instrumentado (o doc DEFINITIVO, o último criado) e
// diz em que folha caem o termo e as assinaturas.
// Termo = linhas desenhadas em x = margem + 2 (só o corpo do termo usa esse x).
import type { DocRegistrado } from "./jspdfInstrumentado.ts";

const MARGEM = 15;
/** Rodapé do adicionarRodapePDF: linha em 281 mm e textos em 287 mm. */
const Y_RODAPE = 281;

export interface AnalisePdf {
  folhas: number;
  folhaAssinaturas: number;
  /** Linhas do termo na folha das assinaturas. */
  linhasTermoNaFolhaAssinaturas: number;
  /** Assinaturas numa folha sem nenhuma linha de termo. */
  assinaturaSozinha: boolean;
  /** Alguma folha só com o rodapé. */
  folhaSoRodape: boolean;
  /** Fonte do corpo do termo (pt): a menor usada. */
  fonteTermoPt: number;
  /** Passo (mm) entre duas linhas seguidas do termo na mesma folha: 4 = nível 0, 3,5 = nível 1, 3,1 = nível 2. */
  passoTermoMm: number;
  /** Fonte das linhas de campo (Nome, Aparelho...) — a menor usada. */
  fonteLinhasPt: number;
  /** Maior Y de conteúdo (fora o rodapé) em qualquer folha — tem de ficar acima do rodapé. */
  maiorYConteudo: number;
  /** Todos os textos de conteúdo, em ordem (para conferir que nada sumiu). */
  textos: string[];
}

export function analisarPdf(doc: DocRegistrado): AnalisePdf {
  const conteudo = doc.textos.filter((t) => t.y < Y_RODAPE);
  const folhas = Math.max(...doc.textos.map((t) => t.pagina));
  const assinatura = conteudo.find((t) => t.texto === "Assinatura do Vendedor");
  const folhaAssinaturas = assinatura?.pagina ?? -1;
  const termo = conteudo.filter((t) => Math.abs(t.x - (MARGEM + 2)) < 0.01);
  const linhas = conteudo.filter((t) => Math.abs(t.x - (MARGEM + 3)) < 0.01 && t.fontePt > 7.6);
  const linhasTermoNaFolhaAssinaturas = termo.filter((t) => t.pagina === folhaAssinaturas).length;
  const paginasComConteudo = new Set(conteudo.map((t) => t.pagina));
  return {
    folhas,
    folhaAssinaturas,
    linhasTermoNaFolhaAssinaturas,
    assinaturaSozinha: linhasTermoNaFolhaAssinaturas === 0,
    folhaSoRodape: Array.from({ length: folhas }, (_, i) => i + 1).some((p) => !paginasComConteudo.has(p)),
    fonteTermoPt: Math.min(...termo.map((t) => t.fontePt)),
    passoTermoMm: Math.round(Math.min(...termo.slice(1).map((t, k) => (t.pagina === termo[k].pagina ? t.y - termo[k].y : Infinity))) * 100) / 100,
    fonteLinhasPt: Math.min(...linhas.map((t) => t.fontePt)),
    maiorYConteudo: Math.max(...conteudo.map((t) => t.y)),
    textos: conteudo.map((t) => t.texto),
  };
}
