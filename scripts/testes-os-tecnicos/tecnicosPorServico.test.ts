// deno test --no-check --no-lock scripts/testes-os-tecnicos/
// F0 da OS com vários técnicos: ao REABRIR a OS, os "Técnicos por Serviço"
// voltam ligados ao serviço (servico_id / servico_linha_id) e salvar de novo
// sem mudar nada grava os MESMOS snapshots de comissão.
// Lógica pura (src/lib/ordemServico/tecnicosPorServicoOS.ts); dados fictícios;
// nada vai à rede nem ao banco.
import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import {
  type EntradaMontarTecnicosOS,
  type LinhaOsTecnicoBanco,
  entradaComissaoServico,
  montarLinhasTecnicosOS,
  tecnicoOSDoBanco,
} from "../../src/lib/ordemServico/tecnicosPorServicoOS.ts";
import type { TecnicoOS } from "../../src/components/ordens/ordem-servico-wizard/tipos.ts";

// ---------------------------------------------------------------------------
// Referência: o carregamento de ANTES da correção (origin/main c4e14d5,
// useOrdemServicoWizardState.ts), copiado literalmente.
// deno-lint-ignore no-explicit-any
function carregamentoAntigo(t: any): TecnicoOS {
  return {
    funcionario_id: t.funcionario_id,
    descricao_servico: t.descricao_servico || "",
    ...(t.servico_linha_id ? { servico_linha_id: t.servico_linha_id } : {}),
  };
}

// "Banco" falso: o que o insert de os_tecnicos devolve num select("*")
// depois (colunas ausentes no insert viram null; id/created_at do banco).
type LinhaGravada = ReturnType<typeof montarLinhasTecnicosOS>["linhas"][number];
function gravarNoBanco(linhas: LinhaGravada[], comColunaLinha = true): (LinhaOsTecnicoBanco & Record<string, unknown>)[] {
  return linhas.map((l, i) => {
    const linha: Record<string, unknown> = {
      id: `ot-${i + 1}`,
      created_at: "2026-11-23T12:00:00Z",
      os_id: l.os_id,
      funcionario_id: l.funcionario_id,
      descricao_servico: l.descricao_servico ?? null,
      servico_id: l.servico_id ?? null,
      servico_nome_snapshot: l.servico_nome_snapshot ?? null,
      preco_servico_snapshot: l.preco_servico_snapshot ?? null,
      comissao_tipo_snapshot: l.comissao_tipo_snapshot ?? null,
      comissao_valor_snapshot: l.comissao_valor_snapshot ?? null,
      comissao_calculada_snapshot: l.comissao_calculada_snapshot ?? null,
    };
    if (comColunaLinha) linha.servico_linha_id = l.servico_linha_id ?? null;
    return linha as LinhaOsTecnicoBanco & Record<string, unknown>;
  });
}

// ---------------------------------------------------------------------------
// Cenário fictício: OS com 4 linhas de serviço (uma repetida 2x com linha_id,
// uma manual) e 2 técnicos; tipo da OS com comissão própria (o "cálculo antigo").
const FUNC_A = "func-a";
const FUNC_B = "func-b";
const TIPO_TELA = "tipo-tela";
const TIPO_BATERIA = "tipo-bateria";
const TIPO_DA_OS = "tipo-geral";

function servico(id: string, nome: string, preco: number, custo: number, extra: Record<string, unknown> = {}) {
  return { id, nome, preco, custo, lucro: preco - custo, quantidade: 1, created_at: "", ...extra } as EntradaMontarTecnicosOS["servicosOS"][number];
}

const servicosOS: EntradaMontarTecnicosOS["servicosOS"] = [
  servico("srv-tela", "Troca de tela", 300, 120, { custo_confirmado: true }),
  servico("srv-bateria", "Troca de bateria", 150, 60, { custo_confirmado: true, linha_os: { linha_id: "lin-bat-1", quantidade: 1 } }),
  servico("srv-bateria", "Troca de bateria", 450, 180, { custo_confirmado: true, linha_os: { linha_id: "lin-bat-2", quantidade: 3, preco_unitario: 150, custo_unitario: 60 } }),
  servico("manual_123", "Limpeza", 50, 0),
];
const totalOS = 950;

