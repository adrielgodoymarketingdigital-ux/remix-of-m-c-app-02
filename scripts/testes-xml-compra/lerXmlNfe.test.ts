// deno test --no-check --no-lock -A scripts/testes-xml-compra/
// Leitura do XML de NF-e de compra (src/lib/nfe/lerXmlNfe.ts), só com XMLs
// fictícios (fixtures.ts). O Deno não tem DOMParser: usa o do jsdom, que segue
// a mesma especificação do navegador (application/xml + <parsererror>).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { JSDOM } from "npm:jsdom@25.0.1";
import {
  chaveNfeValida,
  conferirDestinatario,
  decimalInteiro,
  decimalParaCentavos,
  extrairImeis,
  gtinValido,
  lerXmlNfe,
  luhnValido,
  TAMANHO_MAXIMO_XML_NFE,
} from "../../src/lib/nfe/lerXmlNfe.ts";
import { CNPJ_EMITENTE_FICTICIO, CNPJ_LOJA_FICTICIA, gerarXmlNfe, imeiFicticio } from "./fixtures.ts";

const janela = new JSDOM("").window;
const criarParser = () => new janela.DOMParser() as unknown as DOMParser;
const ler = (xml: string, tamanhoBytes?: number) => lerXmlNfe(xml, { criarParser, tamanhoBytes });
const codigos = (lista: { codigo: string }[]) => lista.map((m) => m.codigo);

Deno.test("nota válida: cabeçalho, item, totais, duplicata e protocolo", () => {
  const r = ler(gerarXmlNfe());
  assertEquals(r.erros, []);
  assertEquals(r.avisos, []);
  assert(r.ok);
  const n = r.nota!;
  assert(chaveNfeValida(n.chave));
  assertEquals(n.chave.slice(6, 20), CNPJ_EMITENTE_FICTICIO);
  assertEquals([n.modelo, n.serie, n.numero, n.versao], ["55", "1", "1234", "4.00"]);
  assertEquals(n.emitente.cnpj, CNPJ_EMITENTE_FICTICIO);
  assertEquals(n.emitente.nome, "FORNECEDOR FICTICIO DE ACESSORIOS LTDA");
  assertEquals(n.destinatario?.cnpj, CNPJ_LOJA_FICTICIA);
  assertEquals(n.totais.vNF, "50.00");
  assert(n.autorizada);
  assertEquals(n.protocolo?.cStat, "100");
  assertEquals(n.duplicatas, [{ numero: "001", vencimento: "2026-11-15", valor: "50.00" }]);
  assertEquals(r.itens.length, 1);
  const it = r.itens[0];
  assertEquals([it.nItem, it.cProd, it.ean, it.ncm, it.cfop, it.uCom, it.qCom, it.vUnCom, it.vProd],
    [1, "FIC-001", "7891234567895", "39199090", "5102", "UN", "10.0000", "5.0000000000", "50.00"]);
  assertEquals(it.imeisSugeridos, []);
});

Deno.test("IPI e ICMS-ST do item são lidos", () => {
  const r = ler(gerarXmlNfe({ itens: [{ vIPI: "2.50", vICMSST: "3.10", vDesc: "1.00", vFrete: "0.75", CEST: "2105300" }] }));
  assert(r.ok);
  const it = r.itens[0];
  assertEquals([it.vIPI, it.vST, it.vDesc, it.vFrete, it.cest], ["2.50", "3.10", "1.00", "0.75", "2105300"]);
});

Deno.test("sem protNFe (só <NFe>) e cStat diferente de 100: aviso, não bloqueia", () => {
  const sem = ler(gerarXmlNfe({ comProtocolo: false }));
  assert(sem.ok);
  assertEquals(codigos(sem.avisos), ["sem_protocolo"]);
  assertEquals(sem.nota?.autorizada, false);

  const denegada = ler(gerarXmlNfe({ cStat: "110" }));
  assert(denegada.ok);
  assertEquals(codigos(denegada.avisos), ["nao_autorizada"]);

  // 150 = autorizada fora de prazo: continua autorizada.
  const foraPrazo = ler(gerarXmlNfe({ cStat: "150" }));
  assertEquals(foraPrazo.avisos, []);
  assert(foraPrazo.nota?.autorizada);
});

