// deno test --no-check --no-lock scripts/testes-os-tecnicos/
// F0g: linha de "Técnicos por Serviço" incompleta (sem serviço, sem técnico ou
// com o serviço removido da OS) não vira registro em os_tecnicos.
// Lógica pura (src/lib/ordemServico/tecnicosPorServicoOS.ts); dados fictícios.
import { assertEquals } from "jsr:@std/assert@1";
import {
  montarLinhasTecnicosOS,
  situacaoLinhaTecnico,
  tecnicosParaGravar,
} from "../../src/lib/ordemServico/tecnicosPorServicoOS.ts";
import type { FormData, TecnicoOS } from "../../src/components/ordens/ordem-servico-wizard/tipos.ts";

type Servico = FormData["servicos"][number];
const servico = (id: string, nome: string, preco: number, extra: Partial<Servico> = {}): Servico => ({
  id, nome, preco, custo: 0, lucro: preco, quantidade: 1, created_at: "", user_id: "", custo_confirmado: true, ...extra,
} as Servico);

const TELA = servico("srv-tela", "Troca de tela", 300);
const BATERIA = servico("srv-bateria", "Troca de bateria", 150);
const SERVICOS = [TELA, BATERIA];

const COMPLETA: TecnicoOS = { funcionario_id: "func-a", descricao_servico: "Troca de tela", servico_id: "srv-tela" };
const SEM_SERVICO: TecnicoOS = { funcionario_id: "func-a", descricao_servico: "", servico_id: "" }; // "Adicionar" + técnico
const SEM_TECNICO: TecnicoOS = { funcionario_id: "", descricao_servico: "Troca de bateria", servico_id: "srv-bateria" };
const VAZIA: TecnicoOS = { funcionario_id: "", descricao_servico: "", servico_id: "" }; // "Adicionar" puro
// Serviço removido da lista de itens: a linha continua apontando para ele.
const SERVICO_REMOVIDO: TecnicoOS = { funcionario_id: "func-b", descricao_servico: "Película", servico_id: "srv-pelicula" };
// Gravada antes de existir a ligação com o serviço (servico_id null no banco).
const LEGADO: TecnicoOS = { funcionario_id: "func-b", descricao_servico: "Serviço antigo" };

Deno.test("situação de cada linha", () => {
  assertEquals(situacaoLinhaTecnico(COMPLETA, SERVICOS), "completa");
  assertEquals(situacaoLinhaTecnico(SEM_SERVICO, SERVICOS), "sem_servico");
  assertEquals(situacaoLinhaTecnico(SEM_TECNICO, SERVICOS), "sem_tecnico");
  assertEquals(situacaoLinhaTecnico(VAZIA, SERVICOS), "sem_servico");
  assertEquals(situacaoLinhaTecnico(SERVICO_REMOVIDO, SERVICOS), "servico_removido");
  assertEquals(situacaoLinhaTecnico(LEGADO, SERVICOS), "legado");
  // serviço removido E sem técnico: o destaque é o do serviço removido
  assertEquals(situacaoLinhaTecnico({ ...SERVICO_REMOVIDO, funcionario_id: "" }, SERVICOS), "servico_removido");
});

Deno.test("linha sem serviço é ignorada", () => {
  assertEquals(tecnicosParaGravar([SEM_SERVICO], SERVICOS), []);
});

Deno.test("linha sem técnico é ignorada", () => {
  assertEquals(tecnicosParaGravar([SEM_TECNICO], SERVICOS), []);
});

Deno.test("linha cujo serviço foi removido da OS é ignorada", () => {
  assertEquals(tecnicosParaGravar([SERVICO_REMOVIDO], SERVICOS), []);
  // ...e volta a valer se o mesmo serviço do catálogo for lançado de novo
  const comPelicula = [...SERVICOS, servico("srv-pelicula", "Película", 40)];
  assertEquals(tecnicosParaGravar([SERVICO_REMOVIDO], comPelicula), [SERVICO_REMOVIDO]);
});

Deno.test("linha completa é mantida (e a legada também, como sempre)", () => {
  assertEquals(tecnicosParaGravar([COMPLETA], SERVICOS), [COMPLETA]);
  assertEquals(tecnicosParaGravar([LEGADO], SERVICOS), [LEGADO]);
  // ordem preservada no meio de linhas vazias
  assertEquals(
    tecnicosParaGravar([VAZIA, COMPLETA, SEM_TECNICO, LEGADO, SERVICO_REMOVIDO], SERVICOS),
    [COMPLETA, LEGADO],
  );
});

Deno.test("serviço repetido: a linha (servico_linha_id) precisa existir", () => {
  const rep = [
    servico("srv-tela", "Troca de tela", 300, { linha_os: { linha_id: "l1" } } as Partial<Servico>),
    servico("srv-tela", "Troca de tela", 300, { linha_os: { linha_id: "l2" } } as Partial<Servico>),
  ];
  const naL2: TecnicoOS = { ...COMPLETA, servico_linha_id: "l2" };
  assertEquals(tecnicosParaGravar([naL2], rep), [naL2]);
  // a linha l2 foi removida (sobrou só a l1): não cai em outra linha
  assertEquals(tecnicosParaGravar([naL2], [rep[0]]), []);
});

Deno.test("lista só com linhas vazias resulta em zero registros", () => {
  const tecnicos = tecnicosParaGravar([VAZIA, SEM_SERVICO, SEM_TECNICO, SERVICO_REMOVIDO], SERVICOS);
  assertEquals(tecnicos, []);
  const { linhas } = montarLinhasTecnicosOS({
    osId: "os-1",
    tecnicos,
    servicosOS: SERVICOS,
    totalOS: 450,
    tipoServicoId: "tipo-geral",
    servicoIdsValidos: new Set(["srv-tela", "srv-bateria"]),
    tiposServicoTodos: [{ id: "tipo-geral", nome: "Geral" }],
    comissoesFuncionarios: [{ funcionario_id: "func-b", tipo_servico_id: "tipo-geral", comissao_tipo: "porcentagem", comissao_valor: 10 }],
    funcsCalculo: [{ id: "func-b", nome: "B", comissao_calculo: "faturamento" }],
    servicosCatalogoVinculo: [],
  });
  assertEquals(linhas, []);
});

Deno.test("regressão: sem o filtro, a linha do serviço removido ganhava comissão sobre o TOTAL da OS", () => {
  const entrada = {
    osId: "os-1",
    servicosOS: SERVICOS,
    totalOS: 450,
    tipoServicoId: "tipo-geral",
    servicoIdsValidos: new Set(["srv-tela", "srv-bateria"]),
    tiposServicoTodos: [{ id: "tipo-geral", nome: "Geral" }],
    comissoesFuncionarios: [{ funcionario_id: "func-b", tipo_servico_id: "tipo-geral", comissao_tipo: "porcentagem", comissao_valor: 10 }],
    funcsCalculo: [{ id: "func-b", nome: "B", comissao_calculo: "faturamento" }],
    servicosCatalogoVinculo: [],
  };
  const semFiltro = montarLinhasTecnicosOS({ ...entrada, tecnicos: [SERVICO_REMOVIDO] }).linhas;
  assertEquals(semFiltro.map((l) => [l.servico_id, l.comissao_calculada_snapshot]), [[null, 45]]);
  const comFiltro = montarLinhasTecnicosOS({ ...entrada, tecnicos: tecnicosParaGravar([SERVICO_REMOVIDO], SERVICOS) }).linhas;
  assertEquals(comFiltro, []);
});
