// TZ=UTC deno test --no-check scripts/testes-cota-com-apagados/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-cota-com-apagados/
// Roda as funções reais de src/lib/assinatura/cotaComApagados.ts (cota do plano
// somando os fantasmas do Começar do zero) contra um banco falso com os mesmos
// filtros do PostgREST, e compara com a contagem de hoje (só linhas vivas).
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  aplicarFiltroApagados,
  type ConsultaFiltravel,
  contarApagados,
  filtroDispositivos,
  filtroOSMes,
  filtroProdutosMes,
  filtroServicosAvulsosMes,
} from "../../src/lib/assinatura/cotaComApagados.ts";
import { periodoLimiteDispositivos } from "../../src/lib/assinatura/limiteDispositivosPeriodo.ts";

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

const U = "11111111-1111-1111-1111-111111111111";
const OUTRO = "22222222-2222-2222-2222-222222222222";
type Linha = Record<string, string | boolean | null>;

/** Consulta falsa com os filtros que o hook e o helper usam (count/head). */
function consultaFalsa(linhas: Linha[], registro: string[] = [], quebrar?: "erro" | "excecao"): ConsultaFiltravel {
  const filtros: ((l: Linha) => boolean)[] = [];
  const data = (v: unknown) => new Date(String(v)).getTime();
  const q: ConsultaFiltravel = {
    eq: (c, v) => (registro.push(`eq ${c}=${v}`), filtros.push((l) => l[c] === v), q),
    in: (c, vs) => (registro.push(`in ${c}=${vs.join("|")}`), filtros.push((l) => vs.includes(String(l[c]))), q),
    gte: (c, v) => (registro.push(`gte ${c}`), filtros.push((l) => l[c] != null && data(l[c]) >= data(v)), q),
    lte: (c, v) => (registro.push(`lte ${c}`), filtros.push((l) => l[c] != null && data(l[c]) <= data(v)), q),
    lt: (c, v) => (registro.push(`lt ${c}`), filtros.push((l) => l[c] != null && data(l[c]) < data(v)), q),
    then: (ok, falha) => {
      if (quebrar === "excecao") return Promise.reject(new Error("rede caiu")).then(ok, falha);
      if (quebrar === "erro") return Promise.resolve({ count: null, error: { message: "boom" } }).then(ok, falha);
      return Promise.resolve({ count: linhas.filter((l) => filtros.every((f) => f(l))).length, error: null }).then(ok, falha);
    },
  };
  return q;
}

/** Janela do mês exatamente como useAssinatura/useServicosAvulsos calculam (fuso do navegador). */
function janelaMesDoHook(agora: Date) {
  const inicioMes = new Date(agora);
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const fimMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0);
  fimMes.setHours(23, 59, 59, 999);
  return { inicioMes, fimMes };
}

// ---- contagens de HOJE (linhas vivas, mesmos filtros do hook) e NOVAS (vivas + fantasmas) ----
interface Banco { os: Linha[]; dispositivos: Linha[]; produtos: Linha[]; pecas: Linha[]; servicos_avulsos: Linha[]; fantasmas: Linha[] }
const banco = (b: Partial<Banco> = {}): Banco => ({ os: [], dispositivos: [], produtos: [], pecas: [], servicos_avulsos: [], fantasmas: [], ...b });
const vivas = (linhas: Linha[]) => consultaFalsa(linhas);
const fantasmas = (b: Banco, quebrar?: "erro" | "excecao") => () => consultaFalsa(b.fantasmas, [], quebrar);

async function osMesHoje(b: Banco, agora: Date) {
  const { inicioMes, fimMes } = janelaMesDoHook(agora);
  const r = await vivas(b.os).eq("user_id", U).eq("deleted_at_nulo", true).eq("nao_conta_limite_falso", true)
    .gte("created_at", inicioMes.toISOString()).lte("created_at", fimMes.toISOString());
  return r.count ?? 0;
}
async function osMesNova(b: Banco, agora: Date, quebrar?: "erro" | "excecao") {
  const { inicioMes, fimMes } = janelaMesDoHook(agora);
  const [viva, apagadas] = await Promise.all([osMesHoje(b, agora), contarApagados(fantasmas(b, quebrar), U, filtroOSMes(inicioMes, fimMes))]);
  return viva + apagadas;
}
type Ass = Parameters<typeof periodoLimiteDispositivos>[0];
async function dispositivosHoje(b: Banco, ass: Ass, agora: Date) {
  const periodo = periodoLimiteDispositivos(ass, agora);
  let q = vivas(b.dispositivos).eq("user_id", U);
  if (periodo) q = q.gte("created_at", periodo.inicio.toISOString()).lt("created_at", periodo.fim.toISOString());
  return (await q).count ?? 0;
}
async function dispositivosNova(b: Banco, ass: Ass, agora: Date) {
  const periodo = periodoLimiteDispositivos(ass, agora);
  return (await dispositivosHoje(b, ass, agora)) + (await contarApagados(fantasmas(b), U, filtroDispositivos(periodo)));
}
async function produtosMesHoje(b: Banco, agora: Date) {
  const { inicioMes, fimMes } = janelaMesDoHook(agora);
  const um = async (l: Linha[]) => (await vivas(l).eq("user_id", U).gte("created_at", inicioMes.toISOString()).lte("created_at", fimMes.toISOString())).count ?? 0;
  return (await um(b.produtos)) + (await um(b.pecas));
}
async function produtosMesNova(b: Banco, agora: Date) {
  const { inicioMes, fimMes } = janelaMesDoHook(agora);
  return (await produtosMesHoje(b, agora)) + (await contarApagados(fantasmas(b), U, filtroProdutosMes(inicioMes, fimMes)));
}
async function avulsosMesHoje(b: Banco, agora: Date) {
  const { inicioMes } = janelaMesDoHook(agora);
  return (await vivas(b.servicos_avulsos).eq("user_id", U).gte("created_at", inicioMes.toISOString())).count ?? 0;
}
async function avulsosMesNova(b: Banco, agora: Date) {
  const { inicioMes } = janelaMesDoHook(agora);
  return (await avulsosMesHoje(b, agora)) + (await contarApagados(fantasmas(b), U, filtroServicosAvulsosMes(inicioMes)));
}

