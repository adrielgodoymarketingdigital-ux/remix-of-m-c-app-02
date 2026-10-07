// deno test --no-check scripts/testes-recibo-cabecalho/
// Cabeçalho dos recibos de venda (src/lib/recibo/cabecalhoRecibo.ts): logo à
// esquerda e dados da loja ao lado, em 58mm, 80mm e A4/PDF.
import { assertEquals } from "jsr:@std/assert@1";
import {
  CAMPOS_LOJA_PDF_TERMICO,
  CAMPOS_LOJA_RECIBO_DISPOSITIVO,
  LIMITES_LOGO_MM,
  cssCabecalhoRecibo,
  encaixarLogo,
  escaparHtml,
  linhasDadosLoja,
  montarCabecalhoReciboHtml,
} from "../../src/lib/recibo/cabecalhoRecibo.ts";

const LOJA = {
  nome_loja: "Mega Celulares",
  cnpj: "12.345.678/0001-90",
  endereco: "Rua A, 10 - Centro",
  telefone: "(11) 3333-4444",
  whatsapp: "(11) 99999-8888",
  email: "contato@mega.com.br",
};
const sem = (s: string) => s.replace(/\s+/g, " ");

Deno.test("com logo: logo à esquerda e dados ao lado, na mesma linha", () => {
  const html = montarCabecalhoReciboHtml({ logoSrc: "https://x/logo.png", nomeLoja: LOJA.nome_loja, linhas: linhasDadosLoja(LOJA) });
  assertEquals(html.startsWith('<div class="recibo-cab recibo-cab--com-logo"><div class="recibo-cab-logo"><img src="https://x/logo.png"'), true);
  // Logo vem antes dos dados (esquerda) e os dados ficam numa coluna só.
  assertEquals(html.indexOf("recibo-cab-logo") < html.indexOf("recibo-cab-dados"), true);
  assertEquals(html.includes('<div class="recibo-cab-nome">Mega Celulares</div>'), true);
  assertEquals((html.match(/recibo-cab-linha/g) ?? []).length, 5);
});

Deno.test("sem logo: só os dados, largura toda, sem espaço vazio à esquerda", () => {
  for (const logoSrc of [null, undefined, "", "   "]) {
    const html = montarCabecalhoReciboHtml({ logoSrc, nomeLoja: "Loja", linhas: ["Tel: 1"] });
    assertEquals(html, '<div class="recibo-cab recibo-cab--sem-logo"><div class="recibo-cab-dados"><div class="recibo-cab-nome">Loja</div><div class="recibo-cab-linha">Tel: 1</div></div></div>');
  }
  const css = sem(cssCabecalhoRecibo("80mm"));
  assertEquals(css.includes(".recibo-cab--sem-logo { display: block; text-align: center; }"), true);
});

Deno.test("logo que não carrega: some e o cabeçalho vira o de sem logo", () => {
  const html = montarCabecalhoReciboHtml({ logoSrc: "x.png", nomeLoja: "L", linhas: [] });
  assertEquals(html.includes(`onerror="this.parentNode.style.display='none';this.parentNode.parentNode.className='recibo-cab recibo-cab--sem-logo'"`), true);
});

Deno.test("nome e endereço longos quebram dentro da coluna dos dados", () => {
  const longo = "Avenida Presidente Juscelino Kubitschek de Oliveira, 1234, Sala 56, Centro Comercial Boa Vista, São Paulo - SP";
  const html = montarCabecalhoReciboHtml({ logoSrc: "l.png", nomeLoja: "Assistência Técnica Mega Celulares e Acessórios Ltda", linhas: linhasDadosLoja({ ...LOJA, endereco: longo }) });
  assertEquals(html.includes(`<div class="recibo-cab-linha">${longo}</div>`), true);
  for (const f of ["58mm", "80mm", "a4"] as const) {
    const css = sem(cssCabecalhoRecibo(f));
    // Coluna dos dados encolhe (min-width: 0) e quebra palavra comprida; o logo não encolhe.
    assertEquals(css.includes(".recibo-cab-dados { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }"), true, f);
    assertEquals(css.includes(".recibo-cab-logo { flex: 0 0 auto;"), true, f);
  }
});

Deno.test("58mm: logo até 14mm, letras menores", () => {
  const css = sem(cssCabecalhoRecibo("58mm"));
  assertEquals(css.includes("max-width: 14mm; max-height: 14mm; object-fit: contain;"), true);
  assertEquals(css.includes(".recibo-cab-nome { font-size: 11px;"), true);
  assertEquals(css.includes(".recibo-cab-linha { font-size: 9px;"), true);
  assertEquals(css.includes("gap: 1.5mm;"), true);
});