Deno.test("DOCTYPE/ENTITY malicioso é rejeitado antes do parse", () => {
  const xxe = gerarXmlNfe({ prologoExtra: '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>' });
  assertEquals(codigos(ler(xxe).erros), ["doctype"]);
  const risos = gerarXmlNfe({ prologoExtra: '<!DOCTYPE l [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;">]>' });
  const r = ler(risos);
  assertEquals(codigos(r.erros), ["doctype"]);
  assertEquals(r.nota, null);
  // Minúsculas também.
  assertEquals(codigos(ler(gerarXmlNfe({ prologoExtra: "<!doctype x>" })).erros), ["doctype"]);
});

Deno.test("modelo 65 (NFC-e) é bloqueado", () => {
  const r = ler(gerarXmlNfe({ modelo: "65" }));
  assertEquals(codigos(r.erros), ["modelo"]);
  assert(r.erros[0].texto.includes("NFC-e"));
  assertEquals(r.nota, null);
});

Deno.test("homologação é bloqueada com mensagem clara", () => {
  const r = ler(gerarXmlNfe({ tpAmb: "2" }));
  assertEquals(codigos(r.erros), ["homologacao"]);
  assert(r.erros[0].texto.includes("HOMOLOGAÇÃO"));
});

Deno.test("versão diferente de 4.00 é bloqueada", () => {
  assertEquals(codigos(ler(gerarXmlNfe({ versao: "3.10" })).erros), ["versao"]);
});

Deno.test("chave inválida (DV) e chave que não bate com o XML", () => {
  const adulterada = ler(gerarXmlNfe({ adulterarChave: true }));
  assert(!adulterada.ok);
  assert(codigos(adulterada.erros).includes("chave_invalida"));

  const divergente = ler(gerarXmlNfe({ nNFDivergente: "999" }));
  assert(!divergente.ok);
  assertEquals(codigos(divergente.erros), ["chave_divergente"]);
  assert(divergente.erros[0].texto.includes("número"));
  // A nota ainda aparece (para mostrar a situação da chave), mas ok = false.
  assert(divergente.nota !== null);
});

Deno.test("arquivo acima de 5 MB é rejeitado sem ler", () => {
  const r = ler(gerarXmlNfe(), TAMANHO_MAXIMO_XML_NFE + 1);
  assertEquals(codigos(r.erros), ["tamanho"]);
  // Sem tamanhoBytes, mede o próprio texto.
  const grande = gerarXmlNfe({ infCpl: "x".repeat(TAMANHO_MAXIMO_XML_NFE) });
  assertEquals(codigos(lerXmlNfe(grande, { criarParser }).erros), ["tamanho"]);
});

Deno.test("XML quebrado, outro namespace e raiz errada", () => {
  assertEquals(codigos(ler("<nfeProc xmlns=\"http://www.portalfiscal.inf.br/nfe\"><NFe>").erros), ["xml_invalido"]);
  assertEquals(codigos(ler("<?xml version=\"1.0\"?><nfeProc><NFe/></nfeProc>").erros), ["nao_nfe"]);
  assertEquals(codigos(ler("<?xml version=\"1.0\"?><outra xmlns=\"http://www.portalfiscal.inf.br/nfe\"/>").erros), ["nao_nfe"]);
});

Deno.test("SEM GTIN vira null sem aviso; GTIN com DV errado vira null com aviso", () => {
  const r = ler(gerarXmlNfe({ itens: [{ cEAN: "SEM GTIN" }, { cEAN: "7891234567890", cProd: "FIC-002" }] }));
  assert(r.ok);
  assertEquals(r.itens[0].ean, null);
  assertEquals(r.itens[0].cEANOriginal, "SEM GTIN");
  assertEquals(r.itens[1].ean, null);
  assertEquals(r.avisos.map((a) => [a.codigo, a.nItem]), [["ean_invalido", 2]]);
});

Deno.test("qCom com 4 casas é preservado como string; fracionado gera aviso", () => {
  const r = ler(gerarXmlNfe({ itens: [{ qCom: "2.5000", vUnCom: "3.3333333333", vProd: "8.33" }] }));
  assert(r.ok);
  assertEquals(r.itens[0].qCom, "2.5000");
  assertEquals(r.itens[0].vUnCom, "3.3333333333");
  assertEquals(codigos(r.avisos), ["quantidade_fracionada"]);
  const inteiro = ler(gerarXmlNfe({ itens: [{ qCom: "3.0000", vProd: "15.00" }] }));
  assertEquals(inteiro.avisos, []);
});