const os = (created_at: string, extra: Linha = {}): Linha => ({ user_id: U, created_at, deleted_at_nulo: true, nao_conta_limite_falso: true, ...extra });
const fant = (tipo: string, criado_em: string | null, user_id = U): Linha => ({ user_id, tipo, criado_em });
// Meio-dia em Brasília = 15:00Z: no mesmo dia/mês nos dois fusos testados.
const DIA = (d: string) => new Date(`${d}T15:00:00Z`);

Deno.test("filtros: exatamente os da contagem viva de cada cota", () => {
  const { inicioMes, fimMes } = janelaMesDoHook(DIA("2026-10-24"));
  const casos: [string, ReturnType<typeof filtroOSMes>, string[]][] = [
    ["os", filtroOSMes(inicioMes, fimMes), [`eq user_id=${U}`, "eq tipo=os", "gte criado_em", "lte criado_em"]],
    ["aparelhos total", filtroDispositivos(null), [`eq user_id=${U}`, "eq tipo=dispositivo"]],
    ["aparelhos período", filtroDispositivos({ inicio: inicioMes, fim: fimMes }), [`eq user_id=${U}`, "eq tipo=dispositivo", "gte criado_em", "lt criado_em"]],
    ["produtos", filtroProdutosMes(inicioMes, fimMes), [`eq user_id=${U}`, "in tipo=produto|peca", "gte criado_em", "lte criado_em"]],
    ["avulsos", filtroServicosAvulsosMes(inicioMes), [`eq user_id=${U}`, "eq tipo=servico_avulso", "gte criado_em"]],
  ];
  for (const [nome, filtro, esperado] of casos) {
    const reg: string[] = [];
    aplicarFiltroApagados(consultaFalsa([], reg), U, filtro);
    assertEquals(reg, esperado, nome);
  }
  assertEquals(filtroOSMes(inicioMes, fimMes).desde, inicioMes.toISOString());
  assertEquals(filtroOSMes(inicioMes, fimMes).ateInclusivo, fimMes.toISOString());
});

Deno.test("grátis: 3 OS no mês, apaga as 3 e tenta a 4ª: bloqueado; no mês seguinte: liberado", async () => {
  const LIMITE = 3;
  const agora = DIA("2026-10-24");
  const antes = banco({ os: [os("2026-10-05T15:00:00Z"), os("2026-10-10T15:00:00Z"), os("2026-10-20T15:00:00Z")] });
  assertEquals(await osMesNova(antes, agora), 3);
  // Começar do zero: as 3 viram fantasmas com a data original
  const depois = banco({ fantasmas: antes.os.map((l) => fant("os", String(l.created_at))) });
  assertEquals(await osMesHoje(depois, agora), 0, "hoje (sem fantasmas) a cota estaria livre: o furo");
  assert((await osMesNova(depois, agora)) >= LIMITE, "com fantasmas: bloqueado");
  assertEquals(await osMesNova(depois, DIA("2026-11-03")), 0, "mês seguinte: liberado");
  assert((await osMesNova(depois, DIA("2026-11-03"))) < LIMITE);
});

Deno.test("OS criada no dia 31 e apagada no dia 1 não pesa no mês novo", async () => {
  const b = banco({ fantasmas: [fant("os", "2026-10-31T15:00:00Z")] });
  assertEquals(await osMesNova(b, DIA("2026-10-31")), 1, "no próprio mês conta");
  assertEquals(await osMesNova(b, DIA("2026-11-01")), 0, "no mês novo não pesa");
});

Deno.test("fantasma de outro lojista não conta", async () => {
  const b = banco({ fantasmas: [fant("os", "2026-10-10T15:00:00Z", OUTRO), fant("dispositivo", null, OUTRO)] });
  assertEquals(await osMesNova(b, DIA("2026-10-24")), 0);
  assertEquals(await dispositivosNova(b, null, DIA("2026-10-24")), 0);
});

