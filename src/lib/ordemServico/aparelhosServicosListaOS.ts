import { chaveLinhaServico, nomeLinhaServico } from "./linhaServicoOS.ts";
import { valorLinhaServico } from "./totaisPecasOS.ts";
import { marcaModelo, numeroAdicional, tituloDispositivo } from "./dispositivosAdicionaisOS.ts";

/**
 * "Aparelhos e serviços" da linha expandida na lista de OS (etapa 6d da OS com
 * vários dispositivos). Módulo puro (sem React nem banco), testado com Deno em
 * scripts/testes-os-multi/.
 *
 * Só o dispositivo 1 e os adicionais têm cartão próprio. A linha de serviço só
 * se liga a um ADICIONAL (dispositivo_ref); sem ligação — ou ligada a um
 * aparelho que não existe mais — ela fica em "Da OS / aparelho principal",
 * como em todas as outras telas.
 */

/** Linha de avarias.servicos_realizados, só com o que a lista mostra. */
export interface LinhaServicoLista {
  nome: string;
  quantidade?: unknown;
  preco?: number | string | null;
  custo?: number | string | null;
  peca_valor?: number | string | null;
  peca_repassada?: boolean | null;
  dispositivo_ref?: string;
  linha_id?: string;
}

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const numeroOuTexto = (v: unknown): number | string | null =>
  typeof v === "number" || typeof v === "string" ? v : null;

/**
 * Resposta de `select("servicos:avarias->servicos_realizados")` → linhas.
 * Leitura defensiva: OS sem avarias, servicos_realizados ausente ou que não é
 * lista, e itens que não são objeto viram nada.
 */
export function lerLinhasServicoOS(dados: unknown): LinhaServicoLista[] {
  const servicos = objeto(dados)?.servicos;
  if (!Array.isArray(servicos)) return [];
  return servicos.flatMap((s): LinhaServicoLista[] => {
    const o = objeto(s);
    if (!o) return [];
    return [{
      nome: typeof o.nome === "string" ? o.nome : "",
      quantidade: o.quantidade,
      preco: numeroOuTexto(o.preco),
      custo: numeroOuTexto(o.custo),
      peca_valor: numeroOuTexto(o.peca_valor),
      peca_repassada: o.peca_repassada === true,
      ...(typeof o.dispositivo_ref === "string" && o.dispositivo_ref !== "" ? { dispositivo_ref: o.dispositivo_ref } : {}),
      ...(typeof o.linha_id === "string" && o.linha_id !== "" ? { linha_id: o.linha_id } : {}),
    }];
  });
}

export interface ServicoDoGrupo {
  chave: string;
  /** "3x Formatação" (quantidade > 1) ou só o nome. */
  nome: string;
  /** valorLinhaServico: a mesma conta do total da OS (peça repassada soma o custo). */
  valor: number;
}

export interface GrupoAparelhoLista {
  chave: string;
  tipo: "dispositivo1" | "adicional" | "principal";
  /** "Dispositivo 2 — Apple iPhone 12" / "Da OS / aparelho principal". */
  titulo: string;
  /** "IMEI 3567…" / "Série SN-1" / null. */
  detalhe: string | null;
  servicos: ServicoDoGrupo[];
}

export interface AparelhoLista {
  dispositivo_tipo?: string | null;
  dispositivo_marca?: string | null;
  dispositivo_modelo?: string | null;
  dispositivo_imei?: string | null;
  dispositivo_numero_serie?: string | null;
}

export const CHAVE_GRUPO_PRINCIPAL = "principal";
export const TITULO_GRUPO_PRINCIPAL = "Da OS / aparelho principal";

function titulo(numero: number, d: AparelhoLista): string {
  const nome = marcaModelo({ dispositivo_marca: d.dispositivo_marca?.trim(), dispositivo_modelo: d.dispositivo_modelo?.trim() }) ||
    d.dispositivo_tipo?.trim() || "";
  return nome ? `${tituloDispositivo(numero)} — ${nome}` : tituloDispositivo(numero);
}

function detalhe(d: AparelhoLista): string | null {
  const imei = d.dispositivo_imei?.trim();
  if (imei) return `IMEI ${imei}`;
  const serie = d.dispositivo_numero_serie?.trim();
  return serie ? `Série ${serie}` : null;
}

/**
 * Cartões da linha expandida, em ordem: Dispositivo 1, cada adicional com os
 * serviços ligados a ele e, por último, "Da OS / aparelho principal" (só se
 * houver serviço sem ligação). `semServicos` = a OS não tem nenhuma linha.
 */
export function agruparServicosPorAparelho(
  linhas: readonly LinhaServicoLista[],
  dispositivo1: AparelhoLista,
  adicionais: readonly (AparelhoLista & { id: string })[],
): { grupos: GrupoAparelhoLista[]; semServicos: boolean } {
  const ids = new Set(adicionais.map((a) => a.id));
  const porAparelho = new Map<string, ServicoDoGrupo[]>();
  const principal: ServicoDoGrupo[] = [];
  linhas.forEach((s, i) => {
    const servico: ServicoDoGrupo = { chave: chaveLinhaServico(s, i), nome: nomeLinhaServico(s), valor: valorLinhaServico(s) };
    const ref = s.dispositivo_ref;
    if (ref && ids.has(ref)) {
      const lista = porAparelho.get(ref) ?? [];
      lista.push(servico);
      porAparelho.set(ref, lista);
    } else {
      principal.push(servico);
    }
  });
  const grupos: GrupoAparelhoLista[] = [
    { chave: "dispositivo1", tipo: "dispositivo1", titulo: titulo(1, dispositivo1), detalhe: detalhe(dispositivo1), servicos: [] },
    ...adicionais.map((a, i): GrupoAparelhoLista => ({
      chave: a.id,
      tipo: "adicional",
      titulo: titulo(numeroAdicional(i), a),
      detalhe: detalhe(a),
      servicos: porAparelho.get(a.id) ?? [],
    })),
  ];
  if (principal.length > 0) {
    grupos.push({ chave: CHAVE_GRUPO_PRINCIPAL, tipo: "principal", titulo: TITULO_GRUPO_PRINCIPAL, detalhe: null, servicos: principal });
  }
  return { grupos, semServicos: linhas.length === 0 };
}

/**
 * A leitura dos adicionais da tela de detalhes (useOsDispositivosAdicionais)
 * transforma erro em lista vazia. Na linha expandida, lista vazia quando o
 * resumo da lista diz que a OS TEM adicionais é tratada como falha.
 */
export const adicionaisFalharam = (lidos: number, noResumo: number): boolean => noResumo > 0 && lidos === 0;
