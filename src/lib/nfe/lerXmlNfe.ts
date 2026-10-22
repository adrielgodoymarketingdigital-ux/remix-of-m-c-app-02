/**
 * Leitura do XML de uma NF-e de compra (modelo 55, leiaute 4.00) — etapa 1
 * da importação de XML: só lê e devolve o conteúdo. Não grava nada, não envia
 * nada a servidor nenhum (roda no navegador, com o DOMParser nativo).
 *
 * Segurança:
 * - tamanho conferido antes de ler (TAMANHO_MAXIMO_XML_NFE);
 * - arquivo com <!DOCTYPE ou <!ENTITY é rejeitado antes do parse (NF-e válida
 *   nunca tem nenhum dos dois; fecha XXE e expansão de entidades);
 * - DOMParser com application/xml e checagem de <parsererror>;
 * - todo valor sai como texto puro, sem caracteres de controle e com tamanho
 *   limitado por campo (quem exibe é o React, que escapa).
 *
 * Valores monetários e quantidades saem como string decimal exatamente como
 * vieram no XML ("2.5000", "10.0000000000"), validados por regex — nada de
 * float aqui. Para exibir, use Number(); para somar, decimalParaCentavos.
 *
 * Sem React nem imports "@/": testado com Deno em scripts/testes-xml-compra/
 * (lá o DOMParser vem do jsdom, passado em `opcoes.criarParser`).
 */

export const TAMANHO_MAXIMO_XML_NFE = 5 * 1024 * 1024;
export const NAMESPACE_NFE = "http://www.portalfiscal.inf.br/nfe";
export const MAXIMO_ITENS_NFE = 990;

export interface MensagemLeitura {
  codigo: string;
  texto: string;
  /** Número do item (det/@nItem) quando a mensagem é de um item. */
  nItem?: number;
}

export interface ParteNfe {
  cnpj: string | null;
  cpf: string | null;
  nome: string;
}

export interface EmitenteNfe extends ParteNfe {
  nomeFantasia: string;
  ie: string;
  uf: string;
}

export interface ProtocoloNfe {
  chave: string;
  numero: string;
  cStat: string;
  motivo: string;
  dataRecebimento: string;
}

export interface DuplicataNfe {
  numero: string;
  vencimento: string;
  valor: string;
}

export interface TotaisNfe {
  vProd: string;
  vFrete: string;
  vSeg: string;
  vDesc: string;
  vOutro: string;
  vIPI: string;
  vST: string;
  vNF: string;
}

export interface NotaNfe {
  chave: string;
  versao: string;
  modelo: string;
  serie: string;
  numero: string;
  /** dhEmi como veio (ISO com fuso, ex. 2026-10-15T10:30:00-03:00). */
  dataEmissao: string;
  naturezaOperacao: string;
  tpNF: string;
  finNFe: string;
  tpAmb: string;
  emitente: EmitenteNfe;
  destinatario: ParteNfe | null;
  totais: TotaisNfe;
  protocolo: ProtocoloNfe | null;
  /** cStat 100 ou 150 (autorizada fora de prazo) no protNFe. */
  autorizada: boolean;
  infCpl: string;
  /** IMEIs (Luhn válido) achados nas informações complementares da nota. */
  imeisInfCpl: string[];
  duplicatas: DuplicataNfe[];
}

export interface ItemNfe {
  nItem: number;
  cProd: string;
  /** GTIN válido; null quando "SEM GTIN", vazio ou dígito verificador errado. */
  ean: string | null;
  /** cEAN exatamente como veio (para mostrar quando é inválido). */
  cEANOriginal: string;
  xProd: string;
  ncm: string;
  cest: string;
  cfop: string;
  uCom: string;
  qCom: string;
  vUnCom: string;
  vProd: string;
  vDesc: string;
  vFrete: string;
  vSeg: string;
  vOutro: string;
  vIPI: string;
  /** vICMSST do grupo ICMS do item ("" quando não há). */
  vST: string;
  vFCPST: string;
  infAdProd: string;
  /** Sugestão: 15 dígitos com Luhn válido em infAdProd e xProd. Conferir sempre. */
  imeisSugeridos: string[];
}

