// Rodar com: bash scripts/testes-os-tecnicos/comissao/run.sh
// F0b: "Comissões a Pagar" (useComissoes), gráfico mensal
// (useComissoesSerieMensal) e "Desempenho" (useDesempenhoFuncionario + a regra
// do PerfilDesempenhoFuncionario) REAIS de ANTES (REF_ANTES) x NOVO, com
// Supabase em memória. Regra "a": cada técnico ganha só pelo serviço em que
// está ligado. Dados fictícios; nada vai à rede nem ao banco.
import { assert, assertEquals } from "jsr:@std/assert@1";

const PASTA = Deno.env.get("COMISSAO_BUNDLES");
if (!PASTA) throw new Error("rode pelo run.sh (COMISSAO_BUNDLES)");
const antes = {
  comissoes: await import(`file://${PASTA}/antes/useComissoes.js`),
  desempenho: await import(`file://${PASTA}/antes/useDesempenhoFuncionario.js`),
  regra: await import(`file://${PASTA}/antes/comissaoOsDoSnapshot.js`),
};
const novo = {
  comissoes: await import(`file://${PASTA}/novo/useComissoes.js`),
  desempenho: await import(`file://${PASTA}/novo/useDesempenhoFuncionario.js`),
  regra: await import(`file://${PASTA}/novo/comissaoOsDoSnapshot.js`),
};

type Linha = Record<string, unknown>;
const g = globalThis as unknown as {
  __bancoFalso: Record<string, Linha[]>;
  __ultimaConsulta?: () => Promise<unknown>;
};

// ---------------------------------------------------------------------------
// Banco fictício
const NOV = (dia: number) => `2026-11-${String(dia).padStart(2, "0")}T15:00:00.000Z`;
const OUT = (dia: number) => `2026-10-${String(dia).padStart(2, "0")}T15:00:00.000Z`;

function os(id: string, principal: string | null, total: number, snap: number | null, extra: Linha = {}): Linha {
  return {
    id, numero_os: id.replace("os-", ""), user_id: "dono-1", funcionario_id: principal, total,
    status: "entregue", created_at: NOV(10), data_saida: NOV(12), deleted_at: null, is_teste: false,
    comissao_calculada_snapshot: snap, comissao_tipo_snapshot: null, comissao_valor_snapshot: null,
    tipo_servico_id: null, tipo_servico_nome_snapshot: null, defeito_relatado: "", dispositivo_marca: "Samsung",
    dispositivo_modelo: "A10", avarias: {}, cliente: { nome: "Cliente fictício" }, ...extra,
  };
}
function linha(osId: string, func: string, snap: number | null, servico: { id: string | null; nome: string | null; preco: number | null } | null): Linha {
  return {
    id: `ot-${osId}-${func}-${servico?.id ?? "sem"}`, os_id: osId, funcionario_id: func,
    descricao_servico: servico?.nome ?? "Serviço antigo",
    servico_id: servico?.id ?? null, servico_nome_snapshot: servico?.nome ?? null,
    preco_servico_snapshot: servico?.preco ?? null, comissao_calculada_snapshot: snap,
  };
}

const FUNCIONARIOS = [
  { id: "ana", nome: "Ana", cargo: "Técnico", ativo: true, comissao_tipo: null, comissao_valor: 0, comissao_escopo: null, comissoes_por_cargo: null, base_comissao: "criacao", comissao_calculo: "faturamento" },
  { id: "bruno", nome: "Bruno", cargo: "Técnico", ativo: true, comissao_tipo: null, comissao_valor: 0, comissao_escopo: null, comissoes_por_cargo: null, base_comissao: "criacao", comissao_calculo: "faturamento" },
  { id: "davi", nome: "Davi", cargo: "Técnico", ativo: true, comissao_tipo: null, comissao_valor: 0, comissao_escopo: null, comissoes_por_cargo: null, base_comissao: "criacao", comissao_calculo: "faturamento" },
  // Carla: sem "Comissão por Tipo de Serviço" → Sistema A (10% sobre OS).
  { id: "carla", nome: "Carla", cargo: "Técnico", ativo: true, comissao_tipo: "porcentagem", comissao_valor: 10, comissao_escopo: "servicos_os", comissoes_por_cargo: null, base_comissao: "criacao", comissao_calculo: "faturamento" },
];
const CONFIG_TIPO = [
  { funcionario_id: "ana", tipo_servico_id: "t-a", comissao_tipo: "porcentagem", comissao_valor: 10 },
  { funcionario_id: "bruno", tipo_servico_id: "t-b", comissao_tipo: "porcentagem", comissao_valor: 20 },
  { funcionario_id: "davi", tipo_servico_id: "t-a", comissao_tipo: "porcentagem", comissao_valor: 10 },
];

