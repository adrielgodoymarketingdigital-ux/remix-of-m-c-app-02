/**
 * "Técnicos por Serviço" da OS (tabela os_tecnicos) — lógica pura, sem banco.
 *
 * - tecnicoOSDoBanco: linha de os_tecnicos → item do formulário ao REABRIR a
 *   OS. Devolve também o serviço ligado (servico_id e servico_linha_id), para
 *   que salvar de novo calcule a comissão sobre o MESMO serviço (antes a
 *   ligação se perdia e a comissão caía no cálculo antigo: tipo da OS × total).
 * - montarLinhasTecnicosOS: o cálculo das linhas a gravar, movido sem mudança
 *   de regra de salvarTecnicosOS (handleSubmitOrdemServico.ts), que continua
 *   fazendo as consultas e a gravação.
 * - entradaComissaoServico: entrada da comissão de um serviço (movida de
 *   handleSubmitOrdemServico.ts sem mudança; usada também pelo Técnico Principal).
 */
import type { TablesInsert } from "../../integrations/supabase/types";
import type { FormData, TecnicoOS } from "../../components/ordens/ordem-servico-wizard/tipos";
import {
  type CandidatoAmbiguo,
  type ComissaoCalculo,
  type ComissaoConfig,
  type TipoServicoResumo,
  calcularComissaoDoItem,
  resolverComissaoDoServico,
} from "./comissaoPorTipoServico";
import { quantidadeLinhaForm } from "./linhaServicoOS";
import { linhaComComissaoConfigurada } from "../comissao/comissaoOsDoSnapshot";

/**
 * Entrada da comissão de um serviço. Com peça repassada ao cliente pelo custo,
 * a base é só a mão de obra (preço), em qualquer modo — a peça não gera
 * comissão nem reduz o lucro da linha. Sem repasse: preço − custo, como antes.
 */
export function entradaComissaoServico(servico: FormData["servicos"][number]): { preco: number; custo: number; custoConfirmado?: boolean; quantidade: number } {
  // preco/custo são o total da linha; a quantidade só pesa na comissão de valor fixo.
  const quantidade = quantidadeLinhaForm(servico);
  if (servico.peca_repassada) {
    return { preco: Number(servico.preco) || 0, custo: 0, custoConfirmado: true, quantidade };
  }
  return {
    preco: servico.preco,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    custo: (servico as any).peca_valor ?? servico.custo,
    custoConfirmado: servico.custo_confirmado,
    quantidade,
  };
}

/** Colunas de os_tecnicos que o carregamento da OS usa. */
export interface LinhaOsTecnicoBanco {
  funcionario_id: string;
  descricao_servico: string | null;
  servico_id?: string | null;
  /** Só existe depois da migration 20261025120000 — por isso opcional. */
  servico_linha_id?: string | null;
}

/**
 * Linha de os_tecnicos → item do formulário. Sem serviço ligado no banco, o
 * item sai exatamente como antes ({ funcionario_id, descricao_servico }).
 */
export function tecnicoOSDoBanco(linha: LinhaOsTecnicoBanco): TecnicoOS {
  return {
    funcionario_id: linha.funcionario_id,
    descricao_servico: linha.descricao_servico || "",
    ...(linha.servico_id ? { servico_id: linha.servico_id } : {}),
    // Só técnico ligado a uma linha repetida/com quantidade traz isto.
    ...(linha.servico_linha_id ? { servico_linha_id: linha.servico_linha_id } : {}),
  };
}

/**
 * Posição (em servicosOS) do serviço ligado ao técnico, ou -1. Com o mesmo
 * serviço repetido, a linha (servico_linha_id) decide qual delas; senão vale o
 * 1º serviço com aquele id. É O critério de salvarTecnicosOS — quem exclui o
 * serviço da base do principal usa exatamente o mesmo.
 */
export function indiceServicoDoTecnico(
  tec: Pick<TecnicoOS, "servico_id" | "servico_linha_id">,
  servicosOS: FormData["servicos"],
): number {
  if (tec.servico_linha_id) return servicosOS.findIndex(s => s.linha_os?.linha_id === tec.servico_linha_id);
  if (tec.servico_id) return servicosOS.findIndex(s => s.id === tec.servico_id);
  return -1;
}

