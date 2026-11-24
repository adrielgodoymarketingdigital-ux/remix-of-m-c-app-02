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

// os_tecnicos em memória (F0g): select/insert/delete de verdade, para comparar
// o ESTADO FINAL da tabela entre antes e novo (a ordem das chamadas mudou de
// propósito: insere antes de apagar). Toda execução começa com 1 linha antiga
// na OS de edição (os-1).
type Linha = Record<string, unknown>;
const OT_ANTIGA: Linha = {
  id: "ot-antiga", os_id: "os-1", funcionario_id: "func-a", descricao_servico: "Antigo", servico_id: null,
  comissao_calculada_snapshot: 12,
};
let tabelaOT: Linha[] = [];
let proximoIdOT = 1;
// Falha injetada: devolve o erro para a chamada a os_tecnicos (ou null).
let falhaOT: ((c: Chamada, metodos: string[]) => unknown) | null = null;

function responderOsTecnicos(c: Chamada, metodos: string[]): { data: unknown; error: unknown } {
  const erro = falhaOT?.(c, metodos);
  if (erro) return { data: null, error: erro };
  if (metodos.includes("insert")) {
    const novas = (argsDe(c, "insert")[0][0] as Linha[]).map((l) => ({ id: `ot-nova-${proximoIdOT++}`, ...l }));
    tabelaOT.push(...novas);
    return { data: metodos.includes("select") ? novas.map((l) => ({ id: l.id })) : null, error: null };
  }
  let alvo = tabelaOT;
  for (const [col, val] of argsDe(c, "eq") as [string, unknown][]) alvo = alvo.filter((l) => l[col] === val);
  for (const [col, vals] of argsDe(c, "in") as [string, unknown[]][]) alvo = alvo.filter((l) => vals.includes(l[col]));
  if (metodos.includes("delete")) {
    tabelaOT = tabelaOT.filter((l) => !alvo.includes(l));
    return { data: null, error: null };
  }
  return { data: alvo.map((l) => ({ id: l.id })), error: null };
}

