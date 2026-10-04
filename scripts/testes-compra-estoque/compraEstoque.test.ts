// deno test --no-check scripts/testes-compra-estoque/
// Roda as funções reais de src/lib/financeiro/despesasOperacionais.ts e
// src/lib/estoque/custoMedio.ts. Os filtros antigos de useRelatorios.ts estão
// copiados aqui literalmente, como referência: o hook depende do client do
// Supabase e não roda no Deno.
import { assertEquals } from "jsr:@std/assert@1";
import { ehDespesaOperacional } from "../../src/lib/financeiro/despesasOperacionais.ts";
import { calcularCustoMedio } from "../../src/lib/estoque/custoMedio.ts";

type Conta = {
  nome?: string | null;
  descricao?: string | null;
  categoria?: string | null;
  os_numero?: string | null;
  tipo?: "pagar" | "receber";
  status?: "pendente" | "pago" | "recebido";
  valor?: number;
  data?: string;
  compra_estoque?: boolean | null;
};

// ---------------------------------------------------------------------------
// Referência: código ANTES desta mudança (useRelatorios.ts)
// ---------------------------------------------------------------------------

// calcularCustosOperacionais — filtro JS antigo (cópia literal)
function filtroAntigoCustos(conta: Conta): boolean {
  const nome = String(conta.nome || "");
  const descricao = String(conta.descricao || "");

  const vinculadaOS = Boolean(conta.os_numero);
  const pecaPorNome = /^peça\s*:/i.test(nome);
  const pecaPorDescricao = /utilizada no servi[çc]o/i.test(descricao);
  const pecaPorPadraoOS = /\(OS\s*\d+/i.test(nome) && /peça/i.test(nome);

  return !(vinculadaOS || pecaPorNome || pecaPorDescricao || pecaPorPadraoOS);
}

// calcularEvolucaoMensal — filtro JS antigo (cópia literal)
function filtroAntigoEvolucao(conta: Conta): boolean {
  const nome = String(conta.nome || "");
  const descricao = String(conta.descricao || "");
  const pecaPorNome = /^peça\s*:/i.test(nome);
  const pecaPorDescricao = /utilizada no servi[çc]o/i.test(descricao);
  const pecaPorPadraoOS = /\(OS\s*\d+/i.test(nome) && /peça/i.test(nome);
  return !(pecaPorNome || pecaPorDescricao || pecaPorPadraoOS);
}

// Predicado da consulta ao banco (igual nas duas funções):
// .eq("tipo","pagar").eq("status","pago").neq("categoria","Taxa de Cartão").is("os_numero", null)
// Atenção à semântica SQL do neq: categoria NULL não passa (NULL <> 'x' é NULL).
function passaNaConsulta(conta: Conta): boolean {
  return conta.tipo === "pagar"
    && conta.status === "pago"
    && conta.categoria != null
    && conta.categoria !== "Taxa de Cartão"
    && conta.os_numero == null;
}

// Pipeline completo do custo operacional, como o hook faz: consulta + filtro JS + soma.
function custoOperacional(contas: Conta[], filtro: (c: Conta) => boolean): number {
  return contas.filter(passaNaConsulta).filter(filtro).reduce((s, c) => s + Number(c.valor || 0), 0);
}

// Agrupamento mensal de calcularEvolucaoMensal (cópia da lógica: mês de conta.data).
function custoPorMes(contas: Conta[], filtro: (c: Conta) => boolean): Record<string, number> {
  const mapa: Record<string, number> = {};
  contas.filter(passaNaConsulta).filter(filtro).forEach((conta) => {
    const data = new Date(conta.data!);
    const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    mapa[mes] = (mapa[mes] || 0) + Number(conta.valor || 0);
  });
  return mapa;
}

// ---------------------------------------------------------------------------
// Fixtures: contas a pagar de vários formatos
// ---------------------------------------------------------------------------
const base: Conta[] = [
  { nome: "Aluguel", categoria: "Aluguel", tipo: "pagar", status: "pago", valor: 200 },
  { nome: "Compra peças", categoria: "Fornecedores", tipo: "pagar", status: "pago", valor: 300 },
  { nome: "Maquininha", categoria: "Taxa de Cartão", tipo: "pagar", status: "pago", valor: 12 },
  { nome: "Peça: Tela A10 (OS 12)", categoria: "Fornecedores", os_numero: "12", tipo: "pagar", status: "pago", valor: 90 },
  { nome: "Peça: Bateria", categoria: "Fornecedores", tipo: "pagar", status: "pago", valor: 50 },
  { nome: "Tela iPhone (OS 34) peça", categoria: "Fornecedores", tipo: "pagar", status: "pago", valor: 70 },
  { nome: "Conector", descricao: 'Peça "Conector" utilizada no serviço "Troca" - OS 9', categoria: "Fornecedores", tipo: "pagar", status: "pago", valor: 40 },
  { nome: "Conector 2", descricao: "utilizada no servico de troca", categoria: "Outros", tipo: "pagar", status: "pago", valor: 41 },
  { nome: "Internet", categoria: "Internet", tipo: "pagar", status: "pendente", valor: 100 },
  { nome: "Sem categoria", categoria: null, tipo: "pagar", status: "pago", valor: 33 },
  { nome: null, descricao: null, categoria: "Outros", tipo: "pagar", status: "pago", valor: 7 },
  { nome: "Recebimento", categoria: "Outros", tipo: "receber", status: "recebido", valor: 500 },
];

// Cada conta em três formatos "sem marca": campo ausente, false e null.
function semMarca(contas: Conta[]): Conta[] {
  return contas.flatMap((c) => {
    const { compra_estoque: _ignorado, ...ausente } = c;
    return [ausente, { ...c, compra_estoque: false }, { ...c, compra_estoque: null }];
  });
}

// ---------------------------------------------------------------------------
// (1) Sem a marca, nada muda
// ---------------------------------------------------------------------------
Deno.test("sem marca: conta a conta, pipeline novo = pipeline antigo (custos e evolução)", () => {
  for (const conta of semMarca(base)) {
    const novo = passaNaConsulta(conta) && ehDespesaOperacional(conta);
    assertEquals(novo, passaNaConsulta(conta) && filtroAntigoCustos(conta), `custos: ${JSON.stringify(conta)}`);
    assertEquals(novo, passaNaConsulta(conta) && filtroAntigoEvolucao(conta), `evolução: ${JSON.stringify(conta)}`);
  }
});

Deno.test("sem marca: função isolada = filtro antigo + exclusão de Taxa de Cartão", () => {
  for (const conta of semMarca(base)) {
    assertEquals(
      ehDespesaOperacional(conta),
      filtroAntigoCustos(conta) && conta.categoria !== "Taxa de Cartão",
      JSON.stringify(conta),
    );
  }
});

Deno.test("sem marca: totais idênticos aos antigos", () => {
  const contas = semMarca(base);
  assertEquals(custoOperacional(contas, ehDespesaOperacional), custoOperacional(contas, filtroAntigoCustos));
  assertEquals(custoOperacional(contas, ehDespesaOperacional), custoOperacional(contas, filtroAntigoEvolucao));
  // Aluguel 200 + Fornecedores 300 + Outros sem nome 7, cada um 3× (ausente/false/null)
  assertEquals(custoOperacional(contas, ehDespesaOperacional), (200 + 300 + 7) * 3);
});

Deno.test("continuam excluídos: Taxa de Cartão, os_numero, 'Peça: X (OS 12)', 'utilizada no serviço'", () => {
  assertEquals(ehDespesaOperacional({ nome: "Maquininha", categoria: "Taxa de Cartão" }), false);
  assertEquals(ehDespesaOperacional({ nome: "Qualquer", categoria: "Outros", os_numero: "12" }), false);
  assertEquals(ehDespesaOperacional({ nome: "Peça: X (OS 12)", categoria: "Fornecedores" }), false);
  assertEquals(ehDespesaOperacional({ nome: "Peça: X", categoria: "Fornecedores" }), false);
  assertEquals(ehDespesaOperacional({ nome: "Tela (OS 7) peça", categoria: "Fornecedores" }), false);
  assertEquals(ehDespesaOperacional({ nome: "Conector", descricao: "Peça utilizada no serviço Troca", categoria: "Fornecedores" }), false);
  assertEquals(ehDespesaOperacional({ nome: "Conector", descricao: "utilizada no servico", categoria: "Fornecedores" }), false);
});

Deno.test("'Fornecedores' sem marca continua sendo despesa", () => {
  assertEquals(ehDespesaOperacional({ nome: "Compra de telas", categoria: "Fornecedores" }), true);
  assertEquals(ehDespesaOperacional({ nome: "Compra de telas", categoria: "Fornecedores", compra_estoque: false }), true);
  assertEquals(ehDespesaOperacional({ nome: "Compra de telas", categoria: "Fornecedores", compra_estoque: null }), true);
});

// ---------------------------------------------------------------------------
// (2) Com a marca, o lucro líquido não abate
// ---------------------------------------------------------------------------
const cenario: Conta[] = [
  { nome: "Aluguel", categoria: "Aluguel", tipo: "pagar", status: "pago", valor: 200, data: "2026-10-05T12:00:00" },
  { nome: "Compra de mercadoria: Capinha (50 un.)", categoria: "Compra de Mercadoria", tipo: "pagar", status: "pago", valor: 500, data: "2026-10-06T12:00:00", compra_estoque: true },
  { nome: "Compra de mercadoria: Película (30 un.)", categoria: "Compra de Mercadoria", tipo: "pagar", status: "pendente", valor: 300, data: "2026-10-07T12:00:00", compra_estoque: true },
];

// Mesma conta de calcularResumo: lucroLiquido = (receita − custo das vendas) − custo operacional.
function lucroLiquido(receita: number, custoVendas: number, contas: Conta[], filtro: (c: Conta) => boolean) {
  const operacional = custoOperacional(contas, filtro);
  return { operacional, lucroLiquido: receita - custoVendas - operacional };
}

Deno.test("com marca: receita 1000, custo vendas 400, aluguel 200, compra 500 marcada → operacional 200, líquido 400", () => {
  assertEquals(lucroLiquido(1000, 400, cenario, ehDespesaOperacional), { operacional: 200, lucroLiquido: 400 });
});

Deno.test("referência: o mesmo cenário SEM a marca contava a compra duas vezes (operacional 700, líquido −100)", () => {
  const semAMarca = cenario.map(({ compra_estoque: _ignorado, ...c }) => c);
  assertEquals(lucroLiquido(1000, 400, semAMarca, ehDespesaOperacional), { operacional: 700, lucroLiquido: -100 });
});

Deno.test("conta marcada e pendente fica fora (e continuaria fora mesmo sem marca, por ser pendente)", () => {
  const pendente = cenario[2];
  assertEquals(passaNaConsulta(pendente), false);
  assertEquals(ehDespesaOperacional(pendente), false);
});

Deno.test("evolução mensal não soma a conta marcada", () => {
  assertEquals(custoPorMes(cenario, ehDespesaOperacional), { "2026-10": 200 });
});

// ---------------------------------------------------------------------------
// Custo médio (espelho da RPC registrar_entrada_estoque)
// ---------------------------------------------------------------------------
Deno.test("custo médio: 5×100 + 5×120 = 110", () => {
  assertEquals(calcularCustoMedio(5, 100, 5, 120), 110);
});

Deno.test("custo médio: sem custo anterior (null/undefined) usa o custo novo", () => {
  assertEquals(calcularCustoMedio(5, null, 5, 120), 120);
  assertEquals(calcularCustoMedio(5, undefined, 5, 120), 120);
});

Deno.test("custo médio: custo anterior zero usa o custo novo", () => {
  assertEquals(calcularCustoMedio(5, 0, 5, 120), 120);
});

Deno.test("custo médio: quantidade anterior zero ou negativa usa o custo novo", () => {
  assertEquals(calcularCustoMedio(0, 100, 5, 120), 120);
  assertEquals(calcularCustoMedio(-3, 100, 5, 120), 120);
});

Deno.test("custo médio: arredondamento a 2 casas (meio para cima, sem erro de float)", () => {
  assertEquals(calcularCustoMedio(2, 1, 1, 2), 1.33);         // 4/3 = 1,3333…
  assertEquals(calcularCustoMedio(1, 2, 2, 1), 1.33);         // 4/3
  assertEquals(calcularCustoMedio(1, 1, 2, 2), 1.67);         // 5/3 = 1,6666…
  assertEquals(calcularCustoMedio(1, 1.0, 1, 1.01), 1.01);    // 1,005 → 1,01 (float puro daria 1,00)
  assertEquals(calcularCustoMedio(3, 10, 1, 10.01), 10);      // 10,0025 → 10,00
  assertEquals(calcularCustoMedio(1, 0.01, 2, 0.02), 0.02);   // 0,01666… → 0,02
  assertEquals(calcularCustoMedio(7, 33.33, 3, 19.99), 29.33); // (233,31 + 59,97)/10 = 29,328
});

Deno.test("custo médio: custo novo é arredondado a 2 casas antes do cálculo", () => {
  assertEquals(calcularCustoMedio(0, null, 1, 12.344), 12.34);
  assertEquals(calcularCustoMedio(0, null, 1, 12.346), 12.35);
});