/**
 * Situação de uma linha de "Técnicos por Serviço" diante dos serviços da OS:
 *  - "completa": técnico escolhido e ligado a um serviço que está na OS;
 *  - "legado": técnico escolhido, sem serviço ligado, mas com descrição — linha
 *    gravada antes de existir a ligação (servico_id null no banco). Continua
 *    sendo gravada como sempre, para reabrir e salvar uma OS antiga não apagar
 *    o técnico dela;
 *  - "servico_removido": a linha aponta para um serviço que saiu da OS;
 *  - "sem_servico": nenhum serviço escolhido (nem descrição);
 *  - "sem_tecnico": serviço ok, mas técnico não escolhido.
 * Só "completa" e "legado" viram registro em os_tecnicos (tecnicosParaGravar).
 */
export type SituacaoLinhaTecnico = "completa" | "legado" | "servico_removido" | "sem_servico" | "sem_tecnico";

export function situacaoLinhaTecnico(tec: TecnicoOS, servicosOS: FormData["servicos"]): SituacaoLinhaTecnico {
  const temLigacao = !!tec.servico_id || !!tec.servico_linha_id;
  if (temLigacao && indiceServicoDoTecnico(tec, servicosOS) < 0) return "servico_removido";
  if (!temLigacao && !(tec.descricao_servico || "").trim()) return "sem_servico";
  if (!tec.funcionario_id) return "sem_tecnico";
  return temLigacao ? "completa" : "legado";
}

/**
 * Linhas que o save grava (e que entram no cálculo da comissão do principal).
 * Linha incompleta — sem técnico, sem serviço ou com o serviço removido da OS —
 * é ignorada: não vira insert, nem snapshot de comissão, nem erro. A tela
 * destaca essas linhas (EtapaServicosProdutos) para o usuário corrigir.
 */
export function tecnicosParaGravar(tecnicos: TecnicoOS[], servicosOS: FormData["servicos"]): TecnicoOS[] {
  return tecnicos.filter((tec) => {
    const s = situacaoLinhaTecnico(tec, servicosOS);
    return s === "completa" || s === "legado";
  });
}

export function servicoDoTecnicoNaOS(
  tec: Pick<TecnicoOS, "servico_id" | "servico_linha_id">,
  servicosOS: FormData["servicos"],
): FormData["servicos"][number] | undefined {
  const i = indiceServicoDoTecnico(tec, servicosOS);
  return i >= 0 ? servicosOS[i] : undefined;
}

/**
 * Técnicos (posição em `tecnicos`) ligados a um serviço de OUTRA pessoa que
 * não o principal, com o serviço (posição em servicosOS). Vazio quando:
 *  - não há principal;
 *  - o principal tem linha própria em os_tecnicos nesta OS (aí a comissão dele
 *    é a soma das linhas dele, como sempre — o snapshot da OS não é lido);
 *  - nenhum outro técnico (com funcionário escolhido) está ligado a um serviço.
 */
function ligacoesDeOutrosTecnicos(
  principalId: string | null | undefined,
  tecnicos: TecnicoOS[],
  servicosOS: FormData["servicos"],
): { tecnico: number; servico: number }[] {
  if (!principalId) return [];
  if (tecnicos.some(t => t.funcionario_id === principalId)) return [];
  const r: { tecnico: number; servico: number }[] = [];
  tecnicos.forEach((tec, t) => {
    if (!tec.funcionario_id) return; // linha sem técnico escolhido
    const i = indiceServicoDoTecnico(tec, servicosOS);
    if (i >= 0) r.push({ tecnico: t, servico: i });
  });
  return r;
}

/** Há outro técnico ligado a serviço? Só então vale calcular as linhas antes do principal. */
export function temServicoDeOutroTecnico(
  principalId: string | null | undefined,
  tecnicos: TecnicoOS[],
  servicosOS: FormData["servicos"],
): boolean {
  return ligacoesDeOutrosTecnicos(principalId, tecnicos, servicosOS).length > 0;
}

/**
 * Serviços (posições em servicosOS) que saem da base de comissão do Técnico
 * Principal porque estão ligados a OUTRO técnico em "Técnicos por Serviço" que
 * TEM comissão configurada para eles — o mesmo serviço nunca paga comissão
 * duas vezes, e nenhum serviço fica sem ninguém recebendo.
 *
 * `linhasCalculadas` = montarLinhasTecnicosOS(...).linhas para os MESMOS
 * `tecnicos` (uma linha por técnico, na mesma ordem); o critério é
 * linhaComComissaoConfigurada (o mesmo da tela do Sistema A). Técnico ligado
 * sem comissão configurada: o serviço continua com o principal (F0e).
 */