const ORDENS: Linha[] = [
  os("os-1", "ana", 300, 10), // exemplo Ana/Bruno
  os("os-2", "davi", 250, 25), // (i) só principal
  os("os-3", "ana", 500, 50), // (iii) principal também em os_tecnicos
  os("os-4", null, 120, null), // (iv) técnico só em os_tecnicos, OS sem principal
  os("os-5", "carla", 400, null), // (v) linha sem serviço de outro técnico
  os("os-6", "ana", 900, 90, { deleted_at: NOV(20) }), // (vi) apagada
  os("os-7", "ana", 200, 20, { status: "em_andamento" }), // não comissionável
  os("os-8", "ana", 300, 60), // principal SEM linha própria + Bruno por serviço
  os("os-9", "ana", 500, 50, { is_teste: true }), // OS de teste
  os("os-10", "bruno", 330, 33, { created_at: OUT(10), data_saida: OUT(11) }), // outubro
];
const LINHAS: Linha[] = [
  linha("os-1", "ana", 10, { id: "srv-a", nome: "Serviço A", preco: 100 }),
  linha("os-1", "bruno", 40, { id: "srv-b", nome: "Serviço B", preco: 200 }),
  linha("os-3", "ana", 15, { id: "srv-c", nome: "Serviço C", preco: 150 }),
  linha("os-4", "bruno", 30, { id: "srv-d", nome: "Serviço D", preco: 150 }),
  linha("os-5", "bruno", 99, null), // sem serviço ligado (cálculo antigo)
  linha("os-6", "bruno", 1000, { id: "srv-e", nome: "Serviço E", preco: 5000 }),
  linha("os-7", "bruno", 70, { id: "srv-f", nome: "Serviço F", preco: 350 }),
  linha("os-8", "bruno", 40, { id: "srv-b", nome: "Serviço B", preco: 200 }),
  linha("os-9", "bruno", 500, { id: "srv-g", nome: "Serviço G", preco: 2500 }),
];

function carregarBanco(ordens: Linha[], linhas: Linha[]) {
  g.__bancoFalso = {
    ordens_servico: ordens,
    os_tecnicos: linhas,
    vendas: [],
    comissoes_tipo_servico: CONFIG_TIPO,
    loja_funcionarios: FUNCIONARIOS,
    tipos_servico: [{ id: "t-a", nome: "Serviço A" }, { id: "t-b", nome: "Serviço B" }],
  };
}

// ---------------------------------------------------------------------------
// Rodar os hooks reais (useQuery falso guarda o queryFn)
type Modulos = typeof novo;
const MES = new Date(2026, 10, 15);
const INICIO = "2026-11-01T03:00:00.000Z";
const FIM = "2026-12-01T02:59:59.999Z";

async function rodarConsulta(chamar: () => unknown): Promise<unknown> {
  g.__ultimaConsulta = undefined;
  chamar();
  return await g.__ultimaConsulta!();
}
// deno-lint-ignore no-explicit-any
const comissoesDe = (m: Modulos) => rodarConsulta(() => m.comissoes.useComissoes(FUNCIONARIOS, MES)) as Promise<any>;
// deno-lint-ignore no-explicit-any
const serieDe = (m: Modulos) => rodarConsulta(() => m.comissoes.useComissoesSerieMensal(FUNCIONARIOS, MES, 2)) as Promise<any>;
// deno-lint-ignore no-explicit-any
const desempenhoDe = (m: Modulos, func: string) => rodarConsulta(() => m.desempenho.useDesempenhoFuncionario(func, INICIO, FIM)) as Promise<any>;

