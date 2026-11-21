// deno test --no-check --allow-read scripts/testes-crm-leads/
// Fase 2A do card "Funil do WhatsApp": gasto da Meta por anúncio. Custos com
// o automático + informado efetivo (Meta por campanha ignorada), sem as
// funções novas = exatamente como antes, "atualizado há X min", conversas da
// Meta ao lado das nossas, tabela por anúncio (anúncio com gasto e sem
// conversa entra), nomes das colunas = RETURNS TABLE da migration, texto de
// ajuda e função nova ausente sem aviso nem nova tentativa. Dados fictícios.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { calcularCustosWhatsApp, normalizarLinhaFunil } from "../../src/lib/marketing/custoWhatsApp.ts";
import { classificarErroFunil, type LinhaAnuncio } from "../../src/lib/marketing/funilWhatsApp.ts";
import {
  TEXTO_AJUDA_GASTO_META,
  custosComGastoAutomatico,
  linhasAnuncioComGasto,
  normalizarGastoPeriodo,
  normalizarGastoPorAnuncio,
  rotuloFonteGasto2A,
  rotuloOrigemGasto,
  sincronizacaoAtrasada,
  textoAtualizado,
  textoConversasMeta,
} from "../../src/lib/marketing/gastoMetaWhatsApp.ts";

const raiz = new URL("../../", import.meta.url);
const ler = (p: string) => Deno.readTextFileSync(new URL(p, raiz));
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
const CARD = semComentarios(ler("src/components/admin/marketing/CardFunilWhatsApp.tsx"));
const HOOK = semComentarios(ler("src/hooks/useAdminCrmFunil.ts"));
const FORM = semComentarios(ler("src/components/admin/marketing/GastoInformadoWhatsApp.tsx"));
const MIG = ler("supabase/migrations/20261122120000_crm_leads_2a_gasto_meta_anuncio.sql");

const colunas = (fn: string) => {
  const i = MIG.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
  const bloco = MIG.slice(MIG.indexOf("RETURNS TABLE(", i) + 14, MIG.indexOf("\n)", i));
  return bloco.split(",").map((l) => l.trim().split(/\s+/)[0]).filter(Boolean);
};

// funil com 40 conversas, 10 cadastros, 5 assinantes; Meta-campanha 9.999 e informado 3.000
const FUNIL = normalizarLinhaFunil({
  conversas: 40, conversas_anuncio: 30, ja_clientes: 2, cadastros: 10, testes: 8, assinantes: 5, opt_outs: 0,
  gasto_meta_centavos: 999900, gasto_meta_dias: 3, gasto_manual_centavos: 300000, gasto_manual_lancamentos: 2,
});
const G = normalizarGastoPeriodo([{
  gasto_auto_centavos: "120000", dias_auto: 7, anuncios_auto: 2, conversas_meta: 52, impressoes: 10000, cliques: 300,
  gasto_manual_efetivo_centavos: 20000, lancamentos_manuais_efetivos: 1, atualizado_em: "2026-11-20T15:00:00+00:00",
}]);

Deno.test("normalização: nomes = RETURNS TABLE da migration 2A; bigint como texto; nulos", () => {
  assertEquals(colunas("admin_crm_funil_gasto"), ["gasto_auto_centavos", "dias_auto", "anuncios_auto", "conversas_meta", "impressoes",
    "cliques", "gasto_manual_efetivo_centavos", "lancamentos_manuais_efetivos", "atualizado_em"]);
  assertEquals(colunas("admin_crm_funil_gasto_por_anuncio"), ["ad_id", "gasto_auto_centavos", "dias_auto", "conversas_meta", "impressoes",
    "cliques", "gasto_manual_efetivo_centavos", "atualizado_em"]);
  assertEquals(G.gastoAutoCentavos, 120000);
  assertEquals(G.conversasMeta, 52);
  assertEquals(G.atualizadoEm, "2026-11-20T15:00:00+00:00");
  assertEquals(normalizarGastoPeriodo([]).atualizadoEm, null);
  assertEquals(normalizarGastoPeriodo([{ atualizado_em: "lixo", gasto_auto_centavos: -5 }]), {
    gastoAutoCentavos: 0, diasAuto: 0, anunciosAuto: 0, conversasMeta: 0, impressoes: 0, cliques: 0,
    gastoManualEfetivoCentavos: 0, lancamentosManuaisEfetivos: 0, atualizadoEm: null,
  });
  const ad = normalizarGastoPorAnuncio([{ ad_id: "120000000000001", gasto_auto_centavos: "700", dias_auto: 2, conversas_meta: 9,
    gasto_manual_efetivo_centavos: 800, atualizado_em: null }, { ad_id: "" }, { ad_id: 5 }, null]);
  assertEquals(ad, [{ adId: "120000000000001", gastoAutoCentavos: 700, diasAuto: 2, conversasMeta: 9, gastoManualEfetivoCentavos: 800, atualizadoEm: null }]);
});

