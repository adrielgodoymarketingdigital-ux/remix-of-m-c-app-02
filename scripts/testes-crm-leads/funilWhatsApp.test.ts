// deno test --no-check --allow-read scripts/testes-crm-leads/
// Card "Funil do WhatsApp" (src/lib/marketing/funilWhatsApp.ts + o uso de
// custoWhatsApp.ts): aviso de amostra pequena nos limites, custo com divisão
// por zero ("—", nunca Infinity/NaN), estado "não ativado" quando a RPC
// falha, mensagens de recusa do gasto (lidas da própria migration), período
// e normalização sem dado de lead. Dados fictícios.
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import { calcularCustosWhatsApp, custoPor, type LinhaFunilWhatsApp } from "../../src/lib/marketing/custoWhatsApp.ts";
import {
  TEXTO_AMOSTRA_PEQUENA,
  avisoAmostraPequena,
  classificarErroFunil,
  formatarCentavos,
  formatarCusto,
  formatarPercentual,
  intervaloFunil,
  mensagemRecusaGasto,
  normalizarLancamentos,
  normalizarLinhasAnuncio,
  numericParaCentavos,
  rotuloFonteGasto,
} from "../../src/lib/marketing/funilWhatsApp.ts";

const raiz = new URL("../../", import.meta.url);
const ler = (p: string) => Deno.readTextFileSync(new URL(p, raiz));
const NBSP = / /g;
const brl = (s: string) => s.replace(NBSP, " ");

// ---------------------------------------------------------------- amostra
Deno.test("amostra pequena: 29 conversas avisa, 30 não (com 5 assinantes)", () => {
  assertEquals(avisoAmostraPequena(29, 5), TEXTO_AMOSTRA_PEQUENA);
  assertEquals(avisoAmostraPequena(30, 5), null);
});

Deno.test("amostra pequena: 4 assinantes avisa, 5 não (com 30 conversas)", () => {
  assertEquals(avisoAmostraPequena(30, 4), TEXTO_AMOSTRA_PEQUENA);
  assertEquals(avisoAmostraPequena(30, 5), null);
  assertEquals(avisoAmostraPequena(1000, 0), TEXTO_AMOSTRA_PEQUENA);
});

Deno.test("texto do aviso é o pedido", () => {
  assertEquals(TEXTO_AMOSTRA_PEQUENA, "Amostra pequena: use como indicativo");
});

Deno.test("amostra pequena continua com custo visível", () => {
  const l: LinhaFunilWhatsApp = {
    conversas: 20, conversas_anuncio: 20, ja_clientes: 0, cadastros: 4, testes: 3, assinantes: 2, opt_outs: 0,
    gasto_meta_centavos: 0, gasto_meta_dias: 0, gasto_manual_centavos: 10000, gasto_manual_lancamentos: 1,
  };
  const c = calcularCustosWhatsApp(l);
  assertEquals(avisoAmostraPequena(l.conversas, l.assinantes), TEXTO_AMOSTRA_PEQUENA);
  assertEquals(brl(formatarCentavos(c.porAssinanteCentavos)), "R$ 50,00");
});

// ---------------------------------------------------------------- divisão por zero
Deno.test("custo com 0 assinantes é null e aparece '—'", () => {
  assertEquals(custoPor(10000, 0), null);
  assertEquals(formatarCusto(10000, 0), "—");
  const c = calcularCustosWhatsApp({
    conversas: 0, conversas_anuncio: 0, ja_clientes: 0, cadastros: 0, testes: 0, assinantes: 0, opt_outs: 0,
    gasto_meta_centavos: 0, gasto_meta_dias: 0, gasto_manual_centavos: 5000, gasto_manual_lancamentos: 1,
  });
  for (const v of [c.porConversaCentavos, c.porCadastroCentavos, c.porAssinanteCentavos]) {
    assertEquals(v, null);
    assertEquals(formatarCentavos(v), "—");
  }
});

Deno.test("formatação nunca mostra Infinity nem NaN", () => {
  for (const v of [Infinity, -Infinity, NaN, null, undefined]) assertEquals(formatarCentavos(v as number), "—");
  assertEquals(formatarPercentual(null), "—");
  assertEquals(formatarPercentual(NaN), "—");
  for (const q of [0, -1]) {
    const s = formatarCusto(12345, q);
    assert(!/Infinity|NaN/.test(s), s);
    assertEquals(s, "—");
  }
  assertEquals(brl(formatarCusto(124000, 412)), "R$ 3,01");
  assertEquals(formatarCusto(null, 10), "—");
});