// Mesma regra da tela PerfilDesempenhoFuncionario (resolverComissaoOS + cards),
// na versão de antes e na nova.
// deno-lint-ignore no-explicit-any
function resolverAntes(o: any) {
  return antes.regra.comissaoOsDoSnapshot({ status: o.status, comissao_calculada_snapshot: o.comissao_calculada_snapshot, tecnicosDoFuncionario: o.tecnicos_os ?? [] });
}
// deno-lint-ignore no-explicit-any
function resolverNovo(o: any) {
  return novo.regra.comissaoOsDaParticipacao(o, { ehPrincipal: o.tecnico_principal !== false, linhas: o.tecnicos_os ?? [] });
}
// "Valor Total" do Perfil: antes = Σ os.total; novo = total da OS para o
// principal e só os serviços dele para quem está "por serviço" (F0c).
// deno-lint-ignore no-explicit-any
const valorAntes = (o: any) => o.total || 0;
// deno-lint-ignore no-explicit-any
const valorNovo = (o: any) => novo.regra.valorOsDaParticipacao(o, { ehPrincipal: o.tecnico_principal !== false, linhas: o.tecnicos_os ?? [] });
// deno-lint-ignore no-explicit-any
function cardsPerfil(ordens: any[], resolver: (o: any) => number | null) {
  const entregues = ordens.filter((o) => (o.status || "").trim().toLowerCase() === "entregue");
  const valor = resolver === resolverNovo ? valorNovo : valorAntes;
  return {
    osEntregues: entregues.length,
    valorTotal: entregues.reduce((a, o) => a + valor(o), 0),
    comissaoTotal: entregues.reduce((a, o) => a + (resolver(o) || 0), 0),
  };
}
// deno-lint-ignore no-explicit-any
const porFunc = (r: any, id: string) => r.atual.find((c: any) => c.funcionarioId === id);
// deno-lint-ignore no-explicit-any
const semMarca = (ordens: any[]) => ordens.map(({ tecnico_principal: _x, ...resto }) => resto);

// ---------------------------------------------------------------------------
Deno.test("exemplo Ana/Bruno: antes Ana R$ 10 e Bruno R$ 0; depois Ana R$ 10 e Bruno R$ 40", async () => {
  carregarBanco([os("os-1", "ana", 300, 10)], LINHAS.filter((l) => l.os_id === "os-1"));
  const [a, n] = [await comissoesDe(antes), await comissoesDe(novo)];
  assertEquals([porFunc(a, "ana").comissaoCalculada, porFunc(a, "bruno").comissaoCalculada], [10, 0]);
  assertEquals([porFunc(n, "ana").comissaoCalculada, porFunc(n, "bruno").comissaoCalculada], [10, 40]);
  assertEquals([a.totalComissoes, n.totalComissoes], [10, 50]);
  // Perfil de Desempenho do Bruno
  const pa = cardsPerfil((await desempenhoDe(antes, "bruno")).ordens, resolverAntes);
  const pn = cardsPerfil((await desempenhoDe(novo, "bruno")).ordens, resolverNovo);
  assertEquals(pa, { osEntregues: 0, valorTotal: 0, comissaoTotal: 0 });
  // "Valor Total" do Bruno = só o serviço dele (R$ 200), não a OS (R$ 300).
  assertEquals(pn, { osEntregues: 1, valorTotal: 200, comissaoTotal: 40 });
  // Perfil da Ana não muda
  assertEquals(
    cardsPerfil((await desempenhoDe(novo, "ana")).ordens, resolverNovo),
    cardsPerfil((await desempenhoDe(antes, "ana")).ordens, resolverAntes),
  );
});

