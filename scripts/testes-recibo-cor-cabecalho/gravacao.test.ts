// node --test scripts/testes-recibo-cor-cabecalho/
// Gravação de cores_personalizadas linha a linha (src/lib/configuracaoLoja/coresPersonalizadasLinhas.ts)
// com o supabase-js real falando com um PostgREST simulado. Dados fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import { supabaseSimulado, type Linha } from "./apoio.ts";
import {
  definirCorRecibo,
  gravarCoresPorLinha,
  linhaDeReferencia,
  mesclarCoresApp,
  removerCorRecibo,
  removerCoresApp,
  type ClienteCores,
} from "../../src/lib/configuracaoLoja/coresPersonalizadasLinhas.ts";

const DONO = "dono-1";
const APP = { primary_from: "#064e3b", primary_via: "#059669", primary_to: "#10b981", card_faturamento_from: "#064e3b", card_faturamento_via: "#059669", card_faturamento_to: "#10b981" };
const NOVAS_APP = { primary_from: "#4c1d95", primary_via: "#6d28d9", primary_to: "#8b5cf6", card_faturamento_from: "#4c1d95", card_faturamento_via: "#6d28d9", card_faturamento_to: "#8b5cf6" };
const TRACK_M = { cor_fundo: "#000000", mostrar_fotos: true };
const TRACK_F = { cor_fundo: "#111111" };
const OUTRO_DONO: Linha = { id: "cfg-outro", user_id: "outro", empresa_id: null, cores_personalizadas: { tracking_config: { x: 1 } } };

const duasLinhas = (extraM = {}, extraF = {}): Linha[] => [
  { id: "cfg-m", user_id: DONO, empresa_id: null, cores_personalizadas: { ...APP, tracking_config: TRACK_M, ...extraM } },
  { id: "cfg-f", user_id: DONO, empresa_id: "emp-1", cores_personalizadas: { tracking_config: TRACK_F, ...extraF } },
  OUTRO_DONO,
];
const cli = (s: ReturnType<typeof supabaseSimulado>) => s.cliente as unknown as ClienteCores;
const valores = (s: ReturnType<typeof supabaseSimulado>) => Object.fromEntries(s.linhas.map((l) => [l.id, l.cores_personalizadas]));

// O que o código ANTIGO gravava (PersonalizacaoCores.tsx na origin/main): valor
// lido com .single() (null quando há 0 ou 2+ linhas) e UPDATE por user_id.
const antigoSalvar = (lidoSingle: Record<string, unknown> | null, cores: Record<string, unknown>) => ({ ...(lidoSingle || {}), ...cores });
const antigoResetar = (lidoSingle: Record<string, unknown> | null) => {
  const { primary_from, primary_via, primary_to, card_faturamento_from, card_faturamento_via, card_faturamento_to, ...resto } = lidoSingle || {};
  void primary_from; void primary_via; void primary_to; void card_faturamento_from; void card_faturamento_via; void card_faturamento_to;
  return Object.keys(resto).length > 0 ? resto : null;
};

test("dono sem filial (1 linha): salvar cores do app grava o MESMO valor do código antigo", async () => {
  for (const atual of [null, {}, { tracking_config: TRACK_M }, { ...APP, tracking_config: TRACK_M, recibo_cabecalho_cor: "#7f1d1d" }]) {
    const s = supabaseSimulado([{ id: "cfg-m", user_id: DONO, empresa_id: null, cores_personalizadas: atual }, OUTRO_DONO]);
    assert.equal(await gravarCoresPorLinha(cli(s), DONO, mesclarCoresApp(NOVAS_APP)), 1);
    assert.deepStrictEqual(s.linhas[0].cores_personalizadas, antigoSalvar(atual, NOVAS_APP));
    assert.deepStrictEqual(s.linhas[1], OUTRO_DONO, "outro dono intocado");
    assert.deepStrictEqual(s.log.map((r) => r.metodo), ["GET", "PATCH"], "1 leitura + 1 gravação, como antes");
  }
});

test("dono sem filial (1 linha): resetar cores do app grava o MESMO valor do código antigo", async () => {
  for (const atual of [null, {}, { ...APP }, { ...APP, tracking_config: TRACK_M }, { ...APP, recibo_cabecalho_cor: "#7f1d1d" }]) {
    const s = supabaseSimulado([{ id: "cfg-m", user_id: DONO, empresa_id: null, cores_personalizadas: atual }]);
    await gravarCoresPorLinha(cli(s), DONO, removerCoresApp);
    assert.deepStrictEqual(s.linhas[0].cores_personalizadas, antigoResetar(atual), JSON.stringify(atual));
  }
});

test("dono com 2 linhas: o código antigo APAGAVA tracking_config (o bug corrigido)", () => {
  // .single() com 2 linhas → erro PGRST116 → valor lido null → UPDATE por user_id em todas.
  assert.deepStrictEqual(antigoSalvar(null, NOVAS_APP), NOVAS_APP);
});