// ---------------------------------------------------------------- não ativado
Deno.test("RPC/tabela inexistente = 'nao_ativado'; admin recusado = 'sem_permissao'; resto = 'falha'", () => {
  for (const code of ["PGRST202", "PGRST205", "42883", "42P01"]) {
    assertEquals(classificarErroFunil({ code, message: "x" }), "nao_ativado", code);
  }
  assertEquals(classificarErroFunil({ code: "P0001", message: "Apenas administradores podem executar esta função" }), "sem_permissao");
  assertEquals(classificarErroFunil({ code: "57014", message: "canceling statement due to statement timeout" }), "falha");
  assertEquals(classificarErroFunil(null), "falha");
});

// ---------------------------------------------------------------- recusas do gasto
Deno.test("toda recusa de admin_crm_gasto_informar (lida da migration) tem mensagem própria em português", () => {
  const sql = ler("supabase/migrations/20261121120020_crm_leads_3_funil_admin.sql");
  const corpo = sql.slice(sql.indexOf("FUNCTION public.admin_crm_gasto_informar"), sql.indexOf("FUNCTION public.admin_crm_gasto_remover"));
  const raises = [...corpo.matchAll(/RAISE EXCEPTION '([^']+)'(?:\s*USING ERRCODE = '([0-9A-Z]+)')?/g)]
    .map((m) => ({ message: m[1], code: m[2] ?? "P0001" }));
  assertEquals(raises.length, 6, "a função tem 6 recusas");
  const generica = mensagemRecusaGasto({ code: "XX000", message: "erro qualquer" });
  const vistas = new Set<string>();
  for (const r of raises) {
    const m = mensagemRecusaGasto(r);
    assertNotEquals(m, generica, r.message);
    vistas.add(m);
  }
  assertEquals(vistas.size, 6, "cada recusa com mensagem diferente");
});

Deno.test("recusas pedidas: data futura, valor zero/2 casas, sobreposição", () => {
  assert(mensagemRecusaGasto({ code: "22023", message: "Período inválido (até 400 dias, sem datas futuras)" }).includes("sem datas futuras"));
  assert(mensagemRecusaGasto({ code: "22023", message: "Valor inválido (de 0,01 a 1.000.000,00, com até 2 casas)" }).includes("valor zero não é aceito"));
  assert(mensagemRecusaGasto({ code: "22023", message: "Valor inválido (de 0,01 a 1.000.000,00, com até 2 casas)" }).includes("2 casas decimais"));
  assert(mensagemRecusaGasto({ code: "23P01", message: "Já existe gasto informado neste período que se sobrepõe a este" }).includes("sobrepõe"));
  assertEquals(mensagemRecusaGasto("data_futura"), "A data final não pode ser futura.");
  assert(mensagemRecusaGasto("valor_invalido").includes("R$ 0,01"));
  assert(mensagemRecusaGasto({ code: "PGRST202", message: "" }).includes("ainda não ativado"));
});

// ---------------------------------------------------------------- período
Deno.test("período: 7/14/30 dias terminam hoje; personalizado validado", () => {
  const hoje = "2026-11-20";
  assertEquals(intervaloFunil("7d", { inicio: "", fim: "" }, hoje), { ok: true, inicio: "2026-11-14", fim: hoje, dias: 7 });
  assertEquals(intervaloFunil("14d", { inicio: "", fim: "" }, hoje), { ok: true, inicio: "2026-11-07", fim: hoje, dias: 14 });
  assertEquals(intervaloFunil("30d", { inicio: "", fim: "" }, hoje), { ok: true, inicio: "2026-10-22", fim: hoje, dias: 30 });
  assertEquals(intervaloFunil("personalizado", { inicio: "2026-11-01", fim: "2026-11-10" }, hoje), { ok: true, inicio: "2026-11-01", fim: "2026-11-10", dias: 10 });
  assertEquals(intervaloFunil("personalizado", { inicio: "2026-11-10", fim: "2026-11-01" }, hoje).ok, false);
  assertEquals(intervaloFunil("personalizado", { inicio: "2026-11-10", fim: "2026-11-21" }, hoje).ok, false);
  assertEquals(intervaloFunil("personalizado", { inicio: "2025-10-15", fim: hoje }, hoje).ok, false); // 401 dias
  assertEquals(intervaloFunil("personalizado", { inicio: "2025-10-16", fim: hoje }, hoje).ok, true);
  assertEquals(intervaloFunil("personalizado", { inicio: "", fim: hoje }, hoje).ok, false);
});