Deno.test("Comissões a Pagar: cenários (i) a (vii)", async () => {
  carregarBanco(ORDENS, LINHAS);
  const a = await comissoesDe(antes);
  const n = await comissoesDe(novo);
  // (i) só principal: igual
  assertEquals(porFunc(n, "davi").comissaoCalculada, 25);
  assertEquals(porFunc(a, "davi"), porFunc(n, "davi"));
  // (iii) Ana principal também em os_tecnicos: os-1 = 10 (linha), os-3 = 15
  // (linha, não 50 nem 65), os-8 = 60 (snapshot da OS, ela não tem linha). Igual a antes.
  assertEquals(porFunc(n, "ana").comissaoCalculada, 10 + 15 + 60);
  assertEquals(porFunc(a, "ana"), porFunc(n, "ana"));
  // (ii)/(iv)/(v)/(vi)/(vii) Bruno: os-1 40 + os-4 30 + os-8 40. Fora: os-5
  // (linha sem serviço), os-6 (apagada), os-7 (não entregue), os-9 (teste), os-10 (outubro).
  assertEquals(porFunc(a, "bruno").comissaoCalculada, 0);
  assertEquals(porFunc(n, "bruno").comissaoCalculada, 40 + 30 + 40);
  assertEquals(porFunc(n, "bruno").quantidadeOS, 3);
  // Valor de OS do Bruno continua só como principal (nenhuma em novembro).
  assertEquals(porFunc(n, "bruno").totalServicos, 0);
  // Carla (Sistema A, sem config): igual a antes, 10% de 400.
  assertEquals(porFunc(n, "carla").comissaoCalculada, 40);
  assertEquals(porFunc(a, "carla"), porFunc(n, "carla"));
  // Totais da equipe
  assertEquals(a.totalComissoes, 85 + 0 + 25 + 40);
  assertEquals(n.totalComissoes, 85 + 110 + 25 + 40);
  assertEquals(n.totalVendido, a.totalVendido); // valor vendido não conta OS em dobro
});

Deno.test("gráfico mensal: novembro ganha a comissão do Bruno; outubro igual", async () => {
  carregarBanco(ORDENS, LINHAS);
  const a = await serieDe(antes);
  const n = await serieDe(novo);
  assertEquals(a.map((p: { mes: string }) => p.mes), ["2026-10", "2026-11"]);
  assertEquals(n[0], a[0]); // outubro: só a os-10 do Bruno como principal
  assertEquals(n[0].totalComissoes, 33);
  assertEquals(a[1].totalComissoes, 150);
  assertEquals(n[1].totalComissoes, 260);
  assertEquals(n[1].totalVendido, a[1].totalVendido);
});

Deno.test("Desempenho: a OS conta para o técnico por serviço, comissão só pelo serviço dele", async () => {
  carregarBanco(ORDENS, LINHAS);
  const dn = await desempenhoDe(novo, "bruno");
  // deno-lint-ignore no-explicit-any
  const lista = dn.ordens.map((o: any) => [o.id, o.tecnico_principal, resolverNovo(o)]);
  assertEquals(lista, [
    ["os-1", false, 40],
    ["os-4", false, 30],
    ["os-7", false, 0], // não entregue: aparece no histórico, comissão 0
    ["os-8", false, 40],
  ]);
  // (vii) só as linhas DELE em cada OS
  // deno-lint-ignore no-explicit-any
  assert(dn.ordens.every((o: any) => o.tecnicos_os.every((t: any) => t.comissao_calculada_snapshot !== 10)));
  // Valor: só os serviços dele (200 + 150 + 200), não as OS inteiras (720).
  assertEquals(cardsPerfil(dn.ordens, resolverNovo), { osEntregues: 3, valorTotal: 550, comissaoTotal: 110 });
  // Ana: igual a antes (principal em os-1, 3, 7, 8)
  const aa = await desempenhoDe(antes, "ana");
  const an = await desempenhoDe(novo, "ana");
  assertEquals(semMarca(an.ordens), aa.ordens);
  // deno-lint-ignore no-explicit-any
  assert(an.ordens.every((o: any) => o.tecnico_principal === true));
  assertEquals(cardsPerfil(an.ordens, resolverNovo), cardsPerfil(aa.ordens, resolverAntes));
  assertEquals(cardsPerfil(an.ordens, resolverNovo).comissaoTotal, 85);
  // os-1 da Ana: só a linha dela (R$ 10), não a do Bruno
  // deno-lint-ignore no-explicit-any
  assertEquals(an.ordens.find((o: any) => o.id === "os-1").tecnicos_os.map((t: any) => t.comissao_calculada_snapshot), [10]);
});

