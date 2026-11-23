// Rodar com: bash scripts/testes-os-tecnicos/salvar/run.sh
// salvarOrdemServico REAL de ANTES (REF_ANTES) x NOVO, com Supabase falso que só
// registra as chamadas. Prova que a F0 não mudou NENHUMA gravação para a mesma
// entrada (OS sem técnicos por serviço, criação e edição; e OS com técnicos).
// Dados fictícios; nada vai à rede nem ao banco.
import { assert, assertEquals } from "jsr:@std/assert@1";

const PASTA = Deno.env.get("SALVAR_BUNDLES");
if (!PASTA) throw new Error("rode pelo run.sh (SALVAR_BUNDLES)");
const antes = await import(`file://${PASTA}/antes/handleSubmitOrdemServico.js`);
const novo = await import(`file://${PASTA}/novo/handleSubmitOrdemServico.js`);
const regraNova = await import(`file://${PASTA}/novo/tecnicosPorServicoOS.js`);
// Regra de leitura das telas de pagamento (F0b), direto do código.
const { comissaoOsDaParticipacao, participacaoNaOS } = await import("../../../src/lib/comissao/comissaoOsDoSnapshot.ts");

type Op = [string, unknown[]];
interface Chamada { alvo: string; ops: Op[] }
const g = globalThis as unknown as {
  __supabaseFalso: { chamadas: Chamada[]; responder: (c: Chamada) => { data: unknown; error: unknown } };
};

// ---------------------------------------------------------------------------
// Banco fictício (DADOS_PADRAO; alguns testes trocam por outro conjunto)
const CATALOGO = [
  { id: "srv-tela", tipo_servico_id: "tipo-tela" },
  { id: "srv-bateria", tipo_servico_id: "tipo-bateria" },
];
const COMISSOES = [
  { funcionario_id: "func-a", tipo_servico_id: "tipo-tela", comissao_tipo: "porcentagem", comissao_valor: 10 },
  { funcionario_id: "func-a", tipo_servico_id: "tipo-geral", comissao_tipo: "porcentagem", comissao_valor: 5 },
  { funcionario_id: "func-b", tipo_servico_id: "tipo-bateria", comissao_tipo: "valor", comissao_valor: 20 },
];
const FUNCIONARIOS = [
  { id: "func-a", nome: "Técnico A", comissao_calculo: "faturamento" },
  { id: "func-b", nome: "Técnico B", comissao_calculo: "lucro" },
];
const TIPOS = [
  { id: "tipo-tela", nome: "Troca de tela" },
  { id: "tipo-bateria", nome: "Troca de bateria" },
  { id: "tipo-geral", nome: "Geral" },
];

interface Dados {
  CATALOGO: Record<string, unknown>[];
  COMISSOES: Record<string, unknown>[];
  FUNCIONARIOS: Record<string, unknown>[];
  TIPOS: Record<string, unknown>[];
}
const DADOS_PADRAO: Dados = { CATALOGO, COMISSOES, FUNCIONARIOS, TIPOS };
let dados: Dados = DADOS_PADRAO;

function argsDe(c: Chamada, metodo: string): unknown[][] {
  return c.ops.filter((o) => o[0] === metodo).map((o) => o[1]);
}
function valoresIn(c: Chamada, coluna: string): unknown[] | undefined {
  const a = argsDe(c, "in").find((x) => x[0] === coluna);
  return a ? (a[1] as unknown[]) : undefined;
}
function valorEq(c: Chamada, coluna: string): unknown {
  return argsDe(c, "eq").find((x) => x[0] === coluna)?.[1];
}