export function servicosDeOutrosTecnicos(
  principalId: string | null | undefined,
  tecnicos: TecnicoOS[],
  servicosOS: FormData["servicos"],
  linhasCalculadas: ({ comissao_tipo_snapshot?: string | null } | undefined)[],
): Set<number> {
  const excluidos = new Set<number>();
  for (const { tecnico, servico } of ligacoesDeOutrosTecnicos(principalId, tecnicos, servicosOS)) {
    if (linhaComComissaoConfigurada(linhasCalculadas[tecnico])) excluidos.add(servico);
  }
  return excluidos;
}

export interface ComissaoFuncionarioTipoRow extends ComissaoConfig {
  funcionario_id: string;
}

export interface EntradaMontarTecnicosOS {
  osId: string;
  tecnicos: TecnicoOS[];
  servicosOS: FormData["servicos"];
  totalOS: number;
  tipoServicoId: string | null;
  dispositivoMarca?: string | null;
  /** Ids de serviço do catálogo que AINDA existem. */
  servicoIdsValidos: Set<string>;
  tiposServicoTodos: TipoServicoResumo[];
  comissoesFuncionarios: ComissaoFuncionarioTipoRow[];
  funcsCalculo: { id: string; nome: string; comissao_calculo: string | null }[];
  servicosCatalogoVinculo: { id: string; tipo_servico_id: string | null }[];
}

export interface ResultadoMontarTecnicosOS {
  linhas: TablesInsert<"os_tecnicos">[];
  itensCustoNaoConfirmado: { nome: string; tecnico: string }[];
  itensComissaoAmbigua: { nome: string; tecnico: string; candidatos: CandidatoAmbiguo[] }[];
}