// Sem união discriminada: o app roda sem strictNullChecks e o `if (!r.ok)` não estreitaria.
export interface ResultadoLeituraNfe {
  ok: boolean;
  erros: MensagemLeitura[];
  avisos: MensagemLeitura[];
  nota: NotaNfe | null;
  itens: ItemNfe[];
}

export interface OpcoesLeituraNfe {
  /** Tamanho do arquivo em bytes (File.size). Sem ele, mede o texto em UTF-8. */
  tamanhoBytes?: number;
  /** Para testes fora do navegador. Padrão: new DOMParser(). */
  criarParser?: () => DOMParser;
}

// ---------------------------------------------------------------------------
// Utilidades puras
// ---------------------------------------------------------------------------

const LIMITE_PADRAO = 255;
const LIMITES: Record<string, number> = {
  xProd: 120,
  infAdProd: 500,
  infCpl: 5000,
  xMotivo: 255,
};

// Caracteres de controle (exceto \t \n \r) não têm lugar em texto exibido.
// deno-lint-ignore no-control-regex
// eslint-disable-next-line no-control-regex
const CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const limparTexto = (valor: string | null | undefined, max: number) =>
  (valor ?? "").replace(CONTROLE, "").trim().slice(0, max);

const soDigitos = (v: string) => v.replace(/\D/g, "");

/** Dígito verificador da chave de acesso (módulo 11, pesos 2..9 da direita). */
export function digitoChaveNfe(chave43: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function chaveNfeValida(chave: string): boolean {
  return /^\d{44}$/.test(chave) && digitoChaveNfe(chave.slice(0, 43)) === Number(chave[43]);
}

/** GTIN-8/12/13/14 com dígito verificador (módulo 10, pesos 3 e 1 da direita). */
export function gtinValido(gtin: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(gtin)) return false;
  let soma = 0;
  for (let i = gtin.length - 2, peso = 3; i >= 0; i--, peso = peso === 3 ? 1 : 3) {
    soma += Number(gtin[i]) * peso;
  }
  return (10 - (soma % 10)) % 10 === Number(gtin[gtin.length - 1]);
}

export function luhnValido(numero: string): boolean {
  if (!/^\d+$/.test(numero)) return false;
  let soma = 0;
  for (let i = numero.length - 1, dobrar = false; i >= 0; i--, dobrar = !dobrar) {
    let d = Number(numero[i]);
    if (dobrar) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    soma += d;
  }
  return soma % 10 === 0;
}

/** IMEIs (15 dígitos isolados, Luhn válido) do texto, sem repetição, na ordem. */
export function extrairImeis(...textos: string[]): string[] {
  const achados: string[] = [];
  for (const t of textos) {
    for (const m of (t ?? "").matchAll(/(?<!\d)\d{15}(?!\d)/g)) {
      if (luhnValido(m[0]) && !achados.includes(m[0])) achados.push(m[0]);
    }
  }
  return achados;
}

const DECIMAL = /^\d{1,15}(\.\d{1,10})?$/;

/** "12.34" → 1234; "12.345" arredonda meio-para-cima → 1235; inválido → null. */
export function decimalParaCentavos(valor: string): number | null {
  if (!DECIMAL.test(valor)) return null;
  const [inteiro, fracao = ""] = valor.split(".");
  const centavos = Number(inteiro) * 100 + Number((fracao + "00").slice(0, 2));
  return Number(fracao[2] ?? "0") >= 5 ? centavos + 1 : centavos;
}

/** "3.0000" → true; "2.5000" → false. */
export function decimalInteiro(valor: string): boolean {
  return DECIMAL.test(valor) && /^\d+(\.0*)?$/.test(valor);
}

