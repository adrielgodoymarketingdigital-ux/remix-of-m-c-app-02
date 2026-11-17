// deno test --no-check --no-lock scripts/testes-os-multi/
// Etapa 4 da OS com vários dispositivos: leitura e textos dos dispositivos
// adicionais (src/lib/ordemServico/dispositivosAdicionaisOS.ts) e fotos da
// impressão (src/lib/os/fotosImpressaoOS.ts). Regra principal: SEM adicionais
// todo texto sai idêntico ao de antes. Só dados fictícios; nada vai à rede.
import { assertEquals, assertStrictEquals } from "jsr:@std/assert@1";
import {
  adicionaisCorrespondemBusca,
  agruparResumoPorOS,
  consultarSemFalhar,
  juntarDispositivos,
  juntarImeis,
  lerDispositivoAdicional,
  lerDispositivosAdicionais,
  LIMITE_RESUMO_ADICIONAIS,
  marcaModelo,
  nomeLinhaServicoComDispositivo,
  rotuloDispositivoRef,
  seloAdicionais,
  tituloDispositivo,
} from "../../src/lib/ordemServico/dispositivosAdicionaisOS.ts";
import { nomeLinhaServico } from "../../src/lib/ordemServico/linhaServicoOS.ts";
import {
  MAX_FOTOS_IMPRESSAO,
  montarFotosParaImpressao,
  selecionarFotos,
  selecionarFotosComAdicionais,
} from "../../src/lib/os/fotosImpressaoOS.ts";

const OS = "os-1";
const linha = (o: Record<string, unknown>) => ({
  id: "a1", os_id: OS, user_id: "dono", ordem: 2,
  dispositivo_tipo: "Celular", dispositivo_marca: "Apple", dispositivo_modelo: "iPhone 12",
  dispositivo_cor: null, dispositivo_imei: null, dispositivo_numero_serie: null,
  dispositivo_sistema: null, dispositivo_fabricante: null, dispositivo_subtipo: null,
  senha_desbloqueio: null, defeito_relatado: null, checklist: null, avarias_visuais: null,
  fotos_dispositivo: null, observacoes: null, created_at: "2026-10-23T10:00:00Z", updated_at: "2026-10-23T10:00:00Z",
  ...o,
});

// ── Leitura ─────────────────────────────────────────────────────────────────

Deno.test("lerDispositivosAdicionais: resposta vazia, nula ou inválida vira lista vazia", () => {
  assertEquals(lerDispositivosAdicionais(null), []);
  assertEquals(lerDispositivosAdicionais(undefined), []);
  assertEquals(lerDispositivosAdicionais({}), []);
  assertEquals(lerDispositivosAdicionais([]), []);
  assertEquals(lerDispositivosAdicionais([null, 1, "x", { id: 1 }, { id: "a" }]), []);
});

Deno.test("lerDispositivosAdicionais: ordena por ordem e, empatado, por created_at", () => {
  const r = lerDispositivosAdicionais([
    linha({ id: "c", ordem: 4 }),
    linha({ id: "b", ordem: 2, created_at: "2026-10-23T12:00:00Z" }),
    linha({ id: "a", ordem: 2, created_at: "2026-10-23T11:00:00Z" }),
  ]);
  assertEquals(r.map((d) => d.id), ["a", "b", "c"]);
});

Deno.test("lerDispositivoAdicional: jsonb fora do formato vira vazio, sem quebrar", () => {
  const d = lerDispositivoAdicional(linha({
    checklist: [1, 2], avarias_visuais: { x: 1 }, fotos_dispositivo: "url", senha_desbloqueio: "abc",
  }))!;
  assertStrictEquals(d.checklist, null);
  assertEquals(d.avarias_visuais, []);
  assertEquals(d.fotos_dispositivo, []);
  assertStrictEquals(d.senha_desbloqueio, null);

  const ok = lerDispositivoAdicional(linha({
    checklist: { entrada: { tela: true }, sem_teste: false },
    avarias_visuais: [{ x: 1, y: 2, tipo: "trinca", lado: "frente" }, { x: "a", lado: "frente" }],
    fotos_dispositivo: ["https://x/1.jpg", 3, ""],
    senha_desbloqueio: { tipo: "numero", valor: "cifrado" },
  }))!;
  assertEquals(ok.checklist, { entrada: { tela: true }, saida: {}, sem_teste: false });
  assertEquals(ok.avarias_visuais.length, 1);
  assertEquals(ok.fotos_dispositivo, ["https://x/1.jpg"]);
  assertEquals(ok.senha_desbloqueio, { tipo: "numero", valor: "cifrado" }); // continua cifrada
});