export function montarLinhasTecnicosOS({
  osId,
  tecnicos,
  servicosOS,
  totalOS,
  tipoServicoId,
  dispositivoMarca,
  servicoIdsValidos,
  tiposServicoTodos,
  comissoesFuncionarios,
  funcsCalculo,
  servicosCatalogoVinculo,
}: EntradaMontarTecnicosOS): ResultadoMontarTecnicosOS {
  const resultado: Omit<ResultadoMontarTecnicosOS, "linhas"> = { itensCustoNaoConfirmado: [], itensComissaoAmbigua: [] };
  const tsId = tipoServicoId || null;

  const vinculoPorServicoId = new Map<string, string>();
  servicosCatalogoVinculo.forEach((s) => {
    if (s.tipo_servico_id) vinculoPorServicoId.set(s.id, s.tipo_servico_id);
  });

  const comissaoPorFuncionarioETipo = new Map<string, ComissaoConfig>();
  comissoesFuncionarios.forEach((c) => {
    comissaoPorFuncionarioETipo.set(`${c.funcionario_id}:${c.tipo_servico_id}`, c);
  });

  const comissaoCalculoPorFuncionario = new Map<string, ComissaoCalculo>();
  const nomePorFuncionario = new Map<string, string>();
  funcsCalculo.forEach((f) => {
    comissaoCalculoPorFuncionario.set(f.id, f.comissao_calculo === "lucro" ? "lucro" : "faturamento");
    nomePorFuncionario.set(f.id, f.nome);
  });

  const tecnicosParaInserir: TablesInsert<"os_tecnicos">[] = [];

  for (const tec of tecnicos) {
    let comissaoTipo: string | null = null;
    let comissaoValor: number | null = null;
    let comissaoCalculada: number | null = null;

    // Serviço vinculado a este técnico (preço próprio); se não houver
    // vínculo (dados antigos ou não informado), cai no total da OS. Com o mesmo
    // serviço repetido, a linha (servico_linha_id) decide qual delas.
    const servicoVinculado = servicoDoTecnicoNaOS(tec, servicosOS);
    const baseCalculo = servicoVinculado ? servicoVinculado.preco : totalOS;

    let comissaoConfig: ComissaoConfig | undefined;
    if (servicoVinculado) {
      const tiposComComissaoDoTecnico = tiposServicoTodos.filter(t =>
        comissaoPorFuncionarioETipo.has(`${tec.funcionario_id}:${t.id}`)
      );
      const comissaoPorTipoServicoId = new Map(
        tiposComComissaoDoTecnico.map(t => [t.id, comissaoPorFuncionarioETipo.get(`${tec.funcionario_id}:${t.id}`)!])
      );
      // Vínculo direto (servicos.tipo_servico_id) tem prioridade sobre o nome.
      const resultadoMatch = resolverComissaoDoServico(
        servicoVinculado.nome,
        vinculoPorServicoId.get(servicoVinculado.id),
        tiposComComissaoDoTecnico,
        comissaoPorTipoServicoId,
        dispositivoMarca,
      );
      comissaoConfig = resultadoMatch.config;
      if (resultadoMatch.vinculoSemConfig) {
        // Serviço vinculado a um Tipo, mas este técnico não tem % para ele:
        // comissão R$ 0,00 intencional — não é ambiguidade, não gera aviso
        // "revise" (mesmo tratamento do Técnico Principal).
        console.info(
          "[comissao] Técnico por serviço: serviço vinculado a um Tipo sem % configurada para o técnico — comissão R$ 0,00 intencional:",
          { funcionarioId: tec.funcionario_id, servico: servicoVinculado.nome },
        );
      } else if (resultadoMatch.ambiguo) {
        console.warn(
          "[comissao] Comissão ambígua para técnico vinculado a serviço específico — não aplicada (revisão manual necessária):",
          { funcionarioId: tec.funcionario_id, servico: servicoVinculado.nome, dispositivoMarca, candidatos: resultadoMatch.candidatosAmbiguos },
        );
        resultado.itensComissaoAmbigua.push({
          nome: servicoVinculado.nome,
          tecnico: nomePorFuncionario.get(tec.funcionario_id) || "técnico",
          candidatos: resultadoMatch.candidatosAmbiguos || [],
        });
      }
    } else if (tsId) {
      comissaoConfig = comissaoPorFuncionarioETipo.get(`${tec.funcionario_id}:${tsId}`);
    }

    if (comissaoConfig && comissaoConfig.comissao_valor > 0) {
      const calculoFunc = comissaoCalculoPorFuncionario.get(tec.funcionario_id) || "faturamento";
      // Com serviço vinculado: base = preço − custo (modo lucro) do próprio
      // serviço. Sem vínculo (legado): cai no total da OS como faturamento.
      const itemCalc = servicoVinculado
        ? entradaComissaoServico(servicoVinculado)
        : { preco: baseCalculo > 0 ? baseCalculo : 0, custo: 0, custoConfirmado: true };
      const calc = calcularComissaoDoItem(itemCalc, comissaoConfig, calculoFunc);
      if (calc.custoNaoConfirmado) {
        console.warn(
          "[comissao] Comissão sobre LUCRO (Técnico por Serviço): custo R$ 0,00 não confirmado — comissão não aplicada até confirmar o custo na OS:",
          { funcionarioId: tec.funcionario_id, servico: servicoVinculado?.nome },
        );
        resultado.itensCustoNaoConfirmado.push({
          nome: servicoVinculado?.nome || tec.descricao_servico || "serviço",
          tecnico: nomePorFuncionario.get(tec.funcionario_id) || "técnico",
        });
      } else {
        comissaoTipo = comissaoConfig.comissao_tipo;
        comissaoValor = comissaoConfig.comissao_valor;
        comissaoCalculada = calc.valor;
      }
    }

    // Serviço manual (id "manual_*") mantém o comportamento antigo; serviço de
    // catálogo só é gravado se ainda existir — id órfão vira null.
    const servicoIdParaGravar = servicoVinculado
      ? (servicoVinculado.id.startsWith("manual_") || servicoIdsValidos.has(servicoVinculado.id)
          ? servicoVinculado.id
          : null)
      : null;

    tecnicosParaInserir.push({
      os_id: osId,
      funcionario_id: tec.funcionario_id,
      descricao_servico: tec.descricao_servico || null,
      servico_id: servicoIdParaGravar,
      servico_nome_snapshot: servicoVinculado ? servicoVinculado.nome : null,
      preco_servico_snapshot: servicoVinculado ? servicoVinculado.preco : null,
      comissao_tipo_snapshot: comissaoTipo,
      comissao_valor_snapshot: comissaoValor,
      comissao_calculada_snapshot: comissaoCalculada,
      // Só linhas com linha_id (serviço repetido/quantidade) levam a coluna;
      // as demais gravam exatamente como antes.
      ...(servicoVinculado?.linha_os?.linha_id ? { servico_linha_id: servicoVinculado.linha_os.linha_id } : {}),
    });
  }

  return { linhas: tecnicosParaInserir, ...resultado };
}
