// deno test --no-check scripts/testes-marketing-avaliacao/
// Roda as funções reais de src/lib/marketing/avaliacaoGoogle.ts e
// src/lib/configuracaoLoja/mesclarMensagensWhatsAppOS.ts.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  CHAVE_ATIVO_AVALIACAO,
  CHAVE_LINK_AVALIACAO,
  CHAVE_MENSAGEM_AVALIACAO,
  MENSAGEM_AVALIACAO_PADRAO,
  deveOferecerAvaliacaoAoEntregar,
  lerConfigAvaliacaoGoogle,
  montarMensagemAvaliacao,
  selecionarOSEntreguesRecentes,
  validarLinkAvaliacaoGoogle,
} from "../../src/lib/marketing/avaliacaoGoogle.ts";
import { mesclarMensagensWhatsAppOS } from "../../src/lib/configuracaoLoja/mesclarMensagensWhatsAppOS.ts";

const ok = (texto: string) => {
  const r = validarLinkAvaliacaoGoogle(texto);
  assert(r.ok, `${texto} deveria ser aceito: ${JSON.stringify(r)}`);
  return r.url;
};
const motivo = (texto: string | null | undefined) => {
  const r = validarLinkAvaliacaoGoogle(texto);
  assert(!r.ok, `${texto} deveria ser recusado`);
  return r.motivo;
};

// ── validarLinkAvaliacaoGoogle ──────────────────────────────────────────────
Deno.test("aceita g.page (link de 'Pedir avaliações')", () => {
  assertEquals(ok("https://g.page/r/CbAbC123xyz/review"), "https://g.page/r/CbAbC123xyz/review");
});

Deno.test("aceita search.google.com/local/writereview com placeid", () => {
  const u = ok("https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4");
  assertEquals(u, "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4");
});

Deno.test("aceita maps.app.goo.gl, goo.gl, g.co e google.com/maps", () => {
  ok("https://maps.app.goo.gl/AbCdEf123");
  ok("https://goo.gl/maps/AbCdEf123");
  ok("https://g.co/kgs/AbC123");
  ok("https://www.google.com/maps/place/Minha+Loja/@-23.5,-46.6,17z");
  ok("https://google.com/maps?cid=123456789");
});

Deno.test("sem esquema: prefixa https:// (e espaço nas pontas é ignorado)", () => {
  assertEquals(ok("  g.page/r/CbAbC123xyz/review  "), "https://g.page/r/CbAbC123xyz/review");
  assertEquals(ok("maps.app.goo.gl/AbCdEf123"), "https://maps.app.goo.gl/AbCdEf123");
  assertEquals(ok("HTTPS://G.PAGE/r/abc/review"), "https://g.page/r/abc/review");
});

Deno.test("http é recusado", () => {
  assertEquals(motivo("http://g.page/r/abc/review"), "esquema");
});

Deno.test("javascript:, data: e outros esquemas são recusados", () => {
  assertEquals(motivo("javascript:alert(1)"), "esquema");
  assertEquals(motivo("JavaScript:alert(document.cookie)//g.page"), "esquema");
  assertEquals(motivo("data:text/html,<script>alert(1)</script>"), "esquema");
  assertEquals(motivo("ftp://g.page/r/abc"), "esquema");
});

Deno.test("domínio estranho é recusado (inclusive imitações)", () => {
  assertEquals(motivo("https://exemplo.com/review"), "dominio");
  assertEquals(motivo("https://g.page.exemplo.com/r/abc"), "dominio");
  assertEquals(motivo("https://exemplog.page/r/abc"), "dominio");
  assertEquals(motivo("https://g.page@exemplo.com/r/abc"), "dominio");
  assertEquals(motivo("https://www.google.com/search?q=loja"), "dominio");
  assertEquals(motivo("https://www.google.com/mapsfalso"), "dominio");
  assertEquals(motivo("https://g.page:8443/r/abc"), "dominio");
});

