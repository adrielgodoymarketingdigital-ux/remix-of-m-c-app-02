/**
 * Dados do recibo A4 PERSONALIZADO da OS (ImpressaoA4Personalizado), montados
 * a partir de ordem.avarias e do layout da loja. É uma CÓPIA da lógica de
 * ImpressaoA4Padrao/ImpressaoA4Tech (que continuam intactos): os mesmos campos,
 * nas mesmas condições — muda só o desenho. Puro (sem React, sem formatação de
 * moeda/data), para ser testado em Deno.
 */
import type {
  AvariaVisual,
  AvariasOS,
  CustoAdicional,
  ProdutoUtilizado,
  ServicoRealizado,
} from "@/types/ordem-servico";
import type { LayoutOSConfig } from "@/types/configuracao-loja";

export interface ItemChecklistRecibo {
  /** Chave gravada na OS (ex.: "camera_traseira") — escolhe o ícone. */
  chave: string;
  /** Texto mostrado: a chave sem "_", igual ao recibo de sempre. */
  rotulo: string;
  /** true = ok (✓ verde); false = com problema (✗ vermelho). Nunca inventado. */
  ok: boolean;
  /** Descrição da peça trocada (só no item peca_trocada marcado). */
  detalhe: string | null;
}

export interface ChecklistRecibo {
  itens: ItemChecklistRecibo[];
}

export interface DadosReciboOSPersonalizado {
  servicos: ServicoRealizado[];
  produtos: ProdutoUtilizado[];
  custos: CustoAdicional[];
  desconto: number;
  /** Só quando há desconto (mesma regra do recibo de sempre). */
  subtotal: number | undefined;
  /** "Sem teste" (aparelho chegou desligado) — só com o checklist ligado. */
  checklistSemTeste: boolean;
  /** null = não mostra (checklist desligado ou vazio). */
  checklistEntrada: ChecklistRecibo | null;
  checklistSaida: ChecklistRecibo | null;
  /** null = não mostra (avarias desligadas ou nenhuma). */
  avarias: { frente: AvariaVisual[]; traseira: AvariaVisual[] } | null;
  /** Só quando a OS está marcada para imprimir as observações internas. */
  observacoesInternas: string | null;
}

type AvariasComInline = AvariasOS & { servicos_inline?: { nome: string; valor?: number }[] };

/** Mesmo fallback do recibo de sempre: servicos_realizados ou, se vazio, servicos_inline (onboarding). */
function servicosDaOS(avarias: AvariasComInline | null): ServicoRealizado[] {
  const servicos = (avarias?.servicos_realizados || []) as ServicoRealizado[];
  if (servicos.length > 0) return servicos;
  const inline = avarias?.servicos_inline || [];
  return inline.map((s, i) => ({
    id: `inline-${i}`,
    nome: s.nome,
    preco: s.valor || 0,
    custo: 0,
    lucro: s.valor || 0,
  })) as ServicoRealizado[];
}

function montarChecklist(
  marcados: Record<string, boolean>,
  descricaoPecaTrocada: string | undefined,
): ChecklistRecibo {
  return {
    itens: Object.entries(marcados).map(([chave, status]) => ({
      chave,
      rotulo: chave.replace(/_/g, " "),
      ok: !!status,
      detalhe: chave === "peca_trocada" && status && descricaoPecaTrocada ? descricaoPecaTrocada : null,
    })),
  };
}

export function montarDadosReciboOSPersonalizado(
  ordem: { avarias?: unknown; total?: number | null },
  layoutConfig: Pick<LayoutOSConfig, "mostrar_checklist" | "mostrar_avarias">,
): DadosReciboOSPersonalizado {
  const avarias = (ordem.avarias ?? null) as AvariasComInline | null;
  const checklist = avarias?.checklist;
  const entrada = checklist?.entrada || {};
  const saida = checklist?.saida || {};
  const visuais = (avarias?.avarias_visuais || []) as AvariaVisual[];
  const desconto = avarias?.dados_pagamento?.desconto || 0;
  const subtotal = avarias?.dados_pagamento?.subtotal ?? (desconto > 0 ? (ordem.total || 0) + desconto : undefined);
  const comChecklist = !!layoutConfig.mostrar_checklist;

  return {
    servicos: servicosDaOS(avarias),
    produtos: (avarias?.produtos_utilizados || []) as ProdutoUtilizado[],
    custos: (avarias?.custos_adicionais || []) as CustoAdicional[],
    desconto,
    subtotal,
    checklistSemTeste: comChecklist && !!checklist?.sem_teste,
    checklistEntrada: comChecklist && Object.keys(entrada).length > 0
      ? montarChecklist(entrada, checklist?.peca_trocada_descricao_entrada)
      : null,
    checklistSaida: comChecklist && Object.keys(saida).length > 0
      ? montarChecklist(saida, checklist?.peca_trocada_descricao_saida)
      : null,
    avarias: layoutConfig.mostrar_avarias && visuais.length > 0
      ? { frente: visuais.filter((a) => a.lado === "frente"), traseira: visuais.filter((a) => a.lado === "traseira") }
      : null,
    observacoesInternas: avarias?.observacoes_internas && avarias?.mostrar_obs_internas_impressao
      ? avarias.observacoes_internas
      : null,
  };
}

/** Fotos: 1 ou 2 → 2 por linha (maiores); 3 ou mais → 3 por linha (como hoje). */
export function colunasFotosRecibo(quantidade: number): 2 | 3 {
  return quantidade <= 2 ? 2 : 3;
}