export type SituacaoDestinatario = "confere" | "nao_confere" | "loja_sem_cnpj" | "nota_sem_destinatario";

/** Compara o destinatário da nota (CNPJ ou CPF) com os documentos da loja. */
export function conferirDestinatario(
  nota: Pick<NotaNfe, "destinatario">,
  documentosLoja: Array<string | null | undefined>,
): SituacaoDestinatario {
  const docNota = soDigitos(nota.destinatario?.cnpj ?? nota.destinatario?.cpf ?? "");
  if (!docNota) return "nota_sem_destinatario";
  const docsLoja = documentosLoja.map((d) => soDigitos(d ?? "")).filter((d) => d.length === 11 || d.length === 14);
  if (docsLoja.length === 0) return "loja_sem_cnpj";
  return docsLoja.includes(docNota) ? "confere" : "nao_confere";
}

// ---------------------------------------------------------------------------
// Navegação no XML (só elementos do namespace da NF-e)
// ---------------------------------------------------------------------------

function filhos(el: Element | null, nome: string): Element[] {
  const r: Element[] = [];
  if (!el) return r;
  for (let n = el.firstElementChild; n; n = n.nextElementSibling) {
    if (n.localName === nome && n.namespaceURI === NAMESPACE_NFE) r.push(n);
  }
  return r;
}

const filho = (el: Element | null, nome: string): Element | null => filhos(el, nome)[0] ?? null;

function caminho(el: Element | null, ...nomes: string[]): Element | null {
  let atual = el;
  for (const nome of nomes) atual = filho(atual, nome);
  return atual;
}