function responder(c: Chamada): { data: unknown; error: unknown } {
  const metodos = c.ops.map((o) => o[0]);
  const unico = metodos.includes("single") || metodos.includes("maybeSingle");
  const filtrar = <T extends Record<string, unknown>>(linhas: T[]) => {
    let r = linhas;
    for (const [col, vals] of argsDe(c, "in") as [string, unknown[]][]) r = r.filter((l) => vals.includes(l[col]));
    for (const [col, val] of argsDe(c, "eq") as [string, unknown][]) if (col in (linhas[0] ?? {})) r = r.filter((l) => l[col] === val);
    return r;
  };
  const resp = (linhas: unknown[]) => ({ data: unico ? (linhas[0] ?? null) : linhas, error: null });

  if (c.alvo === "rpc:generate_os_number") return { data: "102", error: null };
  if (c.alvo === "servicos" && metodos.includes("select")) return resp(filtrar(dados.CATALOGO));
  if (c.alvo === "comissoes_tipo_servico" && metodos.includes("select")) return resp(filtrar(dados.COMISSOES));
  if (c.alvo === "tipos_servico" && metodos.includes("select")) return resp(filtrar(dados.TIPOS));
  if (c.alvo === "loja_funcionarios" && metodos.includes("select") && valoresIn(c, "id")) return resp(filtrar(dados.FUNCIONARIOS));
  if (c.alvo === "loja_funcionarios" && metodos.includes("select") && valorEq(c, "id")) return resp(filtrar(dados.FUNCIONARIOS));
  if (c.alvo === "ordens_servico" && metodos.includes("select") && !metodos.includes("insert") && !metodos.includes("update")) {
    return resp(filtrar([
      { ...ORDEM, avarias: {} },
      { id: "os-nova", numero_os: "102", user_id: "dono-1", empresa_id: null },
    ]));
  }
  if (c.alvo === "ordens_servico" && metodos.includes("insert") && unico) {
    return { data: { id: "os-nova", numero_os: "102", user_id: "dono-1" }, error: null };
  }
  // Qualquer outro insert/update com .single(): devolve a linha com um id.
  if (unico && (metodos.includes("insert") || metodos.includes("update"))) {
    return { data: { id: `${c.alvo}-novo` }, error: null };
  }
  return { data: unico ? null : [], error: null };
}

// ---------------------------------------------------------------------------
function formData(extra: Record<string, unknown> = {}) {
  return {
    clienteNome: "", clienteTelefone: "", clienteCPF: "", clienteEndereco: "", clienteBairro: "",
    clienteNumero: "", clienteCidade: "", clienteEstado: "", clienteCEP: "", clienteDataNascimento: "",
    origemCliente: "", tipoMidia: "",
    dispositivoTipo: "Celular", dispositivoMarca: "Samsung", dispositivoModelo: "A10", dispositivoCor: "",
    dispositivoNumeroSerie: "", dispositivoIMEI: "", dispositivoSistema: "", dispositivoFabricante: "",
    dispositivoSubtipo: "", fotosDispositivo: [],
    localizacaoFisica: "", defeitoRelatado: "Tela quebrada", observacoesInternas: "",
    mostrarObsInternasImpressao: false,
    senhaDesbloqueio: { tipo: "numero", valor: "", padrao: [] },
    checklist: { entrada: {}, saida: {} }, avarias: [],
    servicos: [
      { id: "srv-tela", nome: "Troca de tela", preco: 300, custo: 120, lucro: 180, quantidade: 1, created_at: "", user_id: "", custo_confirmado: true },
      { id: "srv-bateria", nome: "Troca de bateria", preco: 150, custo: 60, lucro: 90, quantidade: 1, created_at: "", user_id: "", custo_confirmado: true },
    ],
    produtos: [], custosAdicionais: [], tempoGarantia: 90,
    formaPagamento: "", numeroParcelas: 2, desconto: 0, valorEntrada: 0, mostrarEntrada: false,
    formaPagamentoEntrada: "dinheiro", total: 450, entrada: 0, saldo: 0,
    status: "em_andamento",
    assinaturaEntrada: "", tipoAssinaturaEntrada: "digital", assinaturaSaida: "", tipoAssinaturaSaida: "digital",
    dataVencimentoPrazo: undefined, semDataDefinida: false,
    dataEntrada: new Date("2026-11-20T13:00:00Z"), dataSaida: undefined,
    ...extra,
  };
}