Deno.test("OS SEM técnicos por serviço: tudo idêntico antes x depois", async () => {
  carregarBanco(ORDENS, []);
  assertEquals(await comissoesDe(novo), await comissoesDe(antes));
  assertEquals(await serieDe(novo), await serieDe(antes));
  for (const f of FUNCIONARIOS) {
    const a = await desempenhoDe(antes, f.id);
    const n = await desempenhoDe(novo, f.id);
    assertEquals(semMarca(n.ordens), a.ordens);
    assertEquals({ ...n, ordens: null }, { ...a, ordens: null });
    assertEquals(cardsPerfil(n.ordens, resolverNovo), cardsPerfil(a.ordens, resolverAntes));
  }
});

Deno.test("regra pura: participação e anti-dupla-contagem", () => {
  const r = novo.regra;
  const ligada = { comissao_calculada_snapshot: 40, servico_id: "s", servico_nome_snapshot: "S" };
  const semServico = { comissao_calculada_snapshot: 99, servico_id: null, servico_nome_snapshot: null };
  const orfa = { comissao_calculada_snapshot: 7, servico_id: null, servico_nome_snapshot: "Serviço apagado do catálogo" };
  assertEquals(r.linhaTemServicoLigado(ligada), true);
  assertEquals(r.linhaTemServicoLigado(semServico), false);
  assertEquals(r.linhaTemServicoLigado(orfa), true);
  // principal: todas as linhas dele, como antes (inclusive sem serviço)
  assertEquals(r.participacaoNaOS("ana", "ana", [semServico]), { ehPrincipal: true, linhas: [semServico] });
  assertEquals(r.participacaoNaOS("ana", "ana", []), { ehPrincipal: true, linhas: [] });
  // não principal: só linhas ligadas; sem nenhuma ligada → não participa
  assertEquals(r.participacaoNaOS("bruno", "ana", [ligada, semServico]), { ehPrincipal: false, linhas: [ligada] });
  assertEquals(r.participacaoNaOS("bruno", "ana", [semServico]), null);
  assertEquals(r.participacaoNaOS("bruno", "ana", []), null);
  // o snapshot da OS nunca vai para quem não é o principal
  const osEntregue = { status: "entregue", comissao_calculada_snapshot: 500 };
  // (sem linhas = sem dado: null, que a soma trata como 0 — nunca os 500 do principal)
  assertEquals(r.comissaoOsDaParticipacao(osEntregue, { ehPrincipal: false, linhas: [] }), null);
  assertEquals(r.comissaoOsDaParticipacao(osEntregue, { ehPrincipal: false, linhas: [ligada] }), 40);
  // principal = comissaoOsDoSnapshot de sempre
  assertEquals(r.comissaoOsDaParticipacao(osEntregue, { ehPrincipal: true, linhas: [] }), 500);
  assertEquals(r.comissaoOsDaParticipacao(osEntregue, { ehPrincipal: true, linhas: [ligada] }), 40);
  assertEquals(r.comissaoOsDaParticipacao({ status: "em_andamento", comissao_calculada_snapshot: 500 }, { ehPrincipal: true, linhas: [] }), 0);
});

// ===========================================================================
// F0d — Sistema A (escopo/cargo, sem "Comissão por Tipo de Serviço"): a base
// do principal não inclui os serviços ligados a outros técnicos.
// OS R$ 300 = serviço A R$ 100 (sem técnico) + serviço B R$ 200 (Bruno 20%).
const ANA_A_PCT = { id: "ana-a", nome: "Ana A", cargo: "Técnico", ativo: true, comissao_tipo: "porcentagem", comissao_valor: 10, comissao_escopo: "servicos_os", comissoes_por_cargo: null, base_comissao: "criacao", comissao_calculo: "faturamento" };
const ANA_A_FIXO = { ...ANA_A_PCT, id: "ana-f", nome: "Ana fixo", comissao_tipo: "valor_fixo", comissao_valor: 5 };
const BRUNO_T = FUNCIONARIOS[1];
const SERVICOS_AB = [{ id: "srv-a", nome: "Serviço A", preco: 100 }, { id: "srv-b", nome: "Serviço B", preco: 200 }];
const LINHA_BRUNO_B = (osId: string) => linha(osId, "bruno", 40, { id: "srv-b", nome: "Serviço B", preco: 200 });