Deno.test("sem a função nova: custos IGUAIS a calcularCustosWhatsApp (card como antes)", () => {
  const c = custosComGastoAutomatico(FUNIL, undefined);
  const velho = calcularCustosWhatsApp(FUNIL);
  assertEquals(c.daFase2A, false);
  for (const k of ["fonte", "gastoCentavos", "diasComGastoMeta", "porConversaCentavos", "porCadastroCentavos", "porAssinanteCentavos", "amostraPequena"] as const) {
    assertEquals(c[k], velho[k], k);
  }
  assertEquals(custosComGastoAutomatico(FUNIL, null).gastoCentavos, velho.gastoCentavos);
});

Deno.test("com automático: gasto = automático + informado efetivo; Meta por campanha ignorada", () => {
  const c = custosComGastoAutomatico(FUNIL, G);
  assertEquals(c.daFase2A, true);
  assertEquals(c.fonte, "automatico");
  assertEquals(c.gastoCentavos, 140000);          // 1.200 + 200, nunca os 9.999 da campanha nem os 3.000 brutos
  assertEquals(c.porConversaCentavos, 3500);      // 1.400 / 40
  assertEquals(c.porCadastroCentavos, 14000);
  assertEquals(c.porAssinanteCentavos, 28000);
  assertEquals(c.diasComGastoMeta, 7);
  assertEquals(rotuloFonteGasto2A(c, 30), "Gasto da Meta por anúncio · 7 de 30 dias + R$\u00a0200,00 informado nos dias sem dado da Meta");
  assertEquals(rotuloFonteGasto2A(custosComGastoAutomatico(FUNIL, { ...G, gastoManualEfetivoCentavos: 0, lancamentosManuaisEfetivos: 0 }), 30),
    "Gasto da Meta por anúncio · 7 de 30 dias");
});

Deno.test("com a função nova e sem dia automático: só o informado efetivo; nada = sem gasto", () => {
  const so = custosComGastoAutomatico(FUNIL, { ...G, gastoAutoCentavos: 0, diasAuto: 0, anunciosAuto: 0 });
  assertEquals([so.fonte, so.gastoCentavos, so.porConversaCentavos], ["manual", 20000, 500]);
  assertEquals(rotuloFonteGasto2A(so, 30), "Gasto informado (sem dado da Meta no período)");
  const nada = custosComGastoAutomatico(FUNIL, normalizarGastoPeriodo([]));
  assertEquals([nada.fonte, nada.gastoCentavos, nada.porConversaCentavos, nada.porAssinanteCentavos], ["nenhum", null, null, null]);
  assertEquals(rotuloFonteGasto2A(nada, 30), "Sem gasto no período");
  // automático zerado (dia com gasto 0) continua sendo fonte automática, custo R$ 0
  const zero = custosComGastoAutomatico(FUNIL, { ...G, gastoAutoCentavos: 0, gastoManualEfetivoCentavos: 0, lancamentosManuaisEfetivos: 0 });
  assertEquals([zero.fonte, zero.gastoCentavos, zero.porConversaCentavos], ["automatico", 0, 0]);
  // zero conversas: custo "—" (null), nunca Infinity
  const vazio = custosComGastoAutomatico(normalizarLinhaFunil({}), G);
  assertEquals([vazio.porConversaCentavos, vazio.porAssinanteCentavos], [null, null]);
});

