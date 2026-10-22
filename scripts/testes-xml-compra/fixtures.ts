// Gerador de XMLs de NF-e 100% FICTÍCIOS para os testes da leitura
// (src/lib/nfe/lerXmlNfe.ts). Nenhum dado real: CNPJs, nomes, códigos e IMEIs
// são inventados. Nunca colocar XML real neste repositório.
import { digitoChaveNfe } from "../../src/lib/nfe/lerXmlNfe.ts";

export const CNPJ_EMITENTE_FICTICIO = "11222333000181";
export const CNPJ_LOJA_FICTICIA = "44555666000172";

/** Completa 14 dígitos com o dígito de Luhn → IMEI fictício válido. */
export function imeiFicticio(base14: string): string {
  for (let d = 0; d <= 9; d++) {
    const n = base14 + d;
    let soma = 0;
    for (let i = n.length - 1, dobrar = false; i >= 0; i--, dobrar = !dobrar) {
      let x = Number(n[i]);
      if (dobrar) { x *= 2; if (x > 9) x -= 9; }
      soma += x;
    }
    if (soma % 10 === 0) return n;
  }
  throw new Error("inalcançável");
}

export interface ItemFicticio {
  cProd?: string;
  cEAN?: string;
  xProd?: string;
  NCM?: string;
  CEST?: string;
  CFOP?: string;
  uCom?: string;
  qCom?: string;
  vUnCom?: string;
  vProd?: string;
  vDesc?: string;
  vFrete?: string;
  vIPI?: string;
  vICMSST?: string;
  vFCPST?: string;
  vSeg?: string;
  vOutro?: string;
  /** Padrão: igual a cEAN / uCom / qCom. */
  cEANTrib?: string;
  uTrib?: string;
  qTrib?: string;
  infAdProd?: string;
}

export interface OpcoesFicticias {
  modelo?: string;
  tpAmb?: string;
  versao?: string;
  tpNF?: string;
  finNFe?: string;
  /** false = só <NFe>, sem nfeProc/protNFe. */
  comProtocolo?: boolean;
  cStat?: string;
  serie?: string;
  nNF?: string;
  dhEmi?: string;
  itens?: ItemFicticio[];
  /** Troca um dígito da chave (depois de calcular o DV). */
  adulterarChave?: boolean;
  /** Muda o nNF depois de montar a chave (chave diverge do XML). */
  nNFDivergente?: string;
  destCnpj?: string | null;
  duplicatas?: Array<{ nDup: string; dVenc: string; vDup: string }>;
  infCpl?: string;
  /** Texto inserido logo após a declaração <?xml ...?>. */
  prologoExtra?: string;
}