const ORDEM = {
  id: "os-1", numero_os: "101", user_id: "dono-1", empresa_id: null, cliente_id: null,
  status: "em_andamento", total: 450, created_at: "2026-11-20T13:00:00Z", data_saida: null,
  funcionario_id: "func-a", tipo_servico_id: "tipo-geral", avarias: {},
};

function parametros(extra: Record<string, unknown>) {
  const registro: string[] = [];
  return {
    registro,
    params: {
      formData: formData(),
      ordem: null,
      tecnicoId: "func-a",
      tecnicosOS: [],
      tipoServicoId: "tipo-geral",
      clienteSelecionadoId: null,
      bandeiraSelecionada: "",
      taxasAtivas: [],
      tiposServico: TIPOS,
      funcionarioId: null,
      tecnicoObrigatorioOS: false,
      isProprietario: true,
      empresaAtivaCtx: null,
      temAcessoModulo: () => true,
      calcularTaxa: () => ({ percentual: 0, valor: 0 }),
      toast: (o: unknown) => registro.push(`toast ${JSON.stringify(o)}`),
      trackOSCriada: (...a: unknown[]) => registro.push(`track ${JSON.stringify(a)}`),
      dispararConfetti: (t: string) => registro.push(`confetti ${t}`),
      dispatchEvent: (e: string, p: unknown) => registro.push(`evento ${e} ${JSON.stringify(p)}`),
      navigate: (p: string) => registro.push(`navigate ${p}`),
      onSuccess: () => registro.push("onSuccess"),
      onOpenChange: (o: boolean) => registro.push(`onOpenChange ${o}`),
      ...extra,
    },
  };
}

// Datas "agora" mudam entre execuções: troca por marcador.
const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})/g;
const normalizar = (v: unknown) => JSON.parse(JSON.stringify(v ?? null).replace(ISO, (m) => (m.startsWith("2026-11-20T13") ? m : "<agora>")));

// O save avisa a tela com window.dispatchEvent(new Event("os-salva")).
const eventosJanela: string[] = [];
(globalThis as unknown as { window: unknown }).window = {
  dispatchEvent: (e: Event) => { eventosJanela.push(e.type); return true; },
};

// deno-lint-ignore no-explicit-any
async function rodar(modulo: any, extra: Record<string, unknown>, conjunto: Dados = DADOS_PADRAO) {
  dados = conjunto;
  g.__supabaseFalso.chamadas = [];
  g.__supabaseFalso.responder = responder;
  eventosJanela.length = 0;
  const { registro, params } = parametros(extra);
  const logs: unknown[] = [];
  const [log, warn, info, error] = [console.log, console.warn, console.info, console.error];
  console.log = console.warn = console.info = console.error = (...a: unknown[]) => logs.push(a.map(String).join(" "));
  let retorno: unknown;
  let erro: string | null = null;
  try {
    retorno = await modulo.salvarOrdemServico(params);
  } catch (e) {
    erro = String(e);
  } finally {
    Object.assign(console, { log, warn, info, error });
  }
  return normalizar({ chamadas: g.__supabaseFalso.chamadas, registro, retorno, erro, logs, eventosJanela });
}

function gravacoesOsTecnicos(r: { chamadas: Chamada[] }) {
  return r.chamadas.filter((c) => c.alvo === "os_tecnicos").map((c) => c.ops);
}