test("dono com 2+ linhas: salvar cores do app NÃO apaga tracking_config nem a cor do recibo", async () => {
  const s = supabaseSimulado(duasLinhas({ recibo_cabecalho_cor: "#7f1d1d" }, { recibo_cabecalho_cor: "#7f1d1d" }));
  assert.equal(await gravarCoresPorLinha(cli(s), DONO, mesclarCoresApp(NOVAS_APP)), 2);
  assert.deepStrictEqual(valores(s), {
    "cfg-m": { ...NOVAS_APP, tracking_config: TRACK_M, recibo_cabecalho_cor: "#7f1d1d" },
    "cfg-f": { tracking_config: TRACK_F, recibo_cabecalho_cor: "#7f1d1d", ...NOVAS_APP },
    "cfg-outro": OUTRO_DONO.cores_personalizadas,
  });
  const patches = s.log.filter((r) => r.metodo === "PATCH");
  assert.deepStrictEqual(patches.map((p) => p.busca), ["?id=eq.cfg-m", "?id=eq.cfg-f"], "grava por id, nunca por user_id");
});

test("dono com 2+ linhas: resetar cores do app tira só as do app", async () => {
  const s = supabaseSimulado(duasLinhas({ recibo_cabecalho_cor: "#7f1d1d" }, APP));
  await gravarCoresPorLinha(cli(s), DONO, removerCoresApp);
  assert.deepStrictEqual(valores(s)["cfg-m"], { tracking_config: TRACK_M, recibo_cabecalho_cor: "#7f1d1d" });
  assert.deepStrictEqual(valores(s)["cfg-f"], { tracking_config: TRACK_F });
});

test("salvar a cor do recibo NÃO apaga as cores do app nem o tracking_config (todas as linhas do dono)", async () => {
  const s = supabaseSimulado(duasLinhas());
  await gravarCoresPorLinha(cli(s), DONO, definirCorRecibo("#FDE68A"));
  assert.deepStrictEqual(valores(s), {
    "cfg-m": { ...APP, tracking_config: TRACK_M, recibo_cabecalho_cor: "#fde68a" },
    "cfg-f": { tracking_config: TRACK_F, recibo_cabecalho_cor: "#fde68a" },
    "cfg-outro": OUTRO_DONO.cores_personalizadas,
  });
});

test("voltar ao azul padrão REMOVE a chave (não grava azul); linha que fica vazia vira null", async () => {
  const s = supabaseSimulado([
    { id: "cfg-m", user_id: DONO, empresa_id: null, cores_personalizadas: { ...APP, recibo_cabecalho_cor: "#7f1d1d" } },
    { id: "cfg-f", user_id: DONO, empresa_id: "emp-1", cores_personalizadas: { recibo_cabecalho_cor: "#7f1d1d" } },
  ]);
  await gravarCoresPorLinha(cli(s), DONO, removerCorRecibo);
  assert.deepStrictEqual(valores(s), { "cfg-m": { ...APP }, "cfg-f": null });
});

test("cor inválida não chega a gravar", () => {
  for (const c of ["azul", "#12", "", "rgb(0,0,0)"]) assert.throws(() => definirCorRecibo(c));
});

test("erro de leitura: interrompe e não grava nada (antes gravava sobre {})", async () => {
  const s = supabaseSimulado(duasLinhas(), { falhaLeitura: true });
  await assert.rejects(gravarCoresPorLinha(cli(s), DONO, mesclarCoresApp(NOVAS_APP)));
  assert.ok(!s.log.some((r) => r.metodo === "PATCH"));
  assert.deepStrictEqual(s.linhas, duasLinhas());
});

test("erro de gravação: propaga (a tela mostra o erro)", async () => {
  const s = supabaseSimulado(duasLinhas(), { falhaGravacao: true });
  await assert.rejects(gravarCoresPorLinha(cli(s), DONO, definirCorRecibo("#7f1d1d")));
});

test("usuário sem linha (ex.: funcionário com o próprio id): 0 linhas, nada gravado", async () => {
  const s = supabaseSimulado([OUTRO_DONO]);
  assert.equal(await gravarCoresPorLinha(cli(s), DONO, mesclarCoresApp(NOVAS_APP)), 0);
  assert.deepStrictEqual(s.log.map((r) => r.metodo), ["GET"]);
});

test("linha mostrada na tela: a da matriz; sem matriz, a primeira", () => {
  assert.equal(linhaDeReferencia([{ empresa_id: "f", n: 1 }, { empresa_id: null, n: 2 }])?.n, 2);
  assert.equal(linhaDeReferencia([{ empresa_id: "f", n: 1 }, { empresa_id: "g", n: 2 }])?.n, 1);
  assert.equal(linhaDeReferencia([]), null);
  assert.equal(linhaDeReferencia(null), null);
});
