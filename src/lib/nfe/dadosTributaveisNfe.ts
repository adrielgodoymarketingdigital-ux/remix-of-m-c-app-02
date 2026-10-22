/**
 * Dados da unidade TRIBUTÁVEL de cada item (cEANTrib, uTrib, qTrib), que a
 * leitura principal (lerXmlNfe.ts) não devolve e que esta etapa precisa:
 * - cEANTrib costuma ser o GTIN da UNIDADE quando a nota é vendida em caixa
 *   (cEAN = GTIN da caixa) — é o código que bate com o cadastro da loja;
 * - uTrib/qTrib sugerem o fator de conversão (ex.: 1 CX com qTrib 12 UN).
 *
 * Só chame DEPOIS de lerXmlNfe(...).ok: as checagens de segurança (tamanho,
 * DOCTYPE/ENTITY, parsererror, namespace) são repetidas aqui de forma mínima
 * por defesa, mas a validação da nota é lá.
 *
 * Sem React nem imports "@/": testado com Deno em scripts/testes-xml-compra/.
 */
import { gtinValido, NAMESPACE_NFE, TAMANHO_MAXIMO_XML_NFE, type OpcoesLeituraNfe } from "./lerXmlNfe.ts";

export interface DadosTributaveisItem {
  /** cEANTrib com dígito válido; null quando "SEM GTIN", vazio ou inválido. */
  eanTrib: string | null;
  uTrib: string;
  qTrib: string;
}

const DECIMAL = /^\d{1,15}(\.\d{1,10})?$/;

function filho(el: Element | null, nome: string): Element | null {
  if (!el) return null;
  for (let n = el.firstElementChild; n; n = n.nextElementSibling) {
    if (n.localName === nome && n.namespaceURI === NAMESPACE_NFE) return n;
  }
  return null;
}

const texto = (el: Element | null, nome: string, max = 60) => (filho(el, nome)?.textContent ?? "").trim().slice(0, max);

/** nItem → dados tributáveis. Mapa vazio se o XML não puder ser lido. */
export function lerDadosTributaveis(conteudo: string, opcoes: OpcoesLeituraNfe = {}): Map<number, DadosTributaveisItem> {
  const mapa = new Map<number, DadosTributaveisItem>();
  const tamanho = opcoes.tamanhoBytes ?? new TextEncoder().encode(conteudo).length;
  if (tamanho > TAMANHO_MAXIMO_XML_NFE || /<!DOCTYPE/i.test(conteudo) || /<!ENTITY/i.test(conteudo)) return mapa;

  const parser = opcoes.criarParser ? opcoes.criarParser() : new DOMParser();
  const doc = parser.parseFromString(conteudo.replace(/^\uFEFF/, ""), "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return mapa;

  const raiz = doc.documentElement;
  const nfe = raiz?.localName === "nfeProc" ? filho(raiz, "NFe") : raiz;
  const infNFe = filho(nfe, "infNFe");
  if (!infNFe) return mapa;

  let indice = 0;
  for (let det = infNFe.firstElementChild; det; det = det.nextElementSibling) {
    if (det.localName !== "det" || det.namespaceURI !== NAMESPACE_NFE) continue;
    indice++;
    const nItem = Number((det.getAttribute("nItem") ?? "").slice(0, 4)) || indice;
    const prod = filho(det, "prod");
    const ean = texto(prod, "cEANTrib");
    const qTrib = texto(prod, "qTrib");
    mapa.set(nItem, {
      eanTrib: ean && ean.toUpperCase() !== "SEM GTIN" && gtinValido(ean) ? ean : null,
      uTrib: texto(prod, "uTrib", 6),
      qTrib: DECIMAL.test(qTrib) ? qTrib : "",
    });
  }
  return mapa;
}