const CENARIOS: [string, Record<string, unknown>][] = [
  ["EDIÇÃO sem técnicos por serviço", { ordem: ORDEM }],
  ["CRIAÇÃO sem técnicos por serviço", {}],
  ["EDIÇÃO sem técnico principal e sem técnicos", { ordem: { ...ORDEM, funcionario_id: null }, tecnicoId: null }],
  ["EDIÇÃO com técnicos por serviço (ligados ao serviço)", {
    ordem: ORDEM,
    tecnicosOS: [
      { funcionario_id: "func-a", descricao_servico: "Troca de tela", servico_id: "srv-tela" },
      { funcionario_id: "func-b", descricao_servico: "Troca de bateria", servico_id: "srv-bateria" },
    ],
  }],
  ["EDIÇÃO com técnico legado (sem serviço ligado)", {
    ordem: ORDEM,
    tecnicosOS: [{ funcionario_id: "func-b", descricao_servico: "Serviço antigo" }],
  }],
];
// Principal SEM linha própria + outro técnico ligado a um serviço: é o caso
// que a F0c muda de propósito (teste próprio abaixo).
const CRIACAO_PRINCIPAL_SEM_LINHA: Record<string, unknown> = {
  tecnicosOS: [{ funcionario_id: "func-b", descricao_servico: "Troca de bateria", servico_id: "srv-bateria" }],
};

for (const [nome, extra] of CENARIOS) {
  Deno.test(`antes x novo, mesmas chamadas ao banco: ${nome}`, async () => {
    const a = await rodar(antes, extra);
    const n = await rodar(novo, extra);
    assertEquals(a.erro, null, `antes falhou: ${a.erro}`);
    assertEquals(n.erro, null, `novo falhou: ${n.erro}`);
    assert(a.chamadas.length > 5, "o cenário precisa exercitar a gravação");
    assert(a.chamadas.some((c: Chamada) => c.alvo === "ordens_servico" && c.ops.some((o) => o[0] === "insert" || o[0] === "update")));
    assertEquals(n.chamadas, a.chamadas);
    assertEquals(n.registro, a.registro);
    assertEquals(n.retorno, a.retorno);
    assertEquals(n.logs, a.logs);
    assertEquals(n.eventosJanela, a.eventosJanela);
    // O save terminou sem erro (nada de toast de "Erro ao salvar ordem").
    assert(!JSON.stringify(n.registro).includes("Erro ao salvar"), JSON.stringify(n.registro));
    assertEquals(n.eventosJanela, ["os-salva"]);
  });
}

Deno.test("sem técnicos por serviço: os_tecnicos só recebe o delete da OS (antes e novo)", async () => {
  for (const modulo of [antes, novo]) {
    const r = await rodar(modulo, { ordem: ORDEM });
    assertEquals(gravacoesOsTecnicos(r), [[["delete", []], ["eq", ["os_id", "os-1"]]]]);
  }
});

Deno.test("com técnicos ligados: snapshot de cada um é o do SEU serviço", async () => {
  const r = await rodar(novo, CENARIOS[3][1]);
  const insert = gravacoesOsTecnicos(r).find((ops) => ops[0][0] === "insert")!;
  // deno-lint-ignore no-explicit-any
  const linhas = (insert[0][1][0] as any[]).map((l) => [l.funcionario_id, l.servico_id, l.comissao_calculada_snapshot]);
  assertEquals(linhas, [["func-a", "srv-tela", 30], ["func-b", "srv-bateria", 20]]);
});

// ===========================================================================
// F0c — o serviço ligado a OUTRO técnico sai da base do Técnico Principal.
// Conjunto do exemplo: OS R$ 300 = serviço A R$ 100 + serviço B R$ 200.
// Ana 10% em A (e também 10% em B, para o caso P3-f aparecer), Bruno 20% em B.
const DADOS_ANA_BRUNO: Dados = {
  CATALOGO: [{ id: "srv-a", tipo_servico_id: "t-a" }, { id: "srv-b", tipo_servico_id: "t-b" }],
  COMISSOES: [
    { funcionario_id: "ana", tipo_servico_id: "t-a", comissao_tipo: "porcentagem", comissao_valor: 10 },
    { funcionario_id: "ana", tipo_servico_id: "t-b", comissao_tipo: "porcentagem", comissao_valor: 10 },
    { funcionario_id: "bruno", tipo_servico_id: "t-b", comissao_tipo: "porcentagem", comissao_valor: 20 },
  ],
  FUNCIONARIOS: [
    { id: "ana", nome: "Ana", comissao_calculo: "faturamento" },
    { id: "bruno", nome: "Bruno", comissao_calculo: "faturamento" },
  ],
  TIPOS: [{ id: "t-a", nome: "Serviço A" }, { id: "t-b", nome: "Serviço B" }],
};
const SRV_A = { id: "srv-a", nome: "Serviço A", preco: 100, custo: 40, lucro: 60, quantidade: 1, created_at: "", user_id: "", custo_confirmado: true };
const SRV_B = { id: "srv-b", nome: "Serviço B", preco: 200, custo: 50, lucro: 150, quantidade: 1, created_at: "", user_id: "", custo_confirmado: true };
const FORM_AB = formData({ servicos: [SRV_A, SRV_B], total: 300 });
const ANA_A = { funcionario_id: "ana", descricao_servico: "Serviço A", servico_id: "srv-a" };
const BRUNO_B = { funcionario_id: "bruno", descricao_servico: "Serviço B", servico_id: "srv-b" };

