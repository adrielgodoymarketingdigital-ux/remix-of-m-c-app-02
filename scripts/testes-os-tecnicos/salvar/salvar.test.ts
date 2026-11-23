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

type Op = [string, unknown[]];
interface Chamada { alvo: string; ops: Op[] }
const g = globalThis as unknown as {
  __supabaseFalso: { chamadas: Chamada[]; responder: (c: Chamada) => { data: unknown; error: unknown } };
};

// ---------------------------------------------------------------------------
// Banco fictício
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
  if (c.alvo === "servicos" && metodos.includes("select")) return resp(filtrar(CATALOGO));
  if (c.alvo === "comissoes_tipo_servico" && metodos.includes("select")) return resp(filtrar(COMISSOES));
  if (c.alvo === "tipos_servico" && metodos.includes("select")) return resp(filtrar(TIPOS));
  if (c.alvo === "loja_funcionarios" && metodos.includes("select") && valoresIn(c, "id")) return resp(filtrar(FUNCIONARIOS));
  if (c.alvo === "loja_funcionarios" && metodos.includes("select") && valorEq(c, "id")) return resp(filtrar(FUNCIONARIOS));
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
async function rodar(modulo: any, extra: Record<string, unknown>) {
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
  ["CRIAÇÃO com técnicos por serviço", {
    tecnicosOS: [{ funcionario_id: "func-b", descricao_servico: "Troca de bateria", servico_id: "srv-bateria" }],
  }],
];

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
