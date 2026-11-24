// Rodar com: bash scripts/testes-os-tecnicos-adicionais/run.sh
// salvarOrdemServico REAL (antes = REF_ANTES x novo) com Supabase falso que só
// registra as chamadas: técnicos adicionais na criação, na edição, sem principal,
// com falha da função, e com o freio fechado (nada muda). Sem rede, sem banco.
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

const ORDEM = {
  id: "os-1", numero_os: "101", user_id: "dono-1", empresa_id: null, cliente_id: null,
  status: "em_andamento", total: 450, created_at: "2026-11-20T13:00:00Z", data_saida: null,
  funcionario_id: "func-a", tipo_servico_id: null, avarias: {},
};

// Resposta da função salvar_tecnicos_os (null = ok); "lança" = a chamada estoura.
let respostaRpc: { code: string; message: string } | "lança" | null = null;

function responder(c: Chamada): { data: unknown; error: unknown } {
  const metodos = c.ops.map((o) => o[0]);
  const unico = metodos.includes("single") || metodos.includes("maybeSingle");
  if (c.alvo === "rpc:salvar_tecnicos_os") {
    if (respostaRpc === "lança") throw new Error("rede caiu");
    return respostaRpc ? { data: null, error: respostaRpc } : { data: { ok: true }, error: null };
  }
  if (c.alvo === "rpc:generate_os_number") return { data: "102", error: null };
  if (c.alvo === "ordens_servico" && metodos.includes("select") && !metodos.includes("insert") && !metodos.includes("update")) {
    const eqId = c.ops.find((o) => o[0] === "eq" && o[1][0] === "id")?.[1][1];
    const eqNumero = c.ops.find((o) => o[0] === "eq" && o[1][0] === "numero_os")?.[1][1];
    const linha = eqNumero === "102" ? { id: "os-nova", numero_os: "102", user_id: "dono-1", empresa_id: null }
      : eqId === "os-1" ? { ...ORDEM } : null;
    return { data: unico ? linha : (linha ? [linha] : []), error: null };
  }
  if (unico && (metodos.includes("insert") || metodos.includes("update"))) return { data: { id: `${c.alvo}-novo` }, error: null };
  return { data: unico ? null : [], error: null };
}

function formData() {
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
    servicos: [{ id: "srv-tela", nome: "Troca de tela", preco: 300, custo: 120, lucro: 180, quantidade: 1, created_at: "", user_id: "", custo_confirmado: true }],
    produtos: [], custosAdicionais: [], tempoGarantia: 90,
    formaPagamento: "", numeroParcelas: 2, desconto: 0, valorEntrada: 0, mostrarEntrada: false,
    formaPagamentoEntrada: "dinheiro", total: 300, entrada: 0, saldo: 0,
    status: "em_andamento",
    assinaturaEntrada: "", tipoAssinaturaEntrada: "digital", assinaturaSaida: "", tipoAssinaturaSaida: "digital",
    dataVencimentoPrazo: undefined, semDataDefinida: false,
    dataEntrada: new Date("2026-11-20T13:00:00Z"), dataSaida: undefined,
  };
}

const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})/g;
const normalizar = (v: unknown) => JSON.parse(JSON.stringify(v ?? null).replace(ISO, (m) => (m.startsWith("2026-11-20T13") ? m : "<agora>")));
(globalThis as unknown as { window: unknown }).window = { dispatchEvent: () => true };

// deno-lint-ignore no-explicit-any
async function rodar(modulo: any, extra: Record<string, unknown>, rpc: typeof respostaRpc = null) {
  respostaRpc = rpc;
  g.__supabaseFalso.chamadas = [];
  g.__supabaseFalso.responder = responder;
  const registro: string[] = [];
  const toasts: { title: string; description?: string; variant?: string }[] = [];
  const params = {
    formData: formData(), ordem: null, tecnicoId: "func-a", tecnicosOS: [], tipoServicoId: null,
    clienteSelecionadoId: null, bandeiraSelecionada: "", taxasAtivas: [], tiposServico: [],
    funcionarioId: null, tecnicoObrigatorioOS: false, isProprietario: true, empresaAtivaCtx: null,
    temAcessoModulo: () => true, calcularTaxa: () => ({ percentual: 0, valor: 0 }),
    toast: (o: { title: string; description?: string; variant?: string }) => { toasts.push(o); registro.push(`toast ${JSON.stringify(o)}`); },
    trackOSCriada: () => registro.push("track"), dispararConfetti: () => registro.push("confetti"),
    dispatchEvent: (e: string) => registro.push(`evento ${e}`), navigate: (p: string) => registro.push(`navigate ${p}`),
    onSuccess: () => registro.push("onSuccess"), onOpenChange: (o: boolean) => registro.push(`onOpenChange ${o}`),
    ...extra,
  };
  const [log, warn, info, error] = [console.log, console.warn, console.info, console.error];
  const logs: string[] = [];
  console.log = console.warn = console.info = console.error = (...a: unknown[]) => logs.push(a.map(String).join(" "));
  let retorno: unknown;
  try {
    retorno = await modulo.salvarOrdemServico(params);
  } finally {
    Object.assign(console, { log, warn, info, error });
  }
  const chamadas: Chamada[] = normalizar(g.__supabaseFalso.chamadas);
  return { chamadas, registro: normalizar(registro) as string[], toasts, retorno: normalizar(retorno), logs };
}