// deno-lint-ignore no-explicit-any
function gravacaoOS(r: any): Record<string, unknown> {
  const c = r.chamadas.find((c: Chamada) => c.alvo === "ordens_servico" && c.ops.some((o) => o[0] === "insert" || o[0] === "update"));
  const op = c.ops.find((o: Op) => o[0] === "insert" || o[0] === "update");
  return op[0] === "insert" ? (op[1][0] as Record<string, unknown>[])[0] : (op[1][0] as Record<string, unknown>);
}
// deno-lint-ignore no-explicit-any
function linhasGravadas(r: any): Record<string, unknown>[] {
  const ops = gravacoesOsTecnicos(r).find((ops) => ops[0][0] === "insert");
  return ops ? (ops[0][1][0] as Record<string, unknown>[]) : [];
}
// Comissão de cada um como as telas de pagamento leem (F0b), a partir do gravado.
// deno-lint-ignore no-explicit-any
function comissoesLidas(r: any, principal: string, funcionarios: string[]) {
  const os = { status: "entregue", comissao_calculada_snapshot: gravacaoOS(r).comissao_calculada_snapshot as number | null };
  const linhas = linhasGravadas(r) as { funcionario_id: string; comissao_calculada_snapshot: number | null; servico_id?: string | null; servico_nome_snapshot?: string | null }[];
  const out: Record<string, number> = {};
  for (const f of funcionarios) {
    const p = participacaoNaOS(f, principal, linhas.filter((l) => l.funcionario_id === f));
    out[f] = p ? (comissaoOsDaParticipacao(os, p) || 0) : 0;
  }
  return out;
}
const semSnapshot = (r: { chamadas: Chamada[] }) =>
  JSON.parse(JSON.stringify(r.chamadas).replace(/"comissao_calculada_snapshot":[^,}]*/g, '"comissao_calculada_snapshot":"<x>"'));

Deno.test("cenário antigo 'CRIAÇÃO com técnicos por serviço' (principal sem linha): só a base do principal muda", async () => {
  const a = await rodar(antes, CRIACAO_PRINCIPAL_SEM_LINHA);
  const n = await rodar(novo, CRIACAO_PRINCIPAL_SEM_LINHA);
  assertEquals([a.erro, n.erro], [null, null]);
  // Mesmas chamadas, mesmas linhas de técnico; muda só o que sai do principal:
  assertEquals(semSnapshot(n), semSnapshot(a));
  assertEquals(linhasGravadas(n), linhasGravadas(a));
  // Técnico A não tinha % para bateria: o valor é o mesmo (30), e some só o
  // aviso brando da bateria — ela não é mais dele.
  assertEquals([gravacaoOS(a).comissao_calculada_snapshot, gravacaoOS(n).comissao_calculada_snapshot], [30, 30]);
  assert(JSON.stringify(a.registro).includes("Troca de bateria"));
  assert(!JSON.stringify(n.registro).includes("Troca de bateria"));
});