function responder(c: Chamada): { data: unknown; error: unknown } {
  const metodos = c.ops.map((o) => o[0]);
  if (c.alvo === "os_tecnicos") return responderOsTecnicos(c, metodos);
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

async function rodar(
  modulo: { salvarOrdemServico: (params: unknown) => Promise<unknown> },
  extra: Record<string, unknown>,
  conjunto: Dados = DADOS_PADRAO,
  falha: typeof falhaOT = null,
) {
  dados = conjunto;
  tabelaOT = [{ ...OT_ANTIGA }];
  proximoIdOT = 1;
  falhaOT = falha;
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
  // Estado final de os_tecnicos sem o id (o id das linhas novas é do banco).
  const osTecnicosFinal = tabelaOT.map(({ id: _id, ...resto }) => resto);
  return normalizar({ chamadas: g.__supabaseFalso.chamadas, registro, retorno, erro, logs, eventosJanela, osTecnicosFinal });
}

// Chamadas fora de os_tecnicos (as de os_tecnicos são comparadas pelo estado final).
const foraOT = (r: { chamadas: Chamada[] }) => r.chamadas.filter((c) => c.alvo !== "os_tecnicos");

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
    assertEquals(foraOT(n), foraOT(a));
    assertEquals(n.osTecnicosFinal, a.osTecnicosFinal);
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
// Mesmas chamadas, sem olhar o snapshot do principal nem a ORDEM: desde a F0e
// as 4 consultas de comissão dos técnicos vêm antes do principal (e não se
// repetem depois) quando há outro técnico ligado a serviço.
const semSnapshot = (r: { chamadas: Chamada[] }) =>
  foraOT(r)
    .map((c) => JSON.stringify(c).replace(/"comissao_calculada_snapshot":[^,}]*/g, '"comissao_calculada_snapshot":"<x>"'))
    .sort();

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
  assertEquals(foraOT(n), foraOT(a));
  assertEquals(n.osTecnicosFinal, a.osTecnicosFinal);
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
  // Legada (sem serviço ligado, com descrição): gravação igual à de antes.
  const pLegada = { formData: FORM_AB, tecnicoId: "ana", tecnicosOS: [{ funcionario_id: "bruno", descricao_servico: "Serviço antigo" }] };
  const a = await rodar(antes, pLegada, DADOS_ANA_BRUNO);
  const n = await rodar(novo, pLegada, DADOS_ANA_BRUNO);
  assertEquals(gravacaoOS(n).comissao_calculada_snapshot, 30);
  assertEquals(foraOT(n), foraOT(a));
  assertEquals(n.osTecnicosFinal, a.osTecnicosFinal);
  // Sem técnico escolhido (F0g): antes ia para o insert com funcionario_id ""
  // (no banco, a FK derrubava o insert inteiro); agora é ignorada.
  const pSemTecnico = { formData: FORM_AB, tecnicoId: "ana", tecnicosOS: [{ funcionario_id: "", descricao_servico: "Serviço B", servico_id: "srv-b" }] };
  const a2 = await rodar(antes, pSemTecnico, DADOS_ANA_BRUNO);
  const n2 = await rodar(novo, pSemTecnico, DADOS_ANA_BRUNO);
  assertEquals(gravacaoOS(n2).comissao_calculada_snapshot, 30);
  assertEquals(linhasGravadas(a2).map((l) => l.funcionario_id), [""]);
  assertEquals(linhasGravadas(n2), []);
  // a linha sem técnico se comporta exatamente como não ter linha nenhuma
  const n3 = await rodar(novo, { ...pSemTecnico, tecnicosOS: [] }, DADOS_ANA_BRUNO);
  assertEquals(n2.chamadas, n3.chamadas);
  assertEquals(n2.registro, n3.registro);
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
  // linhas calculadas: todos com comissão configurada (critério F0e testado à parte)
  const com = (tecs: unknown[]) => tecs.map(() => ({ comissao_tipo_snapshot: "porcentagem" }));
  const ex = (principal: string | null, tecs: Record<string, unknown>[]) => [...regraNova.servicosDeOutrosTecnicos(principal, tecs, sv, com(tecs))];
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
  assertEquals([...regraNova.servicosDeOutrosTecnicos("ana", [{ ...BRUNO_B, servico_linha_id: "l2" }], rep, com([1]))], [1]);
  // F0e: técnico ligado SEM comissão configurada → o serviço não sai
  assertEquals([...regraNova.servicosDeOutrosTecnicos("ana", [BRUNO_B], sv, [{ comissao_tipo_snapshot: null }])], []);
  assertEquals([...regraNova.servicosDeOutrosTecnicos("ana", [BRUNO_B], sv, [undefined])], []);
});

// ===========================================================================
// F0e — técnico ligado SEM comissão configurada para o serviço: o serviço
// continua com o Técnico Principal (e o técnico fica com R$ 0 nele).
const SEM_CONFIG_BRUNO: Dados = {
  ...DADOS_ANA_BRUNO,
  COMISSOES: DADOS_ANA_BRUNO.COMISSOES.filter((c) => c.funcionario_id !== "bruno"),
};

Deno.test("F0e (i): técnico ligado COM comissão configurada — serviço sai da base (Ana R$ 10, Bruno R$ 40)", async () => {
  const n = await rodar(novo, { formData: FORM_AB, tecnicoId: "ana", tecnicosOS: [BRUNO_B] }, DADOS_ANA_BRUNO);
  assertEquals(n.erro, null);
  assertEquals(gravacaoOS(n).comissao_calculada_snapshot, 10);
  assertEquals(comissoesLidas(n, "ana", ["ana", "bruno"]), { ana: 10, bruno: 40 });
  // as 4 consultas de comissão dos técnicos acontecem uma vez só
  assertEquals(n.chamadas.filter((c: Chamada) => c.alvo === "tipos_servico").length, 2); // 1 do principal + 1 dos técnicos
});