Deno.test("atualizado há X min (hora da última sincronização)", () => {
  const t = Date.parse("2026-11-20T15:00:00Z");
  assertEquals(textoAtualizado(null, t), null);
  assertEquals(textoAtualizado("lixo", t), null);
  assertEquals(textoAtualizado("2026-11-20T15:00:00Z", t + 30_000), "atualizado agora há pouco");
  assertEquals(textoAtualizado("2026-11-20T15:00:00Z", t + 60_000), "atualizado há 1 min");
  assertEquals(textoAtualizado("2026-11-20T15:00:00Z", t + 59 * 60_000), "atualizado há 59 min");
  assertEquals(textoAtualizado("2026-11-20T15:00:00Z", t + 60 * 60_000), "atualizado há 1 h");
  assertEquals(textoAtualizado("2026-11-20T15:00:00Z", t + 47 * 3_600_000), "atualizado há 47 h");
  assertEquals(textoAtualizado("2026-11-20T15:00:00Z", t + 72 * 3_600_000), "atualizado há 3 dias");
  assertEquals(textoAtualizado("2026-11-20T15:00:00Z", t - 120_000), "atualizado agora há pouco"); // relógio adiantado
  assertEquals(sincronizacaoAtrasada("2026-11-20T15:00:00Z", t + 6 * 3_600_000), false);
  assertEquals(sincronizacaoAtrasada("2026-11-20T15:00:00Z", t + 6 * 3_600_000 + 1), true);
  assertEquals(sincronizacaoAtrasada(null, t), false);
});

Deno.test("conversas da Meta ao lado das nossas; texto de ajuda do atraso", () => {
  assertEquals(textoConversasMeta(52, 40), "A Meta contou 52 conversas (aqui: 40 em que o cliente escreveu primeiro)");
  assertEquals(textoConversasMeta(1, 1), "A Meta contou 1 conversa (aqui: 1 em que o cliente escreveu primeiro)");
  assertEquals(textoConversasMeta(1500, 1200), "A Meta contou 1.500 conversas (aqui: 1.200 em que o cliente escreveu primeiro)");
  assert(TEXTO_AJUDA_GASTO_META.includes("minutos a algumas horas"));
  assert(TEXTO_AJUDA_GASTO_META.includes("últimos 3 dias são recalculados"));
  assert(TEXTO_AJUDA_GASTO_META.includes("última sincronização"));
  assert(TEXTO_AJUDA_GASTO_META.includes("só vale nos dias sem dado da Meta"));
});

const L = (adId: string, conversas: number, assinantes: number, informado = 0): LinhaAnuncio =>
  ({ adId, titulo: adId ? `Anúncio ${adId}` : "Sem anúncio (orgânico / link direto)", conversas, cadastros: 0, testes: 0, assinantes, gastoInformadoCentavos: informado });

Deno.test("tabela por anúncio sem a função nova: gasto informado da linha, como antes", () => {
  const r = linhasAnuncioComGasto([L("A1", 10, 1, 5000), L("", 4, 0), L("B2", 3, 0)], undefined);
  assertEquals(r.map((x) => [x.adId, x.gastoCentavos, x.origemGasto, x.conversasMeta]), [["A1", 5000, "informado", null], ["", null, null, null], ["B2", null, null, null]]);
});

Deno.test("tabela por anúncio com a função nova: automático + informado efetivo; antigo ignorado; anúncio sem conversa entra", () => {
  const gastos = normalizarGastoPorAnuncio([
    { ad_id: "A1", gasto_auto_centavos: 7000, dias_auto: 2, conversas_meta: 9, gasto_manual_efetivo_centavos: 8000 },
    { ad_id: "B2", gasto_auto_centavos: 0, dias_auto: 0, conversas_meta: 0, gasto_manual_efetivo_centavos: 5000 },
    { ad_id: "C3", gasto_auto_centavos: 2500, dias_auto: 2, conversas_meta: 2, gasto_manual_efetivo_centavos: 0 },
    { ad_id: "Z9", gasto_auto_centavos: 0, dias_auto: 1, conversas_meta: 0, gasto_manual_efetivo_centavos: 0 },
  ]);
  // A1 tem 10.000 de informado BRUTO na linha antiga: tem que ser ignorado (só os 8.000 efetivos valem)
  const r = linhasAnuncioComGasto([L("A1", 10, 2, 10000), L("", 4, 0), L("B2", 3, 0, 5000), L("D4", 2, 0)], gastos);
  assertEquals(r.map((x) => [x.adId, x.conversas, x.gastoCentavos, x.origemGasto, x.conversasMeta]), [
    ["A1", 10, 15000, "meta_informado", 9],
    ["", 4, null, null, null],
    ["B2", 3, 5000, "informado", 0],
    ["D4", 2, null, null, 0],
    ["C3", 0, 2500, "meta", 2],
    ["Z9", 0, 0, "meta", 0],
  ]);
  assertEquals(r[4].titulo, "Anúncio C3");
  assertEquals([rotuloOrigemGasto("meta"), rotuloOrigemGasto("meta_informado"), rotuloOrigemGasto("informado"), rotuloOrigemGasto(null)],
    ["Meta", "Meta + informado", "informado", ""]);
});