Deno.test("agruparResumoPorOS: mapa por os_id, em ordem; inválidos fora", () => {
  const r = agruparResumoPorOS([
    { id: "x2", os_id: "os-2", ordem: 3, dispositivo_marca: "Samsung", dispositivo_modelo: "A54", dispositivo_imei: "999", created_at: "b" },
    { id: "x1", os_id: "os-2", ordem: 2, dispositivo_marca: "Apple", dispositivo_modelo: "iPhone 11", dispositivo_imei: null, created_at: "a" },
    { id: "y", os_id: "os-1", ordem: 2, dispositivo_marca: "Moto", dispositivo_modelo: "G8", dispositivo_numero_serie: "S1", created_at: "a" },
    { os_id: "sem-id" },
  ]);
  assertEquals(Object.keys(r).sort(), ["os-1", "os-2"]);
  assertEquals(r["os-2"].map((d) => d.id), ["x1", "x2"]);
  assertEquals(r["os-1"][0], { id: "y", os_id: "os-1", ordem: 2, dispositivo_marca: "Moto", dispositivo_modelo: "G8", dispositivo_imei: null, dispositivo_numero_serie: "S1" });
  assertEquals(agruparResumoPorOS(null), {});
});

Deno.test("LIMITE_RESUMO_ADICIONAIS é 1000 (teto padrão da API)", () => {
  assertStrictEquals(LIMITE_RESUMO_ADICIONAIS, 1000);
});

// ── Consulta que nunca falha (usada pelo hook) ──────────────────────────────

Deno.test("consultarSemFalhar: sucesso lê os dados", async () => {
  const r = await consultarSemFalhar(() => Promise.resolve({ data: [linha({})], error: null }), lerDispositivosAdicionais, []);
  assertEquals(r.length, 1);
});

Deno.test("consultarSemFalhar: tabela ausente (PGRST205), RLS ou rede devolvem vazio sem lançar nem logar", async () => {
  const logs: unknown[] = [];
  const orig = { error: console.error, warn: console.warn, log: console.log };
  console.error = console.warn = console.log = (...a: unknown[]) => { logs.push(a); };
  try {
    const ausente = await consultarSemFalhar(
      () => Promise.resolve({ data: null, error: { code: "PGRST205", message: "Could not find the table 'public.os_dispositivos_adicionais'" } }),
      lerDispositivosAdicionais, [],
    );
    const rls = await consultarSemFalhar(() => Promise.resolve({ data: null, error: { code: "42501" } }), agruparResumoPorOS, {});
    const rede = await consultarSemFalhar(() => Promise.reject(new TypeError("Failed to fetch")), lerDispositivosAdicionais, []);
    const lanca = await consultarSemFalhar(() => { throw new Error("x"); }, lerDispositivosAdicionais, []);
    assertEquals([ausente, rls, rede, lanca], [[], {}, [], []]);
  } finally {
    Object.assign(console, orig);
  }
  assertEquals(logs, []);
});

// ── Textos: sem adicionais = idêntico ───────────────────────────────────────

const LINHAS_SERVICO = [
  { nome: "Formatação" },
  { nome: "Troca de tela", quantidade: 1 },
  { nome: "Película", quantidade: 3 },
  { nome: "Limpeza", dispositivo_ref: "a1" },
  { nome: "Bateria", quantidade: 2, dispositivo_ref: "nao-existe" },
  { nome: null },
];

Deno.test("nomeLinhaServicoComDispositivo: sem adicionais é exatamente nomeLinhaServico", () => {
  for (const l of LINHAS_SERVICO) {
    assertStrictEquals(nomeLinhaServicoComDispositivo(l, []), nomeLinhaServico(l));
    assertStrictEquals(nomeLinhaServicoComDispositivo(l, null), nomeLinhaServico(l));
    assertStrictEquals(nomeLinhaServicoComDispositivo(l, undefined), nomeLinhaServico(l));
  }
});