Deno.test("exemplo Ana/Bruno (Ana principal com linha própria em A): Ana R$ 10, Bruno R$ 40, total R$ 50", async () => {
  const p = { formData: FORM_AB, tecnicoId: "ana", tecnicosOS: [ANA_A, BRUNO_B] };
  const a = await rodar(antes, p, DADOS_ANA_BRUNO);
  const n = await rodar(novo, p, DADOS_ANA_BRUNO);
  assertEquals([a.erro, n.erro], [null, null]);
  // Principal com linha própria: comportamento atual preservado (gravação idêntica).
  assertEquals(n.chamadas, a.chamadas);
  assertEquals(n.registro, a.registro);
  const lidas = comissoesLidas(n, "ana", ["ana", "bruno"]);
  assertEquals(lidas, { ana: 10, bruno: 40 });
  assertEquals(lidas.ana + lidas.bruno, 50);
});

Deno.test("caso P3-f (Ana principal SEM linha, B do Bruno): base da Ana = só A; Bruno = só B", async () => {
  const p = { formData: FORM_AB, tecnicoId: "ana", tecnicosOS: [BRUNO_B] };
  const a = await rodar(antes, p, DADOS_ANA_BRUNO);
  const n = await rodar(novo, p, DADOS_ANA_BRUNO);
  assertEquals([a.erro, n.erro], [null, null]);
  // Antes: Ana R$ 30 (10% de A + 10% de B) e Bruno R$ 40 → B pago duas vezes.
  assertEquals(gravacaoOS(a).comissao_calculada_snapshot, 30);
  assertEquals(comissoesLidas(a, "ana", ["ana", "bruno"]), { ana: 30, bruno: 40 });
  // Depois: Ana R$ 10 (só A), Bruno R$ 40 (só B), total R$ 50.
  assertEquals(gravacaoOS(n).comissao_calculada_snapshot, 10);
  assertEquals(comissoesLidas(n, "ana", ["ana", "bruno"]), { ana: 10, bruno: 40 });
  assertEquals(linhasGravadas(n), linhasGravadas(a)); // linha do Bruno igual
  assertEquals(semSnapshot(n), semSnapshot(a)); // o resto da gravação igual
});

Deno.test("P3-f com comissão sobre LUCRO e com VALOR FIXO: o serviço do Bruno sai da base da Ana", async () => {
  const p = { formData: FORM_AB, tecnicoId: "ana", tecnicosOS: [BRUNO_B] };
  const lucro: Dados = {
    ...DADOS_ANA_BRUNO,
    FUNCIONARIOS: [{ id: "ana", nome: "Ana", comissao_calculo: "lucro" }, { id: "bruno", nome: "Bruno", comissao_calculo: "faturamento" }],
  };
  // lucro: A = (100 − 40) × 10% = 6; B seria (200 − 50) × 10% = 15
  assertEquals(gravacaoOS(await rodar(antes, p, lucro)).comissao_calculada_snapshot, 21);
  assertEquals(gravacaoOS(await rodar(novo, p, lucro)).comissao_calculada_snapshot, 6);
  const fixo: Dados = {
    ...DADOS_ANA_BRUNO,
    COMISSOES: [
      { funcionario_id: "ana", tipo_servico_id: "t-a", comissao_tipo: "valor", comissao_valor: 15 },
      { funcionario_id: "ana", tipo_servico_id: "t-b", comissao_tipo: "valor", comissao_valor: 25 },
      { funcionario_id: "bruno", tipo_servico_id: "t-b", comissao_tipo: "porcentagem", comissao_valor: 20 },
    ],
  };
  // valor fixo por serviço: A = 15; B seria 25
  assertEquals(gravacaoOS(await rodar(antes, p, fixo)).comissao_calculada_snapshot, 40);
  assertEquals(gravacaoOS(await rodar(novo, p, fixo)).comissao_calculada_snapshot, 15);
});