Deno.test("F0e (ii): técnico ligado SEM comissão configurada — serviço fica com o principal, técnico R$ 0", async () => {
  const p = { formData: FORM_AB, tecnicoId: "ana", tecnicosOS: [BRUNO_B] };
  const a = await rodar(antes, p, SEM_CONFIG_BRUNO);
  const n = await rodar(novo, p, SEM_CONFIG_BRUNO);
  assertEquals([a.erro, n.erro], [null, null]);
  assertEquals(gravacaoOS(n).comissao_calculada_snapshot, 30); // 10% de A + 10% de B
  assertEquals(gravacaoOS(a).comissao_calculada_snapshot, 30); // igual a antes da F0c
  const linhaBruno = linhasGravadas(n)[0];
  assertEquals([linhaBruno.comissao_tipo_snapshot, linhaBruno.comissao_calculada_snapshot], [null, null]);
  const lidas = comissoesLidas(n, "ana", ["ana", "bruno"]);
  assertEquals(lidas, { ana: 30, bruno: 0 }); // ninguém recebe duas vezes, ninguém fica sem
  // A gravação é a mesma de antes da F0c (só muda a ordem das consultas).
  assertEquals(semSnapshot(n), semSnapshot(a));
});

Deno.test("F0e (iii): dois serviços, um técnico com configuração e outro sem", async () => {
  const dados: Dados = {
    ...DADOS_ANA_BRUNO,
    FUNCIONARIOS: [...DADOS_ANA_BRUNO.FUNCIONARIOS, { id: "caio", nome: "Caio", comissao_calculo: "faturamento" }],
  };
  const CAIO_A = { funcionario_id: "caio", descricao_servico: "Serviço A", servico_id: "srv-a" }; // Caio sem config
  const n = await rodar(novo, { formData: FORM_AB, tecnicoId: "ana", tecnicosOS: [CAIO_A, BRUNO_B] }, dados);
  assertEquals(n.erro, null);
  // A fica com a Ana (Caio sem config); B sai para o Bruno.
  assertEquals(gravacaoOS(n).comissao_calculada_snapshot, 10);
  assertEquals(comissoesLidas(n, "ana", ["ana", "bruno", "caio"]), { ana: 10, bruno: 40, caio: 0 });
});

// ===========================================================================
// F0g — linhas incompletas não são gravadas; falha em os_tecnicos avisa e não
// apaga as linhas antigas.
const AVISO = "A OS foi salva, mas os técnicos por serviço não foram gravados. Abra a OS e salve de novo.";
const BRUNO_REMOVIDO = { funcionario_id: "bruno", descricao_servico: "Película", servico_id: "srv-pelicula" };
const VAZIA = { funcionario_id: "", descricao_servico: "", servico_id: "" };
const toastFinal = (r: { registro: string[] }) => {
  const t = r.registro.filter((x) => x.startsWith("toast ")).at(-1)!;
  return JSON.parse(t.slice(6)) as { title: string; description: string; variant?: string };
};
const EDICAO_AB = { formData: FORM_AB, tecnicoId: "ana", ordem: { ...ORDEM, funcionario_id: "ana", total: 300 } };

Deno.test("F0g: linhas vazias/sem técnico/serviço removido não viram registro; a completa sim", async () => {
  const n = await rodar(novo, {
    ...EDICAO_AB,
    tecnicosOS: [VAZIA, BRUNO_B, { ...BRUNO_B, funcionario_id: "" }, BRUNO_REMOVIDO, { funcionario_id: "bruno", descricao_servico: "", servico_id: "" }],
  }, DADOS_ANA_BRUNO);
  assertEquals(n.erro, null);
  assertEquals(linhasGravadas(n).map((l) => [l.funcionario_id, l.servico_id]), [["bruno", "srv-b"]]);
  // a antiga saiu, só a nova ficou
  assertEquals(n.osTecnicosFinal.map((l: Linha) => [l.os_id, l.funcionario_id, l.servico_id]), [["os-1", "bruno", "srv-b"]]);
  // mesma gravação (e mesma comissão do principal) que mandar só a linha completa
  const soCompleta = await rodar(novo, { ...EDICAO_AB, tecnicosOS: [BRUNO_B] }, DADOS_ANA_BRUNO);
  assertEquals(semSnapshot(n), semSnapshot(soCompleta));
  assertEquals(gravacaoOS(n).comissao_calculada_snapshot, gravacaoOS(soCompleta).comissao_calculada_snapshot);
  assertEquals(n.osTecnicosFinal, soCompleta.osTecnicosFinal);
  assertEquals(toastFinal(n).variant, undefined);
});