Deno.test("nomeLinhaServicoComDispositivo: com dispositivo_ref ganha o rótulo; sem ref ou ref órfão fica como hoje", () => {
  const adicionais = [
    { id: "a1", dispositivo_marca: "Apple", dispositivo_modelo: "iPhone 12" },
    { id: "a2", dispositivo_marca: "Samsung", dispositivo_modelo: "" },
  ];
  assertStrictEquals(nomeLinhaServicoComDispositivo({ nome: "Formatação", dispositivo_ref: "a1" }, adicionais), "Formatação — Dispositivo 2 (iPhone 12)");
  assertStrictEquals(nomeLinhaServicoComDispositivo({ nome: "Película", quantidade: 3, dispositivo_ref: "a1" }, adicionais), "3x Película — Dispositivo 2 (iPhone 12)");
  assertStrictEquals(nomeLinhaServicoComDispositivo({ nome: "Tela", dispositivo_ref: "a2" }, adicionais), "Tela — Dispositivo 3 (Samsung)");
  assertStrictEquals(nomeLinhaServicoComDispositivo({ nome: "Formatação" }, adicionais), "Formatação");
  assertStrictEquals(nomeLinhaServicoComDispositivo({ nome: "Bateria", dispositivo_ref: "sumiu" }, adicionais), "Bateria");
  assertStrictEquals(rotuloDispositivoRef("a1", []), null);
  assertStrictEquals(rotuloDispositivoRef({ id: "a1" }, adicionais), null);
  assertStrictEquals(rotuloDispositivoRef("a2", [...adicionais, { id: "a3" }].slice(1)), "Dispositivo 2 (Samsung)");
  assertStrictEquals(rotuloDispositivoRef("a3", [{ id: "a3", dispositivo_marca: "", dispositivo_modelo: "" }]), "Dispositivo 2");
});

Deno.test("juntarDispositivos: sem adicionais devolve o texto do leitor intacto (até espaços sobrando)", () => {
  for (const t of ["Apple iPhone 11", "Apple ", " ", "", "  Moto  G8 "]) {
    assertStrictEquals(juntarDispositivos(t, []), t);
    assertStrictEquals(juntarDispositivos(t, null), t);
    assertStrictEquals(juntarDispositivos(t, undefined, " / "), t);
  }
});

Deno.test("juntarDispositivos: com adicionais junta com ' + ' (ou o separador pedido)", () => {
  const ad = [{ dispositivo_marca: "Apple", dispositivo_modelo: "iPhone 12" }, { dispositivo_marca: "", dispositivo_modelo: "Watch" }];
  assertStrictEquals(juntarDispositivos("Apple iPhone 11", ad), "Apple iPhone 11 + Apple iPhone 12 + Watch");
  assertStrictEquals(juntarDispositivos("Apple iPhone 11 ", ad, " / "), "Apple iPhone 11 / Apple iPhone 12 / Watch");
  assertStrictEquals(juntarDispositivos("", ad.slice(0, 1)), "Apple iPhone 12");
  assertStrictEquals(marcaModelo({ dispositivo_marca: null, dispositivo_modelo: "X" }), "X");
});

Deno.test("juntarImeis: sem adicionais intacto; com adicionais IMEI ou série, sem vazios", () => {
  assertStrictEquals(juntarImeis("", []), "");
  assertStrictEquals(juntarImeis("123", null), "123");
  assertStrictEquals(
    juntarImeis("123", [{ dispositivo_imei: "456", dispositivo_numero_serie: null }, { dispositivo_imei: null, dispositivo_numero_serie: "S9" }, { dispositivo_imei: null, dispositivo_numero_serie: null }]),
    "123 / 456 / S9",
  );
});

Deno.test("seloAdicionais e tituloDispositivo", () => {
  assertStrictEquals(seloAdicionais(0), "");
  assertStrictEquals(seloAdicionais(-1), "");
  assertStrictEquals(seloAdicionais(1), "+1 aparelho");
  assertStrictEquals(seloAdicionais(2), "+2 aparelhos");
  assertStrictEquals(tituloDispositivo(1), "Dispositivo 1");
});