Deno.test("vazio, só espaço, nulo, texto sem host e só o domínio são recusados", () => {
  assertEquals(motivo(""), "vazio");
  assertEquals(motivo("   "), "vazio");
  assertEquals(motivo(null), "vazio");
  assertEquals(motivo(undefined), "vazio");
  assertEquals(motivo("minha loja no google"), "invalido");
  assertEquals(motivo("https://"), "invalido");
  assertEquals(motivo("g.page"), "incompleto");
  assertEquals(motivo("https://g.page/"), "incompleto");
});

Deno.test("URL gigante é recusada", () => {
  assertEquals(motivo(`https://g.page/r/${"a".repeat(600)}`), "longo");
  ok(`https://g.page/r/${"a".repeat(400)}`);
});

// ── montarMensagemAvaliacao ─────────────────────────────────────────────────
const LINK = "https://g.page/r/abc/review";

Deno.test("mensagem padrão com todas as variáveis da loja e do cliente", () => {
  const texto = montarMensagemAvaliacao("", { cliente: "João Silva", loja: "Cell Center", link: LINK });
  assertEquals(
    texto,
    `Olá, João! Obrigado por escolher a Cell Center. Sua opinião é muito importante para nós: se gostou do atendimento, deixe sua avaliação no Google: ${LINK}`,
  );
  assertEquals(montarMensagemAvaliacao(null, { cliente: "João", loja: "X", link: LINK }), montarMensagemAvaliacao(MENSAGEM_AVALIACAO_PADRAO, { cliente: "João", loja: "X", link: LINK }));
});

Deno.test("todas as variáveis num modelo personalizado", () => {
  const t = "Oi {{cliente}}! OS {{numero_os}} ({{dispositivo}}) entregue pela {{loja}}. Avalie: {{link_avaliacao}} ({{link_avaliacao}})";
  assertEquals(
    montarMensagemAvaliacao(t, { cliente: "Maria", loja: "Loja Y", link: LINK, numeroOS: "000125", dispositivo: "iPhone 13" }),
    `Oi Maria! OS 000125 (iPhone 13) entregue pela Loja Y. Avalie: ${LINK} (${LINK})`,
  );
});

Deno.test("sem {{link_avaliacao}}: o link entra numa linha nova no fim", () => {
  assertEquals(montarMensagemAvaliacao("Obrigado, {{cliente}}!  ", { cliente: "Ana", link: LINK }), `Obrigado, Ana!\n${LINK}`);
});

Deno.test("sem nome de cliente: {{cliente}} some junto com o espaço", () => {
  assertEquals(montarMensagemAvaliacao("Olá{{cliente}}! Avalie: {{link_avaliacao}}", { cliente: "", link: LINK }), `Olá! Avalie: ${LINK}`);
  assertEquals(montarMensagemAvaliacao("Olá {{cliente}}! Avalie: {{link_avaliacao}}", { cliente: null, link: LINK }), `Olá! Avalie: ${LINK}`);
});

Deno.test("caracteres especiais ($&, $1) no nome da loja não quebram a troca", () => {
  assertEquals(montarMensagemAvaliacao("{{loja}} {{link_avaliacao}}", { loja: "Loja $& $1", link: LINK }), `Loja $& $1 ${LINK}`);
});

// ── deveOferecerAvaliacaoAoEntregar ─────────────────────────────────────────
const base = { novoStatus: "entregue", statusAnterior: "finalizado", emLote: false, mudou: true, linkConfigurado: true, ativo: true };

Deno.test("entregue com tudo certo: oferece", () => {
  assertEquals(deveOferecerAvaliacaoAoEntregar(base), true);
  assertEquals(deveOferecerAvaliacaoAoEntregar({ ...base, statusAnterior: undefined }), true);
});

Deno.test("cada condição falsa derruba", () => {
  assertEquals(deveOferecerAvaliacaoAoEntregar({ ...base, novoStatus: "finalizado" }), false);
  assertEquals(deveOferecerAvaliacaoAoEntregar({ ...base, statusAnterior: "entregue" }), false);
  assertEquals(deveOferecerAvaliacaoAoEntregar({ ...base, emLote: true }), false);
  assertEquals(deveOferecerAvaliacaoAoEntregar({ ...base, mudou: false }), false);
  assertEquals(deveOferecerAvaliacaoAoEntregar({ ...base, linkConfigurado: false }), false);
  assertEquals(deveOferecerAvaliacaoAoEntregar({ ...base, ativo: false }), false);
});