Deno.test("F0g: serviço removido da OS — a linha do técnico não grava, nem comissão sobre o total, nem tira nada do principal", async () => {
  const a = await rodar(antes, { ...EDICAO_AB, tecnicosOS: [BRUNO_REMOVIDO] }, DADOS_ANA_BRUNO);
  const n = await rodar(novo, { ...EDICAO_AB, tecnicosOS: [BRUNO_REMOVIDO] }, DADOS_ANA_BRUNO);
  assertEquals([a.erro, n.erro], [null, null]);
  // antes: a linha virava registro sem serviço (servico_id null)
  assertEquals(linhasGravadas(a).map((l) => [l.funcionario_id, l.servico_id]), [["bruno", null]]);
  // novo: nada inserido; os_tecnicos da OS fica vazio; principal com A + B
  assertEquals(linhasGravadas(n), []);
  assertEquals(n.osTecnicosFinal, []);
  assertEquals(gravacaoOS(n).comissao_calculada_snapshot, 30);
  assert(!JSON.stringify(n.registro).includes("Erro"), JSON.stringify(n.registro));
});

Deno.test("F0g: lista só com linhas vazias = zero registros, sem erro", async () => {
  const n = await rodar(novo, { ...EDICAO_AB, tecnicosOS: [VAZIA, { ...VAZIA, funcionario_id: "bruno" }] }, DADOS_ANA_BRUNO);
  assertEquals(n.erro, null);
  assertEquals(linhasGravadas(n), []);
  assertEquals(n.osTecnicosFinal, []);
  assertEquals(toastFinal(n).title, "Ordem atualizada");
});

const ERRO_RLS = { message: "new row violates row-level security policy for table \"os_tecnicos\"", code: "42501" };
const falhaEm = (metodo: "insert" | "delete" | "select", erro: unknown = ERRO_RLS, vezes = Infinity) => {
  let n = 0;
  return (_c: Chamada, metodos: string[]) => {
    const bate = metodo === "select" ? metodos.includes("select") && !metodos.includes("insert") : metodos.includes(metodo);
    if (!bate || n >= vezes) return null;
    n++;
    return erro;
  };
};
const ANTIGA_FINAL = (() => {
  const { id: _id, ...resto } = OT_ANTIGA;
  return resto;
})();

function conferirFalha(r: Awaited<ReturnType<typeof rodar>>, criacao = false) {
  assertEquals(r.erro, null); // o save da OS não quebra
  assertEquals(r.eventosJanela, ["os-salva"]);
  const t = toastFinal(r);
  assertEquals(t.title, criacao ? "Ordem criada — técnicos por serviço não gravados" : "Ordem atualizada — técnicos por serviço não gravados");
  assert(t.description.includes(AVISO), t.description);
  assertEquals(t.variant, "destructive");
  const log = r.logs.find((l: string) => l.startsWith("[os_tecnicos] Falha ao gravar"));
  assert(log, JSON.stringify(r.logs));
}

Deno.test("F0g: insert falha — aviso claro e a linha antiga NÃO é apagada", async () => {
  const r = await rodar(novo, { ...EDICAO_AB, tecnicosOS: [BRUNO_B] }, DADOS_ANA_BRUNO, falhaEm("insert"));
  conferirFalha(r);
  assertEquals(r.osTecnicosFinal, [ANTIGA_FINAL]);
  // nenhum delete chegou a ser enviado
  assert(!gravacoesOsTecnicos(r).some((ops) => ops.some((o) => o[0] === "delete")));
  // antes: apagava primeiro e perdia a antiga, sem avisar
  const a = await rodar(antes, { ...EDICAO_AB, tecnicosOS: [BRUNO_B] }, DADOS_ANA_BRUNO, falhaEm("insert"));
  assertEquals(a.osTecnicosFinal, []);
  assertEquals(toastFinal(a).title, "Ordem atualizada");
});