Deno.test("adicionaisCorrespondemBusca: IMEI, modelo e marca; número de série NÃO", () => {
  const ad = [{ id: "a", os_id: OS, ordem: 2, dispositivo_marca: "Samsung", dispositivo_modelo: "Galaxy A54", dispositivo_imei: "356789012345678", dispositivo_numero_serie: "RX8ZZ" }];
  assertStrictEquals(adicionaisCorrespondemBusca(ad, "35678901"), true);
  assertStrictEquals(adicionaisCorrespondemBusca(ad, "a54"), true);
  assertStrictEquals(adicionaisCorrespondemBusca(ad, "samsung"), true);
  assertStrictEquals(adicionaisCorrespondemBusca(ad, "rx8zz"), false);
  assertStrictEquals(adicionaisCorrespondemBusca(ad, ""), false);
  assertStrictEquals(adicionaisCorrespondemBusca(undefined, "a54"), false);
  assertStrictEquals(adicionaisCorrespondemBusca([], "a54"), false);
});

// ── Fotos da impressão ──────────────────────────────────────────────────────

const foto = (n: number, p = "d1") => `https://x.supabase.co/storage/v1/object/public/f/${p}-${n}.jpg`;

Deno.test("selecionarFotosComAdicionais: sem adicionais = selecionarFotos e legendas null", () => {
  for (const fotos of [undefined, null, [], [foto(1)], Array.from({ length: 9 }, (_, i) => foto(i)), ["lixo", foto(1)]]) {
    for (const ad of [undefined, null, []]) {
      assertEquals(selecionarFotosComAdicionais(fotos, ad), { ...selecionarFotos(fotos), legendas: null });
    }
  }
  const carregadas = [foto(1), foto(2)].map((original) => ({ original, dataUrl: "data:image/jpeg;base64,AA", originalAbre: false }));
  assertEquals(montarFotosParaImpressao(carregadas, "pdf").fotos.map((f) => f.legenda), ["Foto 1", "Foto 2"]);
  assertEquals(montarFotosParaImpressao(carregadas, "pdf", null).fotos.map((f) => f.legenda), ["Foto 1", "Foto 2"]);
});

Deno.test("selecionarFotosComAdicionais: dispositivo 1 primeiro, limite de 6, legenda por dispositivo", () => {
  const r = selecionarFotosComAdicionais([foto(1), foto(2)], [[foto(1, "d2"), foto(2, "d2"), foto(3, "d2")], [foto(1, "d3"), foto(2, "d3"), "lixo"]]);
  assertStrictEquals(r.urls.length, MAX_FOTOS_IMPRESSAO);
  assertEquals(r.urls, [foto(1), foto(2), foto(1, "d2"), foto(2, "d2"), foto(3, "d2"), foto(1, "d3")]);
  assertStrictEquals(r.excedentes, 1);
  assertEquals(r.legendas, [
    "Dispositivo 1 · Foto 1", "Dispositivo 1 · Foto 2",
    "Dispositivo 2 · Foto 1", "Dispositivo 2 · Foto 2", "Dispositivo 2 · Foto 3",
    "Dispositivo 3 · Foto 1",
  ]);
  // Adicional sem foto: só o dispositivo 1, com legenda de dispositivo.
  assertEquals(selecionarFotosComAdicionais([foto(1)], [[]]), { urls: [foto(1)], excedentes: 0, legendas: ["Dispositivo 1 · Foto 1"] });
  // Foto que não carregou some, a legenda das outras não muda.
  const carregadas = r.urls.slice(0, 3).map((original, i) => ({ original, dataUrl: i === 1 ? null : "data:image/jpeg;base64,AA", originalAbre: false }));
  const m = montarFotosParaImpressao(carregadas, "pdf", r.legendas);
  assertEquals(m.fotos.map((f) => f.legenda), ["Dispositivo 1 · Foto 1", "Dispositivo 2 · Foto 1"]);
  assertStrictEquals(m.falhas, 1);
});