const base: Omit<EntradaMontarTecnicosOS, "tecnicos" | "servicosOS"> = {
  osId: "os-1",
  totalOS,
  tipoServicoId: TIPO_DA_OS,
  dispositivoMarca: "Samsung",
  servicoIdsValidos: new Set(["srv-tela", "srv-bateria"]),
  tiposServicoTodos: [
    { id: TIPO_TELA, nome: "Troca de tela" },
    { id: TIPO_BATERIA, nome: "Troca de bateria" },
    { id: TIPO_DA_OS, nome: "Geral" },
    { id: "tipo-limpeza", nome: "Limpeza" },
  ],
  comissoesFuncionarios: [
    { funcionario_id: FUNC_A, tipo_servico_id: TIPO_TELA, comissao_tipo: "porcentagem", comissao_valor: 10 },
    { funcionario_id: FUNC_A, tipo_servico_id: TIPO_DA_OS, comissao_tipo: "porcentagem", comissao_valor: 5 },
    { funcionario_id: FUNC_A, tipo_servico_id: "tipo-limpeza", comissao_tipo: "valor", comissao_valor: 7 },
    { funcionario_id: FUNC_B, tipo_servico_id: TIPO_BATERIA, comissao_tipo: "valor", comissao_valor: 20 },
    { funcionario_id: FUNC_B, tipo_servico_id: TIPO_DA_OS, comissao_tipo: "porcentagem", comissao_valor: 8 },
  ],
  funcsCalculo: [
    { id: FUNC_A, nome: "Técnico A", comissao_calculo: "faturamento" },
    { id: FUNC_B, nome: "Técnico B", comissao_calculo: "lucro" },
  ],
  servicosCatalogoVinculo: [
    { id: "srv-tela", tipo_servico_id: TIPO_TELA },
    { id: "srv-bateria", tipo_servico_id: TIPO_BATERIA },
  ],
};

// O que a tela "Técnicos por Serviço" monta ao CRIAR a OS (EtapaServicosProdutos).
const tecnicosCriacao: TecnicoOS[] = [
  { funcionario_id: FUNC_A, descricao_servico: "Troca de tela", servico_id: "srv-tela" },
  { funcionario_id: FUNC_B, descricao_servico: "Troca de bateria", servico_id: "srv-bateria", servico_linha_id: "lin-bat-1" },
  { funcionario_id: FUNC_B, descricao_servico: "Troca de bateria", servico_id: "srv-bateria", servico_linha_id: "lin-bat-2" },
  { funcionario_id: FUNC_A, descricao_servico: "Limpeza", servico_id: "manual_123" },
];

const montar = (tecnicos: TecnicoOS[]) => montarLinhasTecnicosOS({ ...base, servicosOS, tecnicos });
const snapshots = (linhas: LinhaGravada[]) =>
  linhas.map((l) => [l.funcionario_id, l.servico_id ?? null, l.servico_linha_id ?? null, l.comissao_calculada_snapshot ?? null]);

// ---------------------------------------------------------------------------
Deno.test("carregamento: servico_id e servico_linha_id voltam do banco", () => {
  assertEquals(
    tecnicoOSDoBanco({ funcionario_id: FUNC_B, descricao_servico: "Troca de bateria", servico_id: "srv-bateria", servico_linha_id: "lin-bat-2" }),
    { funcionario_id: FUNC_B, descricao_servico: "Troca de bateria", servico_id: "srv-bateria", servico_linha_id: "lin-bat-2" },
  );
  assertEquals(
    tecnicoOSDoBanco({ funcionario_id: FUNC_A, descricao_servico: "Troca de tela", servico_id: "srv-tela", servico_linha_id: null }),
    { funcionario_id: FUNC_A, descricao_servico: "Troca de tela", servico_id: "srv-tela" },
  );
  // Banco sem a coluna servico_linha_id (migration antiga não aplicada).
  assertEquals(
    tecnicoOSDoBanco({ funcionario_id: FUNC_A, descricao_servico: null, servico_id: "manual_123" }),
    { funcionario_id: FUNC_A, descricao_servico: "", servico_id: "manual_123" },
  );
});

Deno.test("carregamento: linha SEM serviço ligado sai igual ao carregamento antigo", () => {
  const linhas = [
    { funcionario_id: FUNC_A, descricao_servico: "Serviço antigo", servico_id: null, servico_linha_id: null },
    { funcionario_id: FUNC_B, descricao_servico: null, servico_id: null },
    { funcionario_id: FUNC_B, descricao_servico: "", servico_id: null, servico_linha_id: "lin-x" },
  ];
  for (const l of linhas) {
    const novo = tecnicoOSDoBanco(l);
    assertEquals(novo, carregamentoAntigo(l));
    assertEquals(Object.keys(novo), Object.keys(carregamentoAntigo(l)));
  }
});