Deno.test("F0g: coluna servico_linha_id ausente e o 2º insert também falha — antiga mantida e aviso", async () => {
  const erroColuna = { message: "Could not find the 'servico_linha_id' column of 'os_tecnicos'" };
  let n = 0;
  const falha = (_c: Chamada, metodos: string[]) => (metodos.includes("insert") ? (n++ === 0 ? erroColuna : ERRO_RLS) : null);
  const r = await rodar(novo, { ...EDICAO_AB, tecnicosOS: [BRUNO_B] }, DADOS_ANA_BRUNO, falha);
  conferirFalha(r);
  assertEquals(n, 2);
  assertEquals(r.osTecnicosFinal, [ANTIGA_FINAL]);
});

Deno.test("F0g: coluna servico_linha_id ausente e o 2º insert dá certo — grava sem a coluna, sem aviso", async () => {
  const erroColuna = { message: "Could not find the 'servico_linha_id' column of 'os_tecnicos'" };
  const r = await rodar(novo, { ...EDICAO_AB, tecnicosOS: [BRUNO_B] }, DADOS_ANA_BRUNO, falhaEm("insert", erroColuna, 1));
  assertEquals(r.erro, null);
  assertEquals(r.osTecnicosFinal.map((l: Linha) => [l.funcionario_id, l.servico_id]), [["bruno", "srv-b"]]);
  assertEquals(toastFinal(r).variant, undefined);
});

Deno.test("F0g: ler as linhas antigas falha — nada é inserido nem apagado, e aviso", async () => {
  const r = await rodar(novo, { ...EDICAO_AB, tecnicosOS: [BRUNO_B] }, DADOS_ANA_BRUNO, falhaEm("select"));
  conferirFalha(r);
  assertEquals(r.osTecnicosFinal, [ANTIGA_FINAL]);
  assert(!gravacoesOsTecnicos(r).some((ops) => ops.some((o) => o[0] === "insert" || o[0] === "delete")));
});

Deno.test("F0g: apagar as antigas falha — as novas são desfeitas (sem comissão em dobro) e aviso", async () => {
  const r = await rodar(novo, { ...EDICAO_AB, tecnicosOS: [BRUNO_B] }, DADOS_ANA_BRUNO, falhaEm("delete", ERRO_RLS, 1));
  conferirFalha(r);
  assertEquals(r.osTecnicosFinal, [ANTIGA_FINAL]);
});

Deno.test("F0g: limpar (lista vazia) falha — aviso", async () => {
  const r = await rodar(novo, { ...EDICAO_AB, tecnicosOS: [VAZIA] }, DADOS_ANA_BRUNO, falhaEm("delete"));
  conferirFalha(r);
  assertEquals(r.osTecnicosFinal, [ANTIGA_FINAL]);
});

Deno.test("F0g: criação com insert falhando — 'Ordem criada — técnicos por serviço não gravados'", async () => {
  const r = await rodar(novo, { formData: FORM_AB, tecnicoId: "ana", tecnicosOS: [BRUNO_B] }, DADOS_ANA_BRUNO, falhaEm("insert"));
  conferirFalha(r, true);
  assertEquals(r.osTecnicosFinal, [ANTIGA_FINAL]); // só a da outra OS
});

Deno.test("F0g: o aviso de falha vem logo depois da frase de sucesso (um toast só — TOAST_LIMIT=1)", async () => {
  const r = await rodar(novo, { ...EDICAO_AB, tecnicosOS: [BRUNO_B] }, DADOS_ANA_BRUNO, falhaEm("insert"));
  assert(toastFinal(r).description.startsWith("A ordem de serviço foi atualizada com sucesso. " + AVISO));
});