const rpcs = (r: { chamadas: Chamada[] }) =>
  r.chamadas.filter((c) => c.alvo === "rpc:salvar_tecnicos_os").map((c) => c.ops[0][1][0]);
const tocaTabela = (r: { chamadas: Chamada[] }) => r.chamadas.filter((c) => c.alvo === "os_tecnicos_adicionais");
const indice = (r: { chamadas: Chamada[] }, f: (c: Chamada) => boolean) => r.chamadas.findIndex(f);
const gravouOS = (c: Chamada) => c.alvo === "ordens_servico" && c.ops.some((o) => o[0] === "insert" || o[0] === "update");
const ehRpc = (c: Chamada) => c.alvo === "rpc:salvar_tecnicos_os";
const semRpc = (r: { chamadas: Chamada[] }) => r.chamadas.filter((c) => !ehRpc(c) && c.alvo !== "os_tecnicos_adicionais");

// Sucesso: nenhum toast fala de técnicos adicionais (o título pode citar a comissão,
// que neste banco falso não tem configuração: isso é de outra regra).
function semAvisoDeTecnicosAdicionais(r: { toasts: { title: string; description?: string; variant?: string }[] }) {
  const t = r.toasts.at(-1)!;
  assert(!/técnicos adicionais/.test(`${t.title} ${t.description}`), JSON.stringify(t));
}

const CRIACAO = (adicionais: string[], tecnicoId: string | null = "func-a") => ({
  tecnicoId, tecnicosAdicionais: { adicionais, originais: null, principalOriginal: null },
});
const EDICAO = (tecnicoId: string | null, adicionais: string[], originais: string[]) => ({
  ordem: ORDEM, tecnicoId, tecnicosAdicionais: { adicionais, originais, principalOriginal: ORDEM.funcionario_id },
});

// ---------------------------------------------------------------------------
for (const [nome, extra] of [
  ["criação", {}],
  ["edição", { ordem: ORDEM }],
  ["edição trocando o principal", { ordem: ORDEM, tecnicoId: "func-b" }],
] as [string, Record<string, unknown>][]) {
  Deno.test(`freio fechado (sem a lista): mesmas chamadas, retorno e avisos de antes — ${nome}`, async () => {
    const a = await rodar(antes, extra);
    const n = await rodar(novo, extra);
    assert(a.chamadas.some(gravouOS), "o cenário precisa gravar a OS");
    assertEquals(n.chamadas, a.chamadas);
    assertEquals(n.registro, a.registro);
    assertEquals(n.retorno, a.retorno);
    assertEquals(rpcs(n), []);
    assertEquals(tocaTabela(n), []);
  });
}

Deno.test("criação com principal + adicionais: chama a função DEPOIS de criar a OS", async () => {
  const r = await rodar(novo, CRIACAO(["func-b", "func-c"]));
  assertEquals(rpcs(r), [{ p_ordem_id: "os-nova", p_principal: "func-a", p_adicionais: ["func-b", "func-c"] }]);
  assert(indice(r, gravouOS) < indice(r, ehRpc));
  assertEquals((r.retorno as { tecnicosAdicionaisGravados?: boolean }).tecnicosAdicionaisGravados, true);
  semAvisoDeTecnicosAdicionais(r);
  assert(r.registro.includes("onOpenChange false"));
});

Deno.test("criação sem adicionais: não chama a função (nada a gravar)", async () => {
  const r = await rodar(novo, CRIACAO([]));
  assertEquals(rpcs(r), []);
  assertEquals((r.retorno as Record<string, unknown>).tecnicosAdicionaisGravados, undefined);
});