function texto(el: Element | null, nome: string): string {
  return limparTexto(filho(el, nome)?.textContent, LIMITES[nome] ?? LIMITE_PADRAO);
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

const resultadoComErro = (codigo: string, textoErro: string): ResultadoLeituraNfe => ({
  ok: false,
  erros: [{ codigo, texto: textoErro }],
  avisos: [],
  nota: null,
  itens: [],
});

export function lerXmlNfe(conteudo: string, opcoes: OpcoesLeituraNfe = {}): ResultadoLeituraNfe {
  const tamanho = opcoes.tamanhoBytes ?? new TextEncoder().encode(conteudo).length;
  if (tamanho > TAMANHO_MAXIMO_XML_NFE) {
    return resultadoComErro("tamanho", "O arquivo passa de 5 MB. Um XML de NF-e não chega nem perto disso; confira se escolheu o arquivo certo.");
  }

  const xml = conteudo.replace(/^\uFEFF/, "");
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    return resultadoComErro("doctype", "O arquivo tem declarações (DOCTYPE/ENTITY) que uma NF-e não tem. Por segurança, ele não foi lido.");
  }

  const parser = opcoes.criarParser ? opcoes.criarParser() : new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0 || !doc.documentElement) {
    return resultadoComErro("xml_invalido", "O arquivo não é um XML válido (está corrompido ou incompleto).");
  }

  const raiz = doc.documentElement;
  if (raiz.namespaceURI !== NAMESPACE_NFE || (raiz.localName !== "nfeProc" && raiz.localName !== "NFe")) {
    return resultadoComErro("nao_nfe", "Este XML não é de uma NF-e (esperado nfeProc ou NFe do portal fiscal).");
  }

  const nfe = raiz.localName === "nfeProc" ? filho(raiz, "NFe") : raiz;
  const infNFe = filho(nfe, "infNFe");
  const ide = filho(infNFe, "ide");
  if (!infNFe || !ide) {
    return resultadoComErro("nao_nfe", "O XML não tem os dados da nota (infNFe/ide).");
  }

  const versao = limparTexto(infNFe.getAttribute("versao"), 10);
  if (versao !== "4.00") {
    return resultadoComErro("versao", `Leiaute ${versao || "desconhecido"} não suportado. Só NF-e versão 4.00.`);
  }

  const modelo = texto(ide, "mod");
  if (modelo !== "55") {
    return resultadoComErro(
      "modelo",
      modelo === "65"
        ? "Este XML é de uma NFC-e (cupom fiscal, modelo 65). Só notas de compra NF-e (modelo 55) podem ser importadas."
        : `Modelo ${modelo || "desconhecido"} não suportado. Só NF-e modelo 55.`,
    );
  }

  const tpAmb = texto(ide, "tpAmb");
  if (tpAmb === "2") {
    return resultadoComErro("homologacao", "Esta nota foi emitida em HOMOLOGAÇÃO (ambiente de testes) e não tem valor fiscal. Peça ao fornecedor o XML da nota de produção.");
  }
  if (tpAmb !== "1") {
    return resultadoComErro("ambiente", "Ambiente da nota (tpAmb) não informado ou inválido.");
  }

  const erros: MensagemLeitura[] = [];
  const avisos: MensagemLeitura[] = [];

  const lerDecimal = (el: Element | null, nome: string, obrigatorio: boolean, nItem?: number): string => {
    const v = texto(el, nome);
    if (!v) {
      if (obrigatorio) erros.push({ codigo: "campo_ausente", texto: `Campo ${nome} ausente.`, nItem });
      return "";
    }
    if (!DECIMAL.test(v)) {
      erros.push({ codigo: "decimal_invalido", texto: `Valor inválido em ${nome}: "${v.slice(0, 30)}".`, nItem });
      return "";
    }
    return v;
  };

  // ---- emitente / destinatário ----
  const emit = filho(infNFe, "emit");
  const emitente: EmitenteNfe = {
    cnpj: soDigitos(texto(emit, "CNPJ")) || null,
    cpf: soDigitos(texto(emit, "CPF")) || null,
    nome: texto(emit, "xNome"),
    nomeFantasia: texto(emit, "xFant"),
    ie: texto(emit, "IE"),
    uf: texto(filho(emit, "enderEmit"), "UF"),
  };
  if (!emitente.cnpj && !emitente.cpf) erros.push({ codigo: "emitente", texto: "A nota não informa o CNPJ/CPF do emitente." });

  const dest = filho(infNFe, "dest");
  const destinatario: ParteNfe | null = dest
    ? { cnpj: soDigitos(texto(dest, "CNPJ")) || null, cpf: soDigitos(texto(dest, "CPF")) || null, nome: texto(dest, "xNome") }
    : null;

  // ---- protocolo ----
  const protNFe = raiz.localName === "nfeProc" ? filho(raiz, "protNFe") : null;
  const infProt = filho(protNFe, "infProt");
  const protocolo: ProtocoloNfe | null = infProt
    ? {
        chave: soDigitos(texto(infProt, "chNFe")),
        numero: texto(infProt, "nProt"),
        cStat: texto(infProt, "cStat"),
        motivo: texto(infProt, "xMotivo"),
        dataRecebimento: texto(infProt, "dhRecbto"),
      }
    : null;
  const autorizada = protocolo?.cStat === "100" || protocolo?.cStat === "150";
  if (!protocolo) {
    avisos.push({ codigo: "sem_protocolo", texto: "O XML não tem o protocolo de autorização da SEFAZ (protNFe). Não dá para saber se a nota foi autorizada; peça ao fornecedor o XML completo (nfeProc)." });
  } else if (!autorizada) {
    avisos.push({ codigo: "nao_autorizada", texto: `O protocolo não indica nota autorizada (cStat ${protocolo.cStat || "vazio"}${protocolo.motivo ? `: ${protocolo.motivo}` : ""}).` });
  }

  // ---- ide ----
  const serie = texto(ide, "serie");
  const numero = texto(ide, "nNF");
  const dataEmissao = texto(ide, "dhEmi");
  const tpNF = texto(ide, "tpNF");
  const finNFe = texto(ide, "finNFe");
  if (finNFe === "4") avisos.push({ codigo: "devolucao", texto: "Esta é uma nota de DEVOLUÇÃO (finalidade 4), não uma compra comum." });
  if (tpNF === "0") avisos.push({ codigo: "entrada", texto: "Nota de ENTRADA emitida pelo próprio emitente (tpNF 0). Confira se é mesmo uma compra sua." });

  // ---- chave de acesso ----
  const chave = limparTexto(infNFe.getAttribute("Id"), 50).replace(/^NFe/, "");
  if (!chaveNfeValida(chave)) {
    erros.push({ codigo: "chave_invalida", texto: "Chave de acesso inválida (precisa ter 44 dígitos com dígito verificador correto)." });
  } else {
    const docEmitente = emitente.cnpj ?? (emitente.cpf ? emitente.cpf.padStart(14, "0") : "");
    const esperado: Array<[string, string, string]> = [
      ["UF", chave.slice(0, 2), texto(ide, "cUF")],
      ["ano/mês de emissão", chave.slice(2, 6), dataEmissao.slice(2, 4) + dataEmissao.slice(5, 7)],
      ["CNPJ do emitente", chave.slice(6, 20), docEmitente.padStart(14, "0")],
      ["modelo", chave.slice(20, 22), modelo],
      ["série", chave.slice(22, 25), serie.padStart(3, "0")],
      ["número", chave.slice(25, 34), numero.padStart(9, "0")],
      ["tipo de emissão", chave.slice(34, 35), texto(ide, "tpEmis")],
      ["código numérico", chave.slice(35, 43), texto(ide, "cNF").padStart(8, "0")],
      ["dígito", chave.slice(43), texto(ide, "cDV")],
    ];
    const divergentes = esperado.filter(([, naChave, noXml]) => naChave !== noXml).map(([campo]) => campo);
    if (divergentes.length > 0) {
      erros.push({ codigo: "chave_divergente", texto: `A chave de acesso não bate com os dados da nota (${divergentes.join(", ")}). O arquivo pode ter sido alterado.` });
    }
    if (protocolo?.chave && protocolo.chave !== chave) {
      erros.push({ codigo: "chave_protocolo", texto: "A chave do protocolo de autorização é diferente da chave da nota." });
    }
  }

  // ---- totais ----
  const icmsTot = caminho(infNFe, "total", "ICMSTot");
  const totais: TotaisNfe = {
    vProd: lerDecimal(icmsTot, "vProd", true),
    vFrete: lerDecimal(icmsTot, "vFrete", false),
    vSeg: lerDecimal(icmsTot, "vSeg", false),
    vDesc: lerDecimal(icmsTot, "vDesc", false),
    vOutro: lerDecimal(icmsTot, "vOutro", false),
    vIPI: lerDecimal(icmsTot, "vIPI", false),
    vST: lerDecimal(icmsTot, "vST", false),
    vNF: lerDecimal(icmsTot, "vNF", true),
  };

  // ---- duplicatas ----
  const duplicatas: DuplicataNfe[] = filhos(filho(infNFe, "cobr"), "dup").map((dup) => ({
    numero: texto(dup, "nDup"),
    vencimento: texto(dup, "dVenc"),
    valor: lerDecimal(dup, "vDup", false),
  }));

  // ---- itens ----
  const dets = filhos(infNFe, "det");
  if (dets.length === 0) erros.push({ codigo: "sem_itens", texto: "A nota não tem itens." });
  if (dets.length > MAXIMO_ITENS_NFE) {
    erros.push({ codigo: "itens_demais", texto: `A nota tem ${dets.length} itens; o máximo de uma NF-e é ${MAXIMO_ITENS_NFE}.` });
  }

  const itens: ItemNfe[] = dets.slice(0, MAXIMO_ITENS_NFE).map((det, indice) => {
    const nItem = Number(limparTexto(det.getAttribute("nItem"), 4)) || indice + 1;
    const prod = filho(det, "prod");
    const imposto = filho(det, "imposto");
    const grupoIcms = filho(imposto, "ICMS")?.firstElementChild ?? null;

    const cEANOriginal = texto(prod, "cEAN");
    let ean: string | null = null;
    if (cEANOriginal && cEANOriginal.toUpperCase() !== "SEM GTIN") {
      if (gtinValido(cEANOriginal)) ean = cEANOriginal;
      else avisos.push({ codigo: "ean_invalido", texto: `Código de barras "${cEANOriginal.slice(0, 20)}" com dígito verificador inválido; será ignorado.`, nItem });
    }

    const qCom = lerDecimal(prod, "qCom", true, nItem);
    const xProd = texto(prod, "xProd");
    const infAdProd = texto(det, "infAdProd");
    const imeisSugeridos = extrairImeis(infAdProd, xProd);

    if (qCom && !decimalInteiro(qCom)) {
      avisos.push({ codigo: "quantidade_fracionada", texto: `Quantidade fracionada (${qCom} ${texto(prod, "uCom")}). O estoque só aceita quantidades inteiras.`, nItem });
    }
    if (imeisSugeridos.length > 0 && qCom && Number(qCom) !== imeisSugeridos.length) {
      avisos.push({ codigo: "imeis_quantidade", texto: `Foram achados ${imeisSugeridos.length} IMEI(s), mas a quantidade é ${Number(qCom)}. Confira os IMEIs.`, nItem });
    }

    return {
      nItem,
      cProd: texto(prod, "cProd"),
      ean,
      cEANOriginal,
      xProd,
      ncm: texto(prod, "NCM"),
      cest: texto(prod, "CEST"),
      cfop: texto(prod, "CFOP"),
      uCom: texto(prod, "uCom"),
      qCom,
      vUnCom: lerDecimal(prod, "vUnCom", true, nItem),
      vProd: lerDecimal(prod, "vProd", true, nItem),
      vDesc: lerDecimal(prod, "vDesc", false, nItem),
      vFrete: lerDecimal(prod, "vFrete", false, nItem),
      vSeg: lerDecimal(prod, "vSeg", false, nItem),
      vOutro: lerDecimal(prod, "vOutro", false, nItem),
      vIPI: lerDecimal(caminho(imposto, "IPI", "IPITrib"), "vIPI", false, nItem),
      vST: lerDecimal(grupoIcms, "vICMSST", false, nItem),
      vFCPST: lerDecimal(grupoIcms, "vFCPST", false, nItem),
      infAdProd,
      imeisSugeridos,
    };
  });

  // Soma dos itens x total da nota (só aviso: arredondamentos do emissor acontecem).
  const somaItens = itens.reduce((s, i) => s + (decimalParaCentavos(i.vProd) ?? 0), 0);
  const totalProdutos = decimalParaCentavos(totais.vProd);
  if (itens.length > 0 && totalProdutos !== null && somaItens !== totalProdutos) {
    avisos.push({ codigo: "total_divergente", texto: "A soma dos itens não bate com o total de produtos da nota." });
  }

  const infCpl = texto(filho(infNFe, "infAdic"), "infCpl");
  const imeisDosItens = new Set(itens.flatMap((i) => i.imeisSugeridos));
  const imeisInfCpl = extrairImeis(infCpl).filter((imei) => !imeisDosItens.has(imei));
  if (imeisInfCpl.length > 0) {
    avisos.push({ codigo: "imeis_infcpl", texto: `${imeisInfCpl.length} IMEI(s) nas informações complementares da nota, sem item definido. Confira a qual item pertencem.` });
  }

  const nota: NotaNfe = {
    chave,
    versao,
    modelo,
    serie,
    numero,
    dataEmissao,
    naturezaOperacao: texto(ide, "natOp"),
    tpNF,
    finNFe,
    tpAmb,
    emitente,
    destinatario,
    totais,
    protocolo,
    autorizada,
    infCpl,
    imeisInfCpl,
    duplicatas,
  };

  return { ok: erros.length === 0, erros, avisos, nota, itens };
}
