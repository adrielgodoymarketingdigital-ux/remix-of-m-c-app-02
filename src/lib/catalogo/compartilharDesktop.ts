// Passo "Compartilhar" do Catálogo no computador: situação do link (rascunho até o Salvar do topo)
// e o resumo do PDF (mesma regra do handleGerarPDF: itensParaPdf sobre os itens e a seleção da tela).
import type { ItemCatalogo } from "@/types/catalogo-item";
import { itemPodeIrParaPdf, itensParaPdf } from "./itensParaPdf.ts";
import { TAMANHO_MINIMO_LINK } from "./gravacaoCatalogoDesktop.ts";

const limpo = (s: string | null | undefined) => (s ?? "").trim();

interface EstadoLink {
  slug: string;
  ativo: boolean;
  slugSalvo: string;
  ativoSalvo: boolean;
}

/** Selo do cartão: o que está no ar AGORA (o salvo), não o rascunho da tela. */
export function seloDoLink(l: Pick<EstadoLink, "slugSalvo" | "ativoSalvo">): "publicado" | "rascunho" {
  return l.ativoSalvo === true && limpo(l.slugSalvo).length >= TAMANHO_MINIMO_LINK ? "publicado" : "rascunho";
}

export type SituacaoCampoLink = "sem_link" | "curto" | "salvo" | "conferindo" | "disponivel" | "em_uso";

/** O que dizer embaixo do campo do link. */
export function situacaoDoCampo(
  l: Pick<EstadoLink, "slug" | "slugSalvo"> & { conferindo: boolean; disponivel: boolean | null },
): SituacaoCampoLink {
  const slug = limpo(l.slug);
  if (slug.length === 0) return "sem_link";
  if (slug.length < TAMANHO_MINIMO_LINK) return "curto";
  if (slug === limpo(l.slugSalvo)) return "salvo";
  if (l.conferindo || l.disponivel === null) return "conferindo";
  return l.disponivel ? "disponivel" : "em_uso";
}

/** Publicar ligado sem um link válido (o Salvar recusa com "publicar_sem_link"). */
export function publicarSemLink(l: Pick<EstadoLink, "slug" | "ativo">): boolean {
  return l.ativo === true && limpo(l.slug).length < TAMANHO_MINIMO_LINK;
}

/** Há mudança no link ou na publicação que só vale depois do Salvar. */
export function linkPendente(l: EstadoLink): boolean {
  return limpo(l.slug) !== limpo(l.slugSalvo) || (l.ativo === true) !== (l.ativoSalvo === true);
}

/**
 * Link que copiar / abrir / compartilhar usam: o SALVO (o que existe de verdade).
 * null quando ainda não há link salvo.
 */
export function linkPublicoSalvo(origem: string, slugSalvo: string | null | undefined): string | null {
  const slug = limpo(slugSalvo);
  return slug.length >= TAMANHO_MINIMO_LINK ? `${origem}/c/${slug}` : null;
}

export interface ResumoPdf {
  /** Itens que entram no PDF (o mesmo número que o handleGerarPDF usa). */
  entram: number;
  /** Itens da seleção (ou de todos, sem seleção) que ficam de fora: ocultos ou dispositivos vendidos. */
  ficamDeFora: number;
  /** true = há itens marcados; só eles contam. */
  comSelecao: boolean;
}

export function resumoPdf(itens: ItemCatalogo[], selecionados: string[]): ResumoPdf {
  const comSelecao = selecionados.length > 0;
  const marcados = new Set(selecionados);
  const vistos = new Set<string>();
  let ficamDeFora = 0;
  for (const item of itens) {
    if (vistos.has(item.id)) continue;
    vistos.add(item.id);
    if (comSelecao && !marcados.has(item.id)) continue;
    if (!itemPodeIrParaPdf(item)) ficamDeFora++;
  }
  return { entram: itensParaPdf(itens, selecionados).length, ficamDeFora, comSelecao };
}