Deno.test("fonte do gasto: sempre um rótulo só", () => {
  assertEquals(rotuloFonteGasto("meta", 12, 30), "Gasto da Meta (campanhas de WhatsApp) · 12 de 30 dias");
  assertEquals(rotuloFonteGasto("manual", 0, 30), "Gasto informado");
  assertEquals(rotuloFonteGasto("nenhum", 0, 30), "Sem gasto no período");
});

// ---------------------------------------------------------------- sem dado de lead
Deno.test("linhas por anúncio: só contagens e nome do anúncio, mesmo se vier campo a mais", () => {
  const linhas = normalizarLinhasAnuncio([
    { ad_id: "120000000000001", ad_titulo: " Anúncio A ", conversas: "10", cadastros: 2, testes: 1, assinantes: 1,
      gasto_manual_centavos: "5000", telefone: "+5511990000001", nome: "Lead Ficticio" },
    { ad_id: "", ad_titulo: null, conversas: 3, cadastros: 0, testes: 0, assinantes: 0, gasto_manual_centavos: 0 },
    { ad_id: "120000000000002", ad_titulo: "", conversas: 1 },
  ]);
  assertEquals(linhas.map((l) => Object.keys(l).sort().join(",")), Array(3).fill("adId,assinantes,cadastros,conversas,gastoInformadoCentavos,testes,titulo"));
  assertEquals(linhas.map((l) => l.titulo), ["Anúncio A", "Sem anúncio (orgânico / link direto)", "Anúncio 120000000000002"]);
  assertEquals([linhas[0].conversas, linhas[0].gastoInformadoCentavos], [10, 5000]);
  assert(!JSON.stringify(linhas).includes("99000"));
  assertEquals(normalizarLinhasAnuncio(null), []);
});

Deno.test("lançamentos de gasto: numeric em centavos exatos, removidos fora", () => {
  assertEquals(numericParaCentavos("1240.55"), 124055);
  assertEquals(numericParaCentavos("100"), 10000);
  assertEquals(numericParaCentavos(0.1), 10);
  assertEquals(numericParaCentavos("abc"), 0);
  const l = normalizarLancamentos([
    { id: 1, inicio: "2026-11-01", fim: "2026-11-10", ad_id: null, descricao: "", valor: "100.00", removido_em: null },
    { id: 2, inicio: "2026-11-01", fim: "2026-11-10", ad_id: "120000000000001", descricao: "teste", valor: "30.5", removido_em: "2026-11-11T00:00:00Z" },
  ]);
  assertEquals(l, [{ id: 1, inicio: "2026-11-01", fim: "2026-11-10", adId: null, descricao: null, valorCentavos: 10000 }]);
});

// ---------------------------------------------------------------- código da tela
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
Deno.test("tela e hook: sem campo de lead, sem console, gravação só pelas RPCs do admin", () => {
  const arquivos = [
    "src/components/admin/marketing/CardFunilWhatsApp.tsx",
    "src/components/admin/marketing/GastoInformadoWhatsApp.tsx",
    "src/hooks/useAdminCrmFunil.ts",
    "src/lib/marketing/funilWhatsApp.ts",
  ].map((p) => [p, semComentarios(ler(p))] as const);
  for (const [p, s] of arquivos) {
    assert(!/console\./.test(s), `${p}: console`);
    assert(!/telefone|celular|wa_jid|crm_leads|crm_lead_mensagens|\.texto\b|resumo/.test(s), `${p}: dado de lead`);
    assert(!/\.(insert|update|upsert|delete)\(/.test(s), `${p}: escrita direta`);
  }
  const hook = arquivos.find(([p]) => p.endsWith("useAdminCrmFunil.ts"))![1];
  const rpcs = [...hook.matchAll(/rpc\(\s*"([a-z_]+)"/g)].map((m) => m[1]).sort();
  assertEquals(rpcs, ["admin_crm_funil", "admin_crm_funil_excluidos", "admin_crm_funil_por_anuncio", "admin_crm_funil_teste", "admin_crm_gasto_informar", "admin_crm_gasto_remover"]);
});