Deno.test("edição que só troca adicionais: chama com a lista nova", async () => {
  const r = await rodar(novo, EDICAO("func-a", ["func-c"], ["func-b"]));
  assertEquals(rpcs(r), [{ p_ordem_id: "os-1", p_principal: "func-a", p_adicionais: ["func-c"] }]);
  semAvisoDeTecnicosAdicionais(r);
});

Deno.test("edição sem mudança (lista igual em outra ordem, mesmo principal): não chama", async () => {
  const r = await rodar(novo, EDICAO("func-a", ["func-c", "func-b"], ["func-b", "func-c"]));
  assertEquals(rpcs(r), []);
  assertEquals(tocaTabela(r), []);
});

Deno.test("edição que troca o principal por um adicional: UPDATE da OS e depois a função sem ele na lista", async () => {
  // A tela já tirou func-b dos adicionais ao escolhê-lo como principal.
  const r = await rodar(novo, EDICAO("func-b", ["func-c"], ["func-b", "func-c"]));
  const upd = r.chamadas.find(gravouOS)!;
  const valores = upd.ops.find((o) => o[0] === "update")![1][0] as Record<string, unknown>;
  assertEquals(valores.funcionario_id, "func-b");
  assertEquals(rpcs(r), [{ p_ordem_id: "os-1", p_principal: "func-b", p_adicionais: ["func-c"] }]);
  assert(indice(r, gravouOS) < indice(r, ehRpc));
});

Deno.test("OS sem principal: criação não chama; edição que tinha adicionais apaga direto, sem a função", async () => {
  const c = await rodar(novo, CRIACAO([], null));
  assertEquals(rpcs(c), []);
  assertEquals(tocaTabela(c), []);
  const e = await rodar(novo, EDICAO(null, [], ["func-b"]));
  assertEquals(rpcs(e), []);
  assertEquals(tocaTabela(e).map((x) => x.ops), [[["delete", []], ["eq", ["os_id", "os-1"]]]]);
});

for (const [nome, rpc, esperado] of [
  ["erro TA004", { code: "TA004", message: "Técnico adicional x não é funcionário ativo desta loja" },
    "A OS foi salva, mas os técnicos adicionais não foram gravados: Um dos técnicos escolhidos não é funcionário ativo desta loja. Abra a OS e salve de novo."],
  ["erro desconhecido", { code: "42501", message: "permission denied" },
    "A OS foi salva, mas os técnicos adicionais não foram gravados: Erro inesperado ao gravar os técnicos adicionais. Abra a OS e salve de novo."],
  ["chamada estoura", "lança",
    "A OS foi salva, mas os técnicos adicionais não foram gravados: Erro inesperado ao gravar os técnicos adicionais. Abra a OS e salve de novo."],
] as [string, typeof respostaRpc, string][]) {
  Deno.test(`falha da função (${nome}): OS salva, nada desfeito, resto do salvamento igual, aviso claro`, async () => {
    const ok = await rodar(novo, EDICAO("func-a", ["func-c"], ["func-b"]));
    const falha = await rodar(novo, EDICAO("func-a", ["func-c"], ["func-b"]), rpc);
    // Mesmas gravações (OS, técnicos por serviço, estoque, contas...) com ou sem a falha.
    assertEquals(semRpc(falha), semRpc(ok));
    assertEquals(tocaTabela(falha), []);
    const t = falha.toasts.at(-1)!;
    assertEquals(t.title, "Ordem atualizada — técnicos adicionais não gravados");
    assertEquals(t.variant, "destructive");
    assert(t.description!.includes(esperado), t.description);
    assertEquals((falha.retorno as { tecnicosAdicionaisGravados?: boolean }).tecnicosAdicionaisGravados, false);
    assert(falha.registro.includes("onSuccess") && falha.registro.includes("onOpenChange false"));
    console.log(`      toast: ${t.title} | ${t.description}`);
  });
}

Deno.test("falha na criação: aviso no toast de criação", async () => {
  const r = await rodar(novo, CRIACAO(["func-b"]), { code: "TA005", message: "x" });
  const t = r.toasts.at(-1)!;
  assertEquals(t.title, "Ordem criada — técnicos adicionais não gravados");
  assert(t.description!.includes("A OS pode ter no máximo 4 técnicos adicionais."), t.description);
});