const ITEM_PADRAO: Required<Omit<ItemFicticio, "vDesc" | "vFrete" | "vIPI" | "vICMSST" | "vFCPST" | "vSeg" | "vOutro" | "cEANTrib" | "uTrib" | "qTrib" | "infAdProd" | "CEST">> = {
  cProd: "FIC-001",
  cEAN: "7891234567895",
  xProd: "PELICULA FICTICIA 3D MODELO TESTE",
  NCM: "39199090",
  CFOP: "5102",
  uCom: "UN",
  qCom: "10.0000",
  vUnCom: "5.0000000000",
  vProd: "50.00",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function gerarXmlNfe(o: OpcoesFicticias = {}): string {
  const cUF = "35";
  const modelo = o.modelo ?? "55";
  const serie = o.serie ?? "1";
  const nNF = o.nNF ?? "1234";
  const dhEmi = o.dhEmi ?? "2026-10-15T10:30:00-03:00";
  const tpEmis = "1";
  const cNF = "87654321";
  const aamm = dhEmi.slice(2, 4) + dhEmi.slice(5, 7);
  const chave43 = cUF + aamm + CNPJ_EMITENTE_FICTICIO + modelo.padStart(2, "0") + serie.padStart(3, "0") +
    nNF.padStart(9, "0") + tpEmis + cNF;
  const cDV = String(digitoChaveNfe(chave43));
  let chave = chave43 + cDV;
  if (o.adulterarChave) chave = chave.slice(0, 30) + ((Number(chave[30]) + 1) % 10) + chave.slice(31);

  const itens = o.itens ?? [{}];
  let somaProd = 0;
  const dets = itens.map((parcial, i) => {
    const it = { ...ITEM_PADRAO, ...parcial };
    somaProd += Math.round(Number(it.vProd) * 100);
    const st = it.vICMSST
      ? `<ICMS><ICMS10><orig>0</orig><CST>10</CST><vBCST>0.00</vBCST><pICMSST>0.00</pICMSST><vICMSST>${it.vICMSST}</vICMSST>${it.vFCPST ? `<vFCPST>${it.vFCPST}</vFCPST>` : ""}</ICMS10></ICMS>`
      : `<ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS>`;
    const ipi = it.vIPI ? `<IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><vIPI>${it.vIPI}</vIPI></IPITrib></IPI>` : "";
    return `<det nItem="${i + 1}"><prod><cProd>${esc(it.cProd)}</cProd><cEAN>${esc(it.cEAN)}</cEAN><xProd>${esc(it.xProd)}</xProd>` +
      `<NCM>${it.NCM}</NCM>${it.CEST ? `<CEST>${it.CEST}</CEST>` : ""}<CFOP>${it.CFOP}</CFOP><uCom>${it.uCom}</uCom><qCom>${it.qCom}</qCom>` +
      `<vUnCom>${it.vUnCom}</vUnCom><vProd>${it.vProd}</vProd><cEANTrib>${esc(it.cEANTrib ?? it.cEAN)}</cEANTrib><uTrib>${it.uTrib ?? it.uCom}</uTrib>` +
      `<qTrib>${it.qTrib ?? it.qCom}</qTrib><vUnTrib>${it.vUnCom}</vUnTrib>${it.vFrete ? `<vFrete>${it.vFrete}</vFrete>` : ""}` +
      `${it.vSeg ? `<vSeg>${it.vSeg}</vSeg>` : ""}${it.vDesc ? `<vDesc>${it.vDesc}</vDesc>` : ""}` +
      `${it.vOutro ? `<vOutro>${it.vOutro}</vOutro>` : ""}<indTot>1</indTot></prod>` +
      `<imposto>${st}${ipi}</imposto>${it.infAdProd ? `<infAdProd>${esc(it.infAdProd)}</infAdProd>` : ""}</det>`;
  }).join("");
  const vProd = (somaProd / 100).toFixed(2);

  const dest = o.destCnpj === null
    ? ""
    : `<dest><CNPJ>${o.destCnpj ?? CNPJ_LOJA_FICTICIA}</CNPJ><xNome>LOJA FICTICIA DE CELULARES</xNome><indIEDest>9</indIEDest></dest>`;
  const dups = (o.duplicatas ?? [{ nDup: "001", dVenc: "2026-11-15", vDup: vProd }])
    .map((d) => `<dup><nDup>${d.nDup}</nDup><dVenc>${d.dVenc}</dVenc><vDup>${d.vDup}</vDup></dup>`).join("");

  const infNFe = `<infNFe Id="NFe${chave}" versao="${o.versao ?? "4.00"}"><ide><cUF>${cUF}</cUF><cNF>${cNF}</cNF>` +
    `<natOp>VENDA DE MERCADORIA</natOp><mod>${modelo}</mod><serie>${serie}</serie><nNF>${o.nNFDivergente ?? nNF}</nNF>` +
    `<dhEmi>${dhEmi}</dhEmi><tpNF>${o.tpNF ?? "1"}</tpNF><idDest>1</idDest><cMunFG>3550308</cMunFG><tpImp>1</tpImp>` +
    `<tpEmis>${tpEmis}</tpEmis><cDV>${cDV}</cDV><tpAmb>${o.tpAmb ?? "1"}</tpAmb><finNFe>${o.finNFe ?? "1"}</finNFe>` +
    `<indFinal>0</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>FICTICIO 1.0</verProc></ide>` +
    `<emit><CNPJ>${CNPJ_EMITENTE_FICTICIO}</CNPJ><xNome>FORNECEDOR FICTICIO DE ACESSORIOS LTDA</xNome>` +
    `<xFant>FICTICIO ACESSORIOS</xFant><enderEmit><xLgr>RUA INVENTADA</xLgr><nro>0</nro><xBairro>CENTRO</xBairro>` +
    `<cMun>3550308</cMun><xMun>SAO PAULO</xMun><UF>SP</UF></enderEmit><IE>ISENTO</IE><CRT>1</CRT></emit>` +
    `${dest}${dets}<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vST>0.00</vST><vProd>${vProd}</vProd>` +
    `<vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vIPI>0.00</vIPI><vOutro>0.00</vOutro><vNF>${vProd}</vNF>` +
    `</ICMSTot></total><transp><modFrete>9</modFrete></transp><cobr><fat><nFat>${nNF}</nFat><vOrig>${vProd}</vOrig>` +
    `<vLiq>${vProd}</vLiq></fat>${dups}</cobr><pag><detPag><tPag>15</tPag><vPag>${vProd}</vPag></detPag></pag>` +
    `${o.infCpl ? `<infAdic><infCpl>${esc(o.infCpl)}</infCpl></infAdic>` : ""}</infNFe>`;

  const nfe = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">${infNFe}</NFe>`;
  const corpo = o.comProtocolo === false
    ? nfe
    : `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${nfe}<protNFe versao="4.00"><infProt>` +
      `<tpAmb>1</tpAmb><verAplic>FICTICIO</verAplic><chNFe>${chave}</chNFe><dhRecbto>2026-10-15T10:31:00-03:00</dhRecbto>` +
      `<nProt>135260000000001</nProt><digVal>ZmljdGljaW8=</digVal><cStat>${o.cStat ?? "100"}</cStat>` +
      `<xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`;
  return `<?xml version="1.0" encoding="UTF-8"?>${o.prologoExtra ?? ""}${corpo}`;
}