Deno.test("aparelhos, regra de total: apagados contam para sempre (inclusive sem data)", async () => {
  const b = banco({
    dispositivos: [{ user_id: U, created_at: "2026-10-01T15:00:00Z" }],
    fantasmas: [fant("dispositivo", "2024-01-01T15:00:00Z"), fant("dispositivo", "2026-09-01T15:00:00Z"), fant("dispositivo", null), fant("os", "2026-10-01T15:00:00Z")],
  });
  assertEquals(await dispositivosNova(b, null, DIA("2026-10-24")), 4);
  assertEquals(await dispositivosNova(b, null, DIA("2030-01-01")), 4);
});

Deno.test("aparelhos, regra por período: só os do ciclo atual (vivos e apagados)", async () => {
  const ass = { modulos_extras: { limite_dispositivos_por_periodo: true }, data_fim: "2026-11-13T21:00:00Z" };
  const agora = new Date("2026-10-30T12:00:00Z"); // ciclo 14/10 21:00Z até 13/11 21:00Z
  const b = banco({
    dispositivos: [{ user_id: U, created_at: "2026-10-20T12:00:00Z" }, { user_id: U, created_at: "2026-10-01T12:00:00Z" }],
    fantasmas: [fant("dispositivo", "2026-10-15T12:00:00Z"), fant("dispositivo", "2026-10-14T20:59:00Z"), fant("dispositivo", "2026-11-13T21:00:00Z"), fant("dispositivo", null)],
  });
  assertEquals(await dispositivosHoje(b, ass, agora), 1);
  assertEquals(await dispositivosNova(b, ass, agora), 2, "1 vivo + 1 fantasma do ciclo; fora do ciclo e sem data não contam");
});

Deno.test("produtos e peças por mês; serviços avulsos por mês", async () => {
  const b = banco({
    produtos: [{ user_id: U, created_at: "2026-10-02T15:00:00Z" }],
    fantasmas: [fant("produto", "2026-10-03T15:00:00Z"), fant("peca", "2026-10-04T15:00:00Z"), fant("peca", "2026-09-30T15:00:00Z"),
      fant("servico_avulso", "2026-10-05T15:00:00Z"), fant("servico_avulso", "2026-09-05T15:00:00Z")],
  });
  assertEquals(await produtosMesNova(b, DIA("2026-10-24")), 3);
  assertEquals(await avulsosMesNova(b, DIA("2026-10-24")), 1);
  assertEquals(await produtosMesNova(b, DIA("2026-11-02")), 0);
});

Deno.test("conta nunca zerada: contagem nova idêntica à de hoje, lado a lado (300 contas aleatórias)", async () => {
  let semente = 42;
  const aleatorio = () => (semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const dataAleatoria = () => new Date(Date.UTC(2026, 6, 1) + Math.floor(aleatorio() * 150 * 864e5)).toISOString();
  const assPeriodo = { modulos_extras: { limite_dispositivos_por_periodo: true }, data_fim: "2026-11-13T21:00:00Z" };
  for (let i = 0; i < 300; i++) {
    const n = () => Math.floor(aleatorio() * 12);
    const b = banco({
      os: Array.from({ length: n() }, () => os(dataAleatoria(), { deleted_at_nulo: aleatorio() > 0.2, nao_conta_limite_falso: aleatorio() > 0.1 })),
      dispositivos: Array.from({ length: n() }, () => ({ user_id: aleatorio() > 0.1 ? U : OUTRO, created_at: dataAleatoria() })),
      produtos: Array.from({ length: n() }, () => ({ user_id: U, created_at: dataAleatoria() })),
      pecas: Array.from({ length: n() }, () => ({ user_id: U, created_at: dataAleatoria() })),
      servicos_avulsos: Array.from({ length: n() }, () => ({ user_id: U, created_at: dataAleatoria() })),
    });
    const agora = new Date(dataAleatoria());
    assertEquals(await osMesNova(b, agora), await osMesHoje(b, agora));
    assertEquals(await dispositivosNova(b, null, agora), await dispositivosHoje(b, null, agora));
    assertEquals(await dispositivosNova(b, assPeriodo, agora), await dispositivosHoje(b, assPeriodo, agora));
    assertEquals(await produtosMesNova(b, agora), await produtosMesHoje(b, agora));
    assertEquals(await avulsosMesNova(b, agora), await avulsosMesHoje(b, agora));
  }
});

Deno.test("consulta dos fantasmas com erro (ou exceção) vale 0 e não bloqueia", async () => {
  const b = banco({ os: [os("2026-10-05T15:00:00Z")], fantasmas: [fant("os", "2026-10-06T15:00:00Z"), fant("os", "2026-10-07T15:00:00Z")] });
  const agora = DIA("2026-10-24");
  assertEquals(await osMesNova(b, agora), 3);
  assertEquals(await osMesNova(b, agora, "erro"), 1, "erro do banco: só as vivas");
  assertEquals(await osMesNova(b, agora, "excecao"), 1, "exceção (rede): só as vivas");
  assertEquals(await contarApagados(() => { throw new Error("cliente quebrado"); }, U, filtroOSMes(agora, agora)), 0);
});