Deno.test("hook: funções novas só depois do funil, sem nova tentativa quando não existem; gravar invalida", () => {
  assertEquals(classificarErroFunil({ code: "PGRST202" }), "nao_ativado");
  for (const [nome, rpc] of [["useAdminCrmFunilGasto", "admin_crm_funil_gasto"], ["useAdminCrmFunilGastoPorAnuncio", "admin_crm_funil_gasto_por_anuncio"]]) {
    const i = HOOK.indexOf(`export function ${nome}(`);
    const bloco = HOOK.slice(i, HOOK.indexOf("\n}\n", i));
    assert(i > 0, nome);
    assert(bloco.includes("enabled: habilitado && intervalo !== null,"), `${nome}: só depois do funil`);
    assert(bloco.includes("retry: naoRepetirSeNaoAtivado,"), `${nome}: sem nova tentativa`);
    assert(bloco.includes("refetchOnWindowFocus: false,"), `${nome}: sem recarregar no foco`);
    assert(bloco.includes(`"${rpc}" as never`), `${nome}: chama ${rpc}`);
  }
  const inv = HOOK.slice(HOOK.indexOf("function useInvalidarFunil"), HOOK.indexOf("export interface NovoGasto"));
  assert(inv.includes('["admin-crm-funil-gasto"]') && inv.includes('["admin-crm-funil-gasto-anuncio"]'), "informar/remover gasto recarrega o gasto da 2A");
});

Deno.test("card: função nova ausente some sem aviso; dado novo só com a função; erros dela nunca aparecem", () => {
  assert(CARD.includes("const gasto = useAdminCrmFunilGasto(consulta, ativo);"));
  assert(CARD.includes("const gastoAnuncio = useAdminCrmFunilGastoPorAnuncio(consulta, ativo);"));
  assert(!/\bgasto(Anuncio)?\.(error|isError|failureReason|status|refetch)/.test(CARD), "o card não olha o erro das funções novas");
  assert(CARD.includes("custosComGastoAutomatico(funil.data, gasto.data)"));
  assert(CARD.includes("linhasAnuncioComGasto(porAnuncio.data ?? [], comMetaPorAnuncio ? gastoAnuncio.data : undefined)"));
  assert(CARD.includes("const comMetaPorAnuncio = (gastoAnuncio.data ?? []).some((g) => g.diasAuto > 0);"),
    "colunas da Meta só com dado automático no período (antes da 1ª sincronização, tabela como antes)");
  assert(CARD.includes('{gasto.data?.atualizadoEm && (\n              <p className="text-xs text-muted-foreground -mt-2" data-testid="ajuda-gasto-meta">{TEXTO_AJUDA_GASTO_META}</p>'),
    "ajuda do atraso só depois da 1ª sincronização");
  assert(CARD.includes('{gasto.data && gasto.data.diasAuto > 0 && ('), "conversas da Meta só com dia automático");
  assert(CARD.includes("{textoConversasMeta(gasto.data.conversasMeta, funil.data.conversas)}"));
  assert(CARD.includes('{comMetaPorAnuncio && <TableHead className="text-right">Conversas (Meta)</TableHead>}'));
  assert(CARD.includes('{comMetaPorAnuncio ? "Gasto" : "Gasto informado"}'));
  assert(CARD.includes("formatarCusto(gastoLinha, l.conversas)") && CARD.includes("formatarCusto(gastoLinha, l.assinantes)"));
  assert(CARD.includes('data-testid="gasto-atualizado"'));
  assert(CARD.includes("comGastoAutomatico={gasto.data !== undefined}"));
  assert(FORM.includes("{comGastoAutomatico && ("), "aviso do informado ignorado só com a função nova");
  assert(!/console\./.test(CARD + HOOK + FORM));
});
