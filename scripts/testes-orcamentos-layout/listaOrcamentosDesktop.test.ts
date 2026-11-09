// TZ=UTC deno test --no-check scripts/testes-orcamentos-layout/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-orcamentos-layout/
// TZ=Asia/Tokyo deno test --no-check scripts/testes-orcamentos-layout/
// Dados totalmente fictícios. O resultado não pode depender do fuso da máquina.
import { assertEquals } from "jsr:@std/assert@1";
import {
  casaBusca,
  dataCurta,
  diaBrasilia,
  diasEntre,
  estaExpirado,
  filtrarOrcamentos,
  iniciaisCliente,
  OPCOES_POR_PAGINA,
  type OrcamentoDaLista,
  paginar,
  POR_PAGINA_PADRAO,
  resumoOrcamentos,
  statusEfetivo,
  textoCriacao,
  textoValidade,
  TODOS_OS_STATUS,
} from "../../src/lib/orcamentos/listaOrcamentosDesktop.ts";

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

// "Agora" fixo: 09/11/2026 15:00 de Brasília (18:00Z).
const AGORA = new Date("2026-11-09T18:00:00Z");

const o = (id: string, extra: Partial<OrcamentoDaLista> = {}): OrcamentoDaLista => ({
  id,
  numero_orcamento: `ORC-2026-${id.padStart(6, "0")}`,
  cliente_nome: null,
  cliente_telefone: null,
  status: "pendente",
  valor_total: 0,
  data_validade: null,
  created_at: "2026-11-01T15:00:00Z",
  ...extra,
});
const ids = (l: { id: string }[]) => l.map((x) => x.id).join(",");

// ---------- Status efetivo (mesma regra do selo de hoje) ----------

Deno.test("expirado = pendente com instante de validade no passado", () => {
  assertEquals(estaExpirado(o("1", { data_validade: "2026-11-09T17:59:59Z" }), AGORA), true);
  assertEquals(estaExpirado(o("1", { data_validade: "2026-11-09T18:00:00Z" }), AGORA), false); // mesmo instante: ainda não
  assertEquals(estaExpirado(o("1", { data_validade: "2026-11-09T18:00:01Z" }), AGORA), false);
  assertEquals(estaExpirado(o("1", { data_validade: null }), AGORA), false);
  assertEquals(estaExpirado(o("1", { data_validade: "lixo" }), AGORA), false);
});

Deno.test("só pendente expira; os outros status ficam como estão", () => {
  const passado = "2026-01-01T00:00:00Z";
  for (const status of ["aprovado", "rejeitado", "convertido", "expirado"] as const) {
    assertEquals(statusEfetivo(o("1", { status, data_validade: passado }), AGORA), status);
  }
  assertEquals(statusEfetivo(o("1", { status: "pendente", data_validade: passado }), AGORA), "expirado");
  assertEquals(statusEfetivo(o("1", { status: "pendente", data_validade: "2026-12-01T00:00:00Z" }), AGORA), "pendente");
});

Deno.test("vencimento no mesmo dia: selo vira Expirado na hora exata, texto continua 'Hoje'", () => {
  // Criado em 10/10 às 10:00 de Brasília com 30 dias: vence 09/11 às 10:00 de Brasília (13:00Z).
  const orc = o("1", { data_validade: "2026-11-09T13:00:00Z" });
  const as9 = new Date("2026-11-09T12:00:00Z"); // 09:00 de Brasília
  assertEquals(statusEfetivo(orc, as9), "pendente");
  assertEquals(textoValidade(orc.data_validade, as9), { tipo: "hoje" });
  assertEquals(statusEfetivo(orc, AGORA), "expirado"); // 15:00 de Brasília
  assertEquals(textoValidade(orc.data_validade, AGORA), { tipo: "hoje" });
  // Meia-noite e um de 10/11 em Brasília: já é "Vencido há 1 dia".
  assertEquals(textoValidade(orc.data_validade, new Date("2026-11-10T03:01:00Z")), { tipo: "vencido", dias: 1 });
  // 23:59 de 09/11 em Brasília (02:59Z do dia 10): ainda "Hoje".
  assertEquals(textoValidade(orc.data_validade, new Date("2026-11-10T02:59:00Z")), { tipo: "hoje" });
});

// ---------- Indicadores ----------

Deno.test("cartões: status do banco; Pendentes inclui vencidos; Valor Aprovado = aprovado + convertido em centavos", () => {
  const lista = [
    o("1", { status: "pendente", data_validade: "2026-01-01T00:00:00Z", valor_total: 690 }), // vencido, conta como pendente
    o("2", { status: "pendente", valor_total: 500 }),
    o("3", { status: "aprovado", valor_total: 0.1 }),
    o("4", { status: "convertido", valor_total: 0.2 }),
    o("5", { status: "rejeitado", valor_total: 999 }),
    o("6", { status: "expirado", valor_total: 50 }),
  ];
  assertEquals(resumoOrcamentos(lista), { total: 6, pendentes: 2, aprovados: 1, valorAprovado: 0.3 });
  assertEquals(resumoOrcamentos([]), { total: 0, pendentes: 0, aprovados: 0, valorAprovado: 0 });
});