Deno.test("todos os serviços são de outros técnicos: principal R$ 0,00 (não '—')", async () => {
  const p = { formData: formData({ servicos: [SRV_B], total: 200 }), tecnicoId: "ana", tecnicosOS: [BRUNO_B] };
  assertEquals(gravacaoOS(await rodar(antes, p, DADOS_ANA_BRUNO)).comissao_calculada_snapshot, 20);
  const n = await rodar(novo, p, DADOS_ANA_BRUNO);
  assertEquals(gravacaoOS(n).comissao_calculada_snapshot, 0);
  assertEquals(comissoesLidas(n, "ana", ["ana", "bruno"]), { ana: 0, bruno: 40 });
});

Deno.test("linha sem técnico escolhido ou sem serviço não tira nada da base do principal", async () => {
  for (const tecnicosOS of [
    [{ funcionario_id: "", descricao_servico: "Serviço B", servico_id: "srv-b" }],
    [{ funcionario_id: "bruno", descricao_servico: "Serviço antigo" }],
  ]) {
    const p = { formData: FORM_AB, tecnicoId: "ana", tecnicosOS };
    const a = await rodar(antes, p, DADOS_ANA_BRUNO);
    const n = await rodar(novo, p, DADOS_ANA_BRUNO);
    assertEquals(gravacaoOS(n).comissao_calculada_snapshot, 30);
    assertEquals(n.chamadas, a.chamadas);
  }
});

Deno.test("abrir -> salvar -> abrir -> salvar sem mudar nada: mesmos valores (caso P3-f)", async () => {
  const criacao = await rodar(novo, { formData: FORM_AB, tecnicoId: "ana", tecnicosOS: [BRUNO_B] }, DADOS_ANA_BRUNO);
  let snap = gravacaoOS(criacao).comissao_calculada_snapshot;
  let linhas = linhasGravadas(criacao);
  assertEquals(snap, 10);
  for (let ciclo = 0; ciclo < 2; ciclo++) {
    // reabrir: os_tecnicos do banco → formulário (carregamento real da F0)
    const tecnicosOS = linhas.map((l) => regraNova.tecnicoOSDoBanco({ servico_linha_id: null, ...l }));
    const r = await rodar(novo, {
      formData: FORM_AB, tecnicoId: "ana", tecnicosOS,
      ordem: { ...ORDEM, funcionario_id: "ana", total: 300, comissao_calculada_snapshot: snap },
    }, DADOS_ANA_BRUNO);
    assertEquals(r.erro, null);
    assertEquals(gravacaoOS(r).comissao_calculada_snapshot, snap);
    assertEquals(linhasGravadas(r).map((l) => ({ ...l, os_id: "x" })), linhas.map((l) => ({ ...l, os_id: "x" })));
    snap = gravacaoOS(r).comissao_calculada_snapshot;
    linhas = linhasGravadas(r);
  }
});

Deno.test("regra pura: servicosDeOutrosTecnicos", () => {
  const sv = [SRV_A, SRV_B];
  const ex = (principal: string | null, tecs: Record<string, unknown>[]) => [...regraNova.servicosDeOutrosTecnicos(principal, tecs, sv)];
  assertEquals(ex("ana", []), []); // sem técnicos por serviço
  assertEquals(ex("ana", [BRUNO_B]), [1]);
  assertEquals(ex("ana", [ANA_A, BRUNO_B]), []); // principal com linha própria
  assertEquals(ex(null, [BRUNO_B]), []); // sem principal
  assertEquals(ex("ana", [{ ...BRUNO_B, funcionario_id: "" }]), []);
  assertEquals(ex("ana", [{ funcionario_id: "bruno", descricao_servico: "x" }]), []);
  // serviço repetido: a linha (servico_linha_id) decide qual sai
  const rep = [
    { ...SRV_B, linha_os: { linha_id: "l1" } },
    { ...SRV_B, linha_os: { linha_id: "l2" } },
  ];
  assertEquals([...regraNova.servicosDeOutrosTecnicos("ana", [{ ...BRUNO_B, servico_linha_id: "l2" }], rep)], [1]);
});
