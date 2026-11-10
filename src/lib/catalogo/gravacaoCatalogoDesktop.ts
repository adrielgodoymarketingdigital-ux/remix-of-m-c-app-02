/**
 * Salvar único do Catálogo no computador: decide O QUE vai para configuracoes_loja e quando
 * recusar antes de gravar. A gravação em si fica em useLinkCatalogo.
 * Sem dependências (testado com Deno: deno test -A --no-check src/lib/catalogo/).
 *
 * Regras:
 * - catalogo_config vai sempre (é o que os Salvar antigos já gravavam).
 * - catalogo_slug e catalogo_ativo só vão quando MUDARAM. Assim um lojista sem link, que só
 *   trocou o template, não grava slug vazio (catalogo_slug é único entre as lojas), e um link
 *   trocado pela aba Landing Page (que grava a mesma coluna) não é sobrescrito sem querer.
 * - Link novo precisa de 3+ caracteres e de "disponível" confirmado; enquanto a conferência
 *   não termina, não grava.
 * - Publicar exige link com 3+ caracteres (o mesmo aviso da tela antiga).
 * - 0 linhas atualizadas = sem permissão: nada de "salvo com sucesso".
 */

export const TAMANHO_MINIMO_LINK = 3;

export interface LinkSalvo {
  slug: string | null | undefined;
  ativo: boolean | null | undefined;
}

export interface EstadoParaGravar {
  catalogo: unknown;
  slug: string;
  ativo: boolean;
}

/** Resultado da conferência "link em uso?" para o slug atual: null = ainda não conferido. */
export type DisponibilidadeLink = boolean | null;

export type ErroAntesDeGravar = "link_curto" | "link_em_uso" | "conferindo_link" | "publicar_sem_link";

export interface DadosGravacao {
  catalogo_config: unknown;
  catalogo_slug?: string;
  catalogo_ativo?: boolean;
}

export type Gravacao = { ok: true; dados: DadosGravacao } | { ok: false; erro: ErroAntesDeGravar };

const limpo = (s: string | null | undefined) => (s ?? "").trim();

/** O link mudou em relação ao salvo (espaços nas pontas não contam). */
export function linkMudou(salvo: LinkSalvo, slugAtual: string): boolean {
  return limpo(salvo.slug) !== limpo(slugAtual);
}

/** Conferir disponibilidade só faz sentido para link novo com tamanho mínimo. */
export function precisaConferirLink(salvo: LinkSalvo, slugAtual: string): boolean {
  return linkMudou(salvo, slugAtual) && limpo(slugAtual).length >= TAMANHO_MINIMO_LINK;
}

export function montarGravacao(salvo: LinkSalvo, atual: EstadoParaGravar, disponivel: DisponibilidadeLink): Gravacao {
  const slug = limpo(atual.slug);
  const mudouLink = linkMudou(salvo, slug);
  const mudouAtivo = (salvo.ativo === true) !== (atual.ativo === true);

  if (mudouLink) {
    if (slug.length < TAMANHO_MINIMO_LINK) return { ok: false, erro: "link_curto" };
    if (disponivel === false) return { ok: false, erro: "link_em_uso" };
    if (disponivel === null) return { ok: false, erro: "conferindo_link" };
  }
  if (atual.ativo === true && slug.length < TAMANHO_MINIMO_LINK) return { ok: false, erro: "publicar_sem_link" };

  // Cópia "JSON pura" (como os Salvar antigos): undefined some, nada de referência ao estado da tela.
  const dados: DadosGravacao = { catalogo_config: JSON.parse(JSON.stringify(atual.catalogo ?? {})) };
  if (mudouLink) dados.catalogo_slug = slug;
  if (mudouAtivo) dados.catalogo_ativo = atual.ativo === true;
  return { ok: true, dados };
}

/**
 * Lê o retorno do update com .select(): lista com ao menos uma linha = gravou.
 * Lista vazia (ou nada) = o filtro não achou a linha da loja (ex.: funcionário, que hoje
 * grava com o próprio id; ver docs/pendencias-catalogo.md, item 1).
 */
export function resultadoGravacao(linhas: readonly unknown[] | null | undefined): "ok" | "sem_permissao" {
  return Array.isArray(linhas) && linhas.length > 0 ? "ok" : "sem_permissao";
}

/** Mesmo formato do campo da tela antiga: minúsculas, sem acento, só a-z 0-9 e hífen, até 30. */
export function formatarLink(valor: string): string {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .substring(0, 30);
}

/** "Gerar automático" a partir do nome da loja (mesma regra da tela antiga). */
export function linkDoNomeDaLoja(nome: string | null | undefined): string {
  const slug = (nome ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 30);
  return slug || "minha-loja";
}