function bancoSistemaA(ordens: Linha[], linhas: Linha[]) {
  carregarBanco(ordens, linhas);
  g.__bancoFalso.loja_funcionarios = [ANA_A_PCT, ANA_A_FIXO, BRUNO_T];
}
const EQUIPE_A = [ANA_A_PCT, ANA_A_FIXO, BRUNO_T];
// deno-lint-ignore no-explicit-any
const comissoesEquipeA = (m: Modulos) => rodarConsulta(() => m.comissoes.useComissoes(EQUIPE_A, MES)) as Promise<any>;
// deno-lint-ignore no-explicit-any
const serieEquipeA = (m: Modulos) => rodarConsulta(() => m.comissoes.useComissoesSerieMensal(EQUIPE_A, MES, 2)) as Promise<any>;
// os() com servicos_realizados (no banco real vem de avarias->servicos_realizados)
const osA = (id: string, principal: string, total: number, servicos: Linha[], extra: Linha = {}) =>
  os(id, principal, total, null, { servicos_realizados: servicos, avarias: { servicos_realizados: servicos }, ...extra });

Deno.test("Sistema A, exemplo: antes Ana R$ 30 e Bruno R$ 0; depois Ana R$ 10 e Bruno R$ 40 (total R$ 50)", async () => {
  bancoSistemaA([osA("os-a1", "ana-a", 300, SERVICOS_AB)], [LINHA_BRUNO_B("os-a1")]);
  const a = await comissoesEquipeA(antes);
  const n = await comissoesEquipeA(novo);
  assertEquals([porFunc(a, "ana-a").comissaoCalculada, porFunc(a, "bruno").comissaoCalculada], [30, 0]);
  assertEquals([porFunc(n, "ana-a").comissaoCalculada, porFunc(n, "bruno").comissaoCalculada], [10, 40]);
  assertEquals(porFunc(n, "ana-a").comissaoCalculada + porFunc(n, "bruno").comissaoCalculada, 50);
  // Detalhe por cargo acompanha a base nova; valor de OS ("Total Vendido") não muda.
  assertEquals(porFunc(n, "ana-a").detalhePorCargo, [{ cargo: "Técnico", comissao: 10, base: 10 }]);
  assertEquals(porFunc(n, "ana-a").totalServicos, 300);
  assertEquals(porFunc(n, "ana-a").quantidadeOS, 1);
  assertEquals(n.totalVendido, a.totalVendido);
  // Gráfico mensal: novembro = 10 + 40
  const sn = await serieEquipeA(novo);
  assertEquals(sn[1].totalComissoes, 50);
  assertEquals((await serieEquipeA(antes))[1].totalComissoes, 30);
});

Deno.test("Sistema A, valor fixo por OS: com serviço próprio conta 1; todos de outros técnicos conta 0", async () => {
  bancoSistemaA([
    osA("os-f1", "ana-f", 300, SERVICOS_AB), // A é dela → conta
    osA("os-f2", "ana-f", 200, [SERVICOS_AB[1]]), // só B, do Bruno → não conta
  ], [LINHA_BRUNO_B("os-f1"), LINHA_BRUNO_B("os-f2")]);
  const a = await comissoesEquipeA(antes);
  const n = await comissoesEquipeA(novo);
  assertEquals(porFunc(a, "ana-f").comissaoCalculada, 10); // 2 OS × R$ 5
  assertEquals(porFunc(n, "ana-f").comissaoCalculada, 5); // 1 OS × R$ 5
  assertEquals(porFunc(n, "bruno").comissaoCalculada, 80);
  // A coluna OS da tabela segue contando as OS em que ela é a principal.
  assertEquals(porFunc(n, "ana-f").quantidadeOS, 2);
});

Deno.test("Sistema A, principal COM linha própria: igual a antes", async () => {
  bancoSistemaA(
    [osA("os-p1", "ana-a", 300, SERVICOS_AB)],
    [linha("os-p1", "ana-a", null, { id: "srv-a", nome: "Serviço A", preco: 100 }), LINHA_BRUNO_B("os-p1")],
  );
  const a = await comissoesEquipeA(antes);
  const n = await comissoesEquipeA(novo);
  assertEquals(porFunc(n, "ana-a"), porFunc(a, "ana-a"));
  assertEquals(porFunc(n, "ana-a").comissaoCalculada, 30);
});