Deno.test("IMEI em infAdProd: sugere os válidos e avisa se a quantidade difere", () => {
  const a = imeiFicticio("35000000000001");
  const b = imeiFicticio("35000000000002");
  const invalido = a.slice(0, 14) + ((Number(a[14]) + 1) % 10);
  const r = ler(gerarXmlNfe({ itens: [{
    xProd: "CELULAR FICTICIO X 128GB", NCM: "85171300", qCom: "2.0000", vUnCom: "1000.00", vProd: "2000.00",
    infAdProd: `IMEI: ${a}; IMEI: ${b}; serie ${invalido}`,
  }] }));
  assert(r.ok);
  assertEquals(r.itens[0].imeisSugeridos, [a, b]);
  assertEquals(r.avisos, []);

  const faltando = ler(gerarXmlNfe({ itens: [{ qCom: "3.0000", vUnCom: "1000.00", vProd: "3000.00", infAdProd: `IMEI ${a}` }] }));
  assertEquals(codigos(faltando.avisos), ["imeis_quantidade"]);
});

Deno.test("IMEI só em infCpl fica na nota, com aviso", () => {
  const a = imeiFicticio("35000000000003");
  const r = ler(gerarXmlNfe({ infCpl: `Aparelhos: ${a}` }));
  assertEquals(r.nota?.imeisInfCpl, [a]);
  assertEquals(codigos(r.avisos), ["imeis_infcpl"]);
});

Deno.test("devolução e tpNF=0 avisam", () => {
  assertEquals(codigos(ler(gerarXmlNfe({ finNFe: "4" })).avisos), ["devolucao"]);
  assertEquals(codigos(ler(gerarXmlNfe({ tpNF: "0" })).avisos), ["entrada"]);
});

Deno.test("texto: escapes do XML voltam como texto puro e o tamanho é limitado", () => {
  const r = ler(gerarXmlNfe({ itens: [{ xProd: "<script>alert(1)</script> & " + "Y".repeat(300) }] }));
  assert(r.ok);
  const x = r.itens[0].xProd;
  assert(x.startsWith("<script>alert(1)</script> & "));
  assertEquals(x.length, 120);
  // Caractere de controle cru é proibido no XML 1.0: o parser já recusa o arquivo.
  assertEquals(codigos(ler(gerarXmlNfe({ itens: [{ xProd: "A\u0007B" }] })).erros), ["xml_invalido"]);
});

Deno.test("nota com 990 itens lê rápido", () => {
  const itens = Array.from({ length: 990 }, (_, i) => ({ cProd: `FIC-${i}`, qCom: "1.0000", vUnCom: "1.00", vProd: "1.00" }));
  const xml = gerarXmlNfe({ itens });
  const inicio = performance.now();
  const r = ler(xml);
  const ms = performance.now() - inicio;
  console.log(`    990 itens (${(xml.length / 1024).toFixed(0)} KB) em ${ms.toFixed(0)} ms`);
  assert(r.ok);
  assertEquals(r.itens.length, 990);
  assertEquals(r.itens[989].nItem, 990);
  assert(ms < 3000, `lento demais: ${ms} ms`);
});

Deno.test("mais de 990 itens é erro", () => {
  const itens = Array.from({ length: 991 }, () => ({ qCom: "1.0000", vUnCom: "1.00", vProd: "1.00" }));
  assert(codigos(ler(gerarXmlNfe({ itens })).erros).includes("itens_demais"));
});

Deno.test("destinatário x CNPJ da loja", () => {
  const nota = ler(gerarXmlNfe()).nota!;
  assertEquals(conferirDestinatario(nota, ["44.555.666/0001-72"]), "confere");
  assertEquals(conferirDestinatario(nota, ["99.888.777/0001-66"]), "nao_confere");
  assertEquals(conferirDestinatario(nota, ["", null, undefined]), "loja_sem_cnpj");
  assertEquals(conferirDestinatario(ler(gerarXmlNfe({ destCnpj: null })).nota!, [CNPJ_LOJA_FICTICIA]), "nota_sem_destinatario");
});

Deno.test("utilitários: GTIN, Luhn, IMEI, decimais", () => {
  assert(gtinValido("7891234567895"));
  assert(!gtinValido("7891234567890"));
  assert(gtinValido("96385074")); // GTIN-8
  assert(luhnValido("490154203237518"));
  assertEquals(extrairImeis("x 490154203237518 y", "4901542032375180"), ["490154203237518"]);
  assertEquals(decimalParaCentavos("12.345"), 1235);
  assertEquals(decimalParaCentavos("12.344"), 1234);
  assertEquals(decimalParaCentavos("7"), 700);
  assertEquals(decimalParaCentavos("1,00"), null);
  assert(decimalInteiro("3.0000"));
  assert(!decimalInteiro("2.5000"));
});