Deno.test("abrir -> salvar sem mudar nada: mesmos snapshots de comissão", () => {
  const criacao = montar(tecnicosCriacao);
  // Sanidade do cenário: cada técnico com a comissão do SEU serviço.
  assertEquals(snapshots(criacao.linhas), [
    [FUNC_A, "srv-tela", null, 30], // 10% de 300
    [FUNC_B, "srv-bateria", "lin-bat-1", 20], // valor fixo 20 x1
    [FUNC_B, "srv-bateria", "lin-bat-2", 60], // valor fixo 20 x3
    [FUNC_A, "manual_123", null, 7], // valor fixo 7 (por nome)
  ]);

  for (const comColunaLinha of [true, false]) {
    let banco = gravarNoBanco(criacao.linhas, comColunaLinha);
    // Três ciclos seguidos de abrir -> salvar.
    for (let ciclo = 0; ciclo < 3; ciclo++) {
      const reaberto = montar(banco.map(tecnicoOSDoBanco));
      if (comColunaLinha) {
        assertEquals(reaberto.linhas, criacao.linhas);
      } else {
        // Sem a coluna no banco a linha repetida só pode casar pelo servico_id
        // (1ª linha do serviço): é o limite já existente sem a migration.
        assertEquals(reaberto.linhas[0], criacao.linhas[0]);
        assertEquals(reaberto.linhas[3], criacao.linhas[3]);
      }
      banco = gravarNoBanco(reaberto.linhas, comColunaLinha);
    }
  }
  assertEquals(criacao.itensComissaoAmbigua, []);
  assertEquals(criacao.itensCustoNaoConfirmado, []);
});

Deno.test("regressão: o carregamento antigo mudava a comissão ao salvar de novo", () => {
  const criacao = montar(tecnicosCriacao);
  const banco = gravarNoBanco(criacao.linhas);
  const comAntigo = montar(banco.map(carregamentoAntigo));
  // Tela: sem o serviço, caía em tipo da OS (5%) × total da OS (950) = 47,5.
  assertEquals(comAntigo.linhas[0].comissao_calculada_snapshot, 47.5);
  assertEquals(comAntigo.linhas[0].servico_id, null);
  assertNotEquals(snapshots(comAntigo.linhas), snapshots(criacao.linhas));
});

Deno.test("linha legada sem serviço (servico_id null): mesma gravação com o carregamento novo e o antigo", () => {
  const legado = gravarNoBanco([
    { os_id: "os-1", funcionario_id: FUNC_A, descricao_servico: "Serviço antigo", servico_id: null, comissao_calculada_snapshot: 47.5 },
    { os_id: "os-1", funcionario_id: FUNC_B, descricao_servico: null, servico_id: null, comissao_calculada_snapshot: 76 },
  ]);
  const novo = montar(legado.map(tecnicoOSDoBanco));
  const antigo = montar(legado.map(carregamentoAntigo));
  assertEquals(novo, antigo);
  // E o valor é o do cálculo antigo, como hoje (dados existentes não mudam).
  assertEquals(snapshots(novo.linhas), [[FUNC_A, null, null, 47.5], [FUNC_B, null, null, 76]]);
});

Deno.test("OS sem técnicos por serviço: nada a gravar, carregamento vazio", () => {
  assertEquals(montar([]), { linhas: [], itensCustoNaoConfirmado: [], itensComissaoAmbigua: [] });
  assertEquals([].map(tecnicoOSDoBanco), []);
});

Deno.test("entradaComissaoServico (movida sem mudança, usada pelo Técnico Principal)", () => {
  assertEquals(entradaComissaoServico(servicosOS[0]), { preco: 300, custo: 120, custoConfirmado: true, quantidade: 1 });
  assertEquals(entradaComissaoServico(servicosOS[2]), { preco: 450, custo: 180, custoConfirmado: true, quantidade: 3 });
  assertEquals(
    entradaComissaoServico(servico("s", "Tela c/ peça", 100, 80, { peca_repassada: true, peca_valor: 80 })),
    { preco: 100, custo: 0, custoConfirmado: true, quantidade: 1 },
  );
  assertEquals(
    entradaComissaoServico(servico("s", "Tela", 300, 0, { peca_valor: 90 })),
    { preco: 300, custo: 90, custoConfirmado: undefined, quantidade: 1 },
  );
});