Deno.test("Sistema A: OS apagada, de teste e de outro mês continuam fora; nunca abaixo de zero", async () => {
  bancoSistemaA([
    osA("os-x1", "ana-a", 300, SERVICOS_AB, { deleted_at: NOV(20) }),
    osA("os-x2", "ana-a", 300, SERVICOS_AB, { is_teste: true }),
    osA("os-x3", "ana-a", 300, SERVICOS_AB, { created_at: OUT(10), data_saida: OUT(11) }),
    osA("os-x4", "ana-a", 150, SERVICOS_AB), // OS com desconto: 150 − 200 → 0
  ], ["os-x1", "os-x2", "os-x3", "os-x4"].map(LINHA_BRUNO_B));
  const n = await comissoesEquipeA(novo);
  assertEquals(porFunc(n, "ana-a").comissaoCalculada, 0);
  assertEquals(porFunc(n, "bruno").comissaoCalculada, 40); // só a os-x4
  const sn = await serieEquipeA(novo);
  // Outubro (os-x3, fora do mês acima, mas dentro do gráfico): Ana 10% de
  // (300 − 200) = 10 + Bruno 40 = 50. Novembro: Ana 0 (os-x4) + Bruno 40.
  assertEquals(sn[0].totalComissoes, 50);
  assertEquals(sn[1].totalComissoes, 40);
});

Deno.test("Sistema A: OS SEM técnicos por serviço — idêntico antes x depois", async () => {
  bancoSistemaA([
    osA("os-s1", "ana-a", 300, SERVICOS_AB),
    osA("os-s2", "ana-f", 200, [SERVICOS_AB[1]]),
    osA("os-s3", "ana-a", 300, SERVICOS_AB, { created_at: OUT(10), data_saida: OUT(11) }),
  ], []);
  assertEquals(await comissoesEquipeA(novo), await comissoesEquipeA(antes));
  assertEquals(await serieEquipeA(novo), await serieEquipeA(antes));
});

Deno.test("regra pura: baseSistemaADaOS", () => {
  const r = novo.regra;
  const sv = [{ id: "a" }, { id: "b" }];
  const lB = { funcionario_id: "bruno", servico_id: "b", servico_nome_snapshot: "B", preco_servico_snapshot: 200 };
  const os300 = { funcionario_id: "ana", total: 300 };
  assertEquals(r.baseSistemaADaOS(os300, [], sv), { valor: 300, conta: true });
  assertEquals(r.baseSistemaADaOS(os300, [lB], sv), { valor: 100, conta: true });
  assertEquals(r.baseSistemaADaOS({ funcionario_id: "ana", total: 200 }, [lB], [{ id: "b" }]), { valor: 0, conta: false });
  // principal com linha própria / sem principal / linha sem serviço / sem técnico
  assertEquals(r.baseSistemaADaOS(os300, [{ funcionario_id: "ana", servico_id: "a" }, lB], sv), { valor: 300, conta: true });
  assertEquals(r.baseSistemaADaOS({ funcionario_id: null, total: 300 }, [lB], sv), { valor: 300, conta: true });
  assertEquals(r.baseSistemaADaOS(os300, [{ funcionario_id: "bruno", servico_id: null, servico_nome_snapshot: null, preco_servico_snapshot: 200 }], sv), { valor: 300, conta: true });
  assertEquals(r.baseSistemaADaOS(os300, [{ ...lB, funcionario_id: "" }], sv), { valor: 300, conta: true });
  // serviço repetido: a linha decide; serviço apagado do catálogo desconta, mas a OS conta
  const rep = [{ id: "b", linha_id: "l1" }, { id: "b", linha_id: "l2" }];
  assertEquals(r.baseSistemaADaOS({ funcionario_id: "ana", total: 400 }, [{ ...lB, servico_linha_id: "l2" }], rep), { valor: 200, conta: true });
  assertEquals(r.baseSistemaADaOS({ funcionario_id: "ana", total: 400 }, [{ ...lB, servico_linha_id: "l1" }, { ...lB, servico_linha_id: "l2" }], rep), { valor: 0, conta: false });
  assertEquals(r.baseSistemaADaOS({ funcionario_id: "ana", total: 200 }, [{ ...lB, servico_id: null }], [{ id: "b" }]), { valor: 0, conta: true });
});