// ---------- Busca ----------

const ernani = o("5", { cliente_nome: "Érnâni Cassiano", cliente_telefone: "19994429176" });
const formatado = o("6", { cliente_nome: "Luiz", cliente_telefone: "(19) 99713-9451" });

Deno.test("busca: número, nome sem acento/maiúscula e telefone", () => {
  assertEquals(casaBusca(ernani, ""), true);
  assertEquals(casaBusca(ernani, "   "), true);
  assertEquals(casaBusca(ernani, "orc-2026-000005"), true);
  assertEquals(casaBusca(ernani, "000005"), true);
  assertEquals(casaBusca(ernani, "ERNANI"), true);
  assertEquals(casaBusca(ernani, "ernani  cassiano"), true); // espaços colapsados
  assertEquals(casaBusca(ernani, "cassiano"), true);
  assertEquals(casaBusca(ernani, "99442"), true);
  assertEquals(casaBusca(ernani, "(19) 99442"), true); // pelos dígitos
  assertEquals(casaBusca(formatado, "19997139451"), true); // telefone gravado formatado
  assertEquals(casaBusca(formatado, "99713-9451"), true);
  assertEquals(casaBusca(ernani, "fernando"), false);
});

Deno.test("busca: texto com dígitos não casa telefone só pelos números", () => {
  // "Adriel 2" não pode achar todo telefone com "2".
  assertEquals(casaBusca(o("9", { cliente_nome: "Ana", cliente_telefone: "11922223333" }), "Adriel 2"), false);
  assertEquals(casaBusca(o("9", { cliente_telefone: null }), "123"), false);
});

// ---------- Filtros ----------

const lista: OrcamentoDaLista[] = [
  o("5", { status: "pendente", data_validade: "2026-10-28T15:00:00Z", created_at: "2026-09-28T15:00:00Z", cliente_nome: "Ernani" }),
  o("4", { status: "pendente", data_validade: "2026-12-08T15:00:00Z", created_at: "2026-11-08T15:00:00Z", cliente_nome: "Luiz" }),
  o("3", { status: "aprovado", created_at: "2026-11-01T02:30:00Z" }), // 31/10 23:30 em Brasília
  o("2", { status: "expirado", created_at: "2026-10-31T12:00:00Z", cliente_nome: "Adriel" }), // expirado gravado no banco
  o("1", { status: "convertido", created_at: "2026-01-02T12:00:00Z", cliente_nome: "Adriel" }),
];

Deno.test("filtro de status usa o status efetivo (pendente vencido entra em Expirado)", () => {
  assertEquals(ids(filtrarOrcamentos(lista, { status: "expirado" }, AGORA)), "5,2");
  assertEquals(ids(filtrarOrcamentos(lista, { status: "pendente" }, AGORA)), "4");
  assertEquals(ids(filtrarOrcamentos(lista, { status: "aprovado" }, AGORA)), "3");
  assertEquals(ids(filtrarOrcamentos(lista, { status: TODOS_OS_STATUS }, AGORA)), "5,4,3,2,1");
  assertEquals(ids(filtrarOrcamentos(lista, {}, AGORA)), "5,4,3,2,1"); // mantém a ordem do hook
});

Deno.test("período pela data de criação, em dias de Brasília (virada de dia)", () => {
  // O nº 3 foi criado em 01/11 02:30Z = 31/10 23:30 em Brasília: é de outubro.
  assertEquals(ids(filtrarOrcamentos(lista, { dataInicio: "2026-10-31", dataFim: "2026-10-31" }, AGORA)), "3,2");
  assertEquals(ids(filtrarOrcamentos(lista, { dataInicio: "2026-11-01", dataFim: "2026-11-30" }, AGORA)), "4");
  assertEquals(ids(filtrarOrcamentos(lista, { dataInicio: "2026-11-01" }, AGORA)), "4");
  assertEquals(ids(filtrarOrcamentos(lista, { dataFim: "2026-01-02" }, AGORA)), "1");
  assertEquals(ids(filtrarOrcamentos(lista, { dataInicio: "", dataFim: null }, AGORA)), "5,4,3,2,1");
  assertEquals(ids(filtrarOrcamentos(lista, { dataInicio: "2026-12-01", dataFim: "2026-01-01" }, AGORA)), ""); // invertido = vazio
  assertEquals(ids(filtrarOrcamentos(lista, { dataInicio: "2026-13" }, AGORA)), "5,4,3,2,1"); // data incompleta = sem limite
});

Deno.test("limites do dia: 00:00:00.000 e 23:59:59.999 de Brasília entram", () => {
  const borda = [
    o("a", { created_at: "2026-11-05T03:00:00.000Z" }), // 05/11 00:00:00.000 BRT
    o("b", { created_at: "2026-11-06T02:59:59.999Z" }), // 05/11 23:59:59.999 BRT
    o("c", { created_at: "2026-11-05T02:59:59.999Z" }), // 04/11 23:59:59.999 BRT
    o("d", { created_at: "2026-11-06T03:00:00.000Z" }), // 06/11 00:00 BRT
  ];
  assertEquals(ids(filtrarOrcamentos(borda, { dataInicio: "2026-11-05", dataFim: "2026-11-05" }, AGORA)), "a,b");
});