Deno.test("80mm: logo até 22×22mm, proporção preservada", () => {
  const css = sem(cssCabecalhoRecibo("80mm"));
  assertEquals(css.includes(".recibo-cab-logo img { display: block; width: auto; height: auto; max-width: 22mm; max-height: 22mm; object-fit: contain; margin: 0; }"), true);
  assertEquals(css.includes(".recibo-cab { display: flex; align-items: flex-start; gap: 2mm; width: 100%; }"), true);
});

Deno.test("A4: logo até 30mm de largura", () => {
  assertEquals(LIMITES_LOGO_MM.a4, { larguraMm: 30, alturaMm: 22 });
  const css = sem(cssCabecalhoRecibo("a4"));
  assertEquals(css.includes("max-width: 30mm; max-height: 22mm;"), true);
  assertEquals(css.includes(".recibo-cab-nome { font-size: 18px;"), true);
});

Deno.test("encaixe do logo (PDF): largo limita pela largura, alto pela altura, sem distorcer", () => {
  assertEquals(encaixarLogo(400, 100, "80mm"), { larguraMm: 22, alturaMm: 5.5 });
  assertEquals(encaixarLogo(60, 240, "80mm"), { larguraMm: 5.5, alturaMm: 22 });
  assertEquals(encaixarLogo(100, 100, "58mm"), { larguraMm: 14, alturaMm: 14 });
  assertEquals(encaixarLogo(300, 100, "a4"), { larguraMm: 30, alturaMm: 10 });
  assertEquals(encaixarLogo(100, 200, "a4"), { larguraMm: 11, alturaMm: 22 });
  for (const [w, h] of [[0, 10], [10, 0], [NaN, 10], [-1, 5]]) assertEquals(encaixarLogo(w, h, "80mm"), null);
});

Deno.test("campos opcionais ausentes (CNPJ, telefone): linhas só com o que existe", () => {
  assertEquals(linhasDadosLoja({ nome_loja: "L", endereco: "Rua B", email: "a@b.c" }), ["Rua B", "a@b.c"]);
  assertEquals(linhasDadosLoja({ nome_loja: "L", cnpj: "  ", telefone: null }), []);
  assertEquals(linhasDadosLoja(null), []);
  assertEquals(linhasDadosLoja(LOJA), ["CNPJ: 12.345.678/0001-90", "Rua A, 10 - Centro", "Tel: (11) 3333-4444", "WhatsApp: (11) 99999-8888", "contato@mega.com.br"]);
  // Recibos de Dispositivos: só os campos que já mostravam.
  assertEquals(linhasDadosLoja(LOJA, CAMPOS_LOJA_RECIBO_DISPOSITIVO), ["CNPJ: 12.345.678/0001-90", "Rua A, 10 - Centro", "Tel: (11) 3333-4444"]);
  assertEquals(linhasDadosLoja({ endereco: "Rua B" }, CAMPOS_LOJA_RECIBO_DISPOSITIVO), ["Rua B"]);
  assertEquals(linhasDadosLoja(LOJA, CAMPOS_LOJA_PDF_TERMICO), ["CNPJ: 12.345.678/0001-90", "Tel: (11) 3333-4444"]);
  const html = montarCabecalhoReciboHtml({ logoSrc: null, nomeLoja: null, linhas: [] });
  assertEquals(html, '<div class="recibo-cab recibo-cab--sem-logo"><div class="recibo-cab-dados"><div class="recibo-cab-nome"></div></div></div>');
});

Deno.test("texto da loja é escapado (sem HTML injetado)", () => {
  assertEquals(escaparHtml(`<b>"A&B"</b>`), "&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;");
  const html = montarCabecalhoReciboHtml({ logoSrc: `x" onload="alert(1)`, nomeLoja: "<script>", linhas: [] });
  assertEquals(html.includes("<script>"), false);
  assertEquals(html.includes('src="x&quot; onload=&quot;alert(1)"'), true);
});

Deno.test("tema escuro (faixa do recibo de Dispositivos): texto claro e logo num quadro branco", () => {
  const css = sem(cssCabecalhoRecibo("a4", { tema: "escuro", escopo: ".recibo-print-header" }));
  assertEquals(css.includes(".recibo-print-header .recibo-cab-nome { font-size: 18px; font-weight: 900; line-height: 1.2; color: #ffffff;"), true);
  assertEquals(css.includes("background: #ffffff; padding: 1mm; border-radius: 1mm;"), true);
  // Compacto: letras e logo A4 menores (a faixa não cresce).
  const compacto = sem(cssCabecalhoRecibo("a4", { tema: "escuro", compacto: true }));
  assertEquals(compacto.includes("max-width: 30mm; max-height: 12mm;"), true);
  assertEquals(compacto.includes(".recibo-cab-nome { font-size: 14px;"), true);
  assertEquals(compacto.includes(".recibo-cab-linha { font-size: 9px;"), true);
  assertEquals(sem(cssCabecalhoRecibo("80mm", { compacto: true })).includes("max-height: 22mm;"), true);
});