// ── lerConfigAvaliacaoGoogle ────────────────────────────────────────────────
Deno.test("lê as chaves marketing_*; sem chave de ativo = ligado; link inválido não vira linkValido", () => {
  assertEquals(lerConfigAvaliacaoGoogle(null), { link: "", linkValido: null, mensagem: "", ativo: true });
  assertEquals(
    lerConfigAvaliacaoGoogle({ [CHAVE_LINK_AVALIACAO]: "g.page/r/abc/review", [CHAVE_MENSAGEM_AVALIACAO]: "Oi", [CHAVE_ATIVO_AVALIACAO]: "0" }),
    { link: "g.page/r/abc/review", linkValido: LINK, mensagem: "Oi", ativo: false },
  );
  assertEquals(lerConfigAvaliacaoGoogle({ [CHAVE_LINK_AVALIACAO]: "javascript:alert(1)", [CHAVE_ATIVO_AVALIACAO]: "1" }).linkValido, null);
  assertEquals(lerConfigAvaliacaoGoogle({ [CHAVE_ATIVO_AVALIACAO]: "1" }).ativo, true);
});

// ── selecionarOSEntreguesRecentes ───────────────────────────────────────────
Deno.test("só entregues nos últimos 30 dias, mais recente primeiro, até o limite", () => {
  const agora = new Date("2026-11-27T12:00:00Z");
  const os = [
    { id: "a", status: "entregue", data_saida: "2026-11-20T10:00:00Z" },
    { id: "b", status: "finalizado", data_saida: "2026-11-25T10:00:00Z" },
    { id: "c", status: "entregue", data_saida: "2026-10-01T10:00:00Z" },
    { id: "d", status: "entregue", data_saida: "2026-11-26T10:00:00Z" },
    { id: "e", status: "entregue", data_saida: null },
  ];
  assertEquals(selecionarOSEntreguesRecentes(os, agora).map((o) => o.id), ["d", "a"]);
  assertEquals(selecionarOSEntreguesRecentes(os, agora, 30, 1).map((o) => o.id), ["d"]);
});

// ── mesclarMensagensWhatsAppOS ──────────────────────────────────────────────
Deno.test("salvar status não apaga marketing_* nem os_tracking; salvar marketing não apaga status", () => {
  const banco = { entregue: "E", os_tracking: "T", [CHAVE_LINK_AVALIACAO]: LINK, [CHAVE_ATIVO_AVALIACAO]: "1" };
  // Diálogo de mensagens: grava status + os_tracking.
  assertEquals(mesclarMensagensWhatsAppOS(banco, { entregue: "E2", pendente: "P", os_tracking: "T2" }), {
    entregue: "E2", pendente: "P", os_tracking: "T2", [CHAVE_LINK_AVALIACAO]: LINK, [CHAVE_ATIVO_AVALIACAO]: "1",
  });
  // Página Marketing: grava só marketing_*.
  assertEquals(mesclarMensagensWhatsAppOS(banco, { [CHAVE_ATIVO_AVALIACAO]: "0", [CHAVE_MENSAGEM_AVALIACAO]: "" }), {
    entregue: "E", os_tracking: "T", [CHAVE_LINK_AVALIACAO]: LINK, [CHAVE_ATIVO_AVALIACAO]: "0", [CHAVE_MENSAGEM_AVALIACAO]: "",
  });
});

Deno.test("banco vazio/estranho vira objeto; undefined não mexe na chave", () => {
  assertEquals(mesclarMensagensWhatsAppOS(null, { a: "1" }), { a: "1" });
  assertEquals(mesclarMensagensWhatsAppOS("lixo", { a: "1" }), { a: "1" });
  assertEquals(mesclarMensagensWhatsAppOS([1, 2], { a: "1" }), { a: "1" });
  assertEquals(mesclarMensagensWhatsAppOS({ a: "1", n: 5 }, { a: undefined }), { a: "1" });
});