Deno.test("filtros combinados (E)", () => {
  assertEquals(ids(filtrarOrcamentos(lista, { busca: "adriel", status: "convertido" }, AGORA)), "1");
  assertEquals(ids(filtrarOrcamentos(lista, { busca: "adriel", dataInicio: "2026-10-01" }, AGORA)), "2");
  assertEquals(ids(filtrarOrcamentos(lista, { busca: "ernani", status: "pendente" }, AGORA)), "");
});

// ---------- Datas e textos de tempo ----------

Deno.test("dia de Brasília e data curta (virada de dia)", () => {
  assertEquals(diaBrasilia("2026-11-01T02:30:00Z"), "2026-10-31");
  assertEquals(diaBrasilia("2026-11-01T03:00:00Z"), "2026-11-01");
  assertEquals(diaBrasilia(null), null);
  assertEquals(diaBrasilia("lixo"), null);
  assertEquals(dataCurta("2026-10-31"), "31/10/2026");
  assertEquals(diasEntre("2026-10-31", "2026-11-01"), 1);
  assertEquals(diasEntre("2026-02-28", "2026-03-01"), 1);
  assertEquals(diasEntre("2026-11-09", "2026-01-01"), -312);
});

Deno.test("texto da validade: Vencido há N dias / Hoje / Em N dias", () => {
  assertEquals(textoValidade("2026-10-28T15:00:00Z", AGORA), { tipo: "vencido", dias: 12 });
  assertEquals(textoValidade("2026-11-08T15:00:00Z", AGORA), { tipo: "vencido", dias: 1 });
  assertEquals(textoValidade("2026-11-09T23:00:00Z", AGORA), { tipo: "hoje" });
  assertEquals(textoValidade("2026-11-10T15:00:00Z", AGORA), { tipo: "em", dias: 1 });
  assertEquals(textoValidade("2026-12-09T15:00:00Z", AGORA), { tipo: "em", dias: 30 });
  assertEquals(textoValidade(null, AGORA), null);
});

Deno.test("texto da validade NÃO usa a data de criação (conta errada do mockup)", () => {
  // Mockup: criado 28/09, validade 28/10, mostrava "Em 30 dias" mesmo vencido.
  const orc = lista[0];
  assertEquals(textoValidade(orc.data_validade, AGORA), { tipo: "vencido", dias: 12 });
});

Deno.test("validade à noite em Brasília: o dia é o de Brasília, não o UTC", () => {
  // 09/11 22:00 BRT = 10/11 01:00Z. Agora = 09/11 15:00 BRT → "Hoje", não "Em 1 dia".
  assertEquals(textoValidade("2026-11-10T01:00:00Z", AGORA), { tipo: "hoje" });
});

Deno.test("texto da criação: Hoje / Há N dias, em dias de Brasília", () => {
  assertEquals(textoCriacao("2026-11-09T03:00:00Z", AGORA), { tipo: "hoje" }); // 00:00 BRT de hoje
  assertEquals(textoCriacao("2026-11-09T02:59:00Z", AGORA), { tipo: "ha", dias: 1 }); // 23:59 BRT de ontem
  assertEquals(textoCriacao("2026-09-28T15:00:00Z", AGORA), { tipo: "ha", dias: 42 });
  assertEquals(textoCriacao("2026-11-12T15:00:00Z", AGORA), { tipo: "hoje" }); // "no futuro" = hoje
  assertEquals(textoCriacao("lixo", AGORA), null);
});

// ---------- Avatar ----------

Deno.test("iniciais do cliente", () => {
  assertEquals(iniciaisCliente("Ernani Cassiano"), "EC");
  assertEquals(iniciaisCliente("  luiz   fernando  da silva "), "LF");
  assertEquals(iniciaisCliente("Adriel"), "A");
  assertEquals(iniciaisCliente("Érico Ávila"), "ÉÁ");
  assertEquals(iniciaisCliente("- Maria"), "M");
  assertEquals(iniciaisCliente("-"), "");
  assertEquals(iniciaisCliente(""), "");
  assertEquals(iniciaisCliente(null), "");
});

// ---------- Paginação (mesma de Serviços) ----------

Deno.test("paginação 20 por padrão, opções 10/20/50", () => {
  assertEquals(POR_PAGINA_PADRAO, 20);
  assertEquals([...OPCOES_POR_PAGINA], [10, 20, 50]);
  const muitos = Array.from({ length: 45 }, (_, i) => o(String(i + 1)));
  const p3 = paginar(muitos, 3, 20);
  assertEquals([p3.pagina, p3.totalPaginas, p3.inicio, p3.fim, p3.total], [3, 3, 41, 45, 45]);
  const alem = paginar(muitos, 9, 20); // filtro encolheu a lista: fica na última
  assertEquals(alem.pagina, 3);
  const vazio = paginar([], 1, 20);
  assertEquals([vazio.inicio, vazio.fim, vazio.total, vazio.totalPaginas], [0, 0, 0, 1]);
});
