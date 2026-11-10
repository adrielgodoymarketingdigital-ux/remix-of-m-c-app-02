/**
 * "Alterações não salvas" do Catálogo no computador: um único Salvar no cabeçalho grava
 * catalogo_config + link (catalogo_slug) + publicação (catalogo_ativo). Aqui só a comparação
 * pura entre o que veio do banco (ou foi salvo por último) e o que está na tela.
 * A aba Landing Page tem o salvar próprio e não entra aqui.
 * Sem dependências (testado com Deno: deno test -A --no-check src/lib/catalogo/).
 */

/** O que o Salvar único grava. `catalogo` é o ConfiguracaoCatalogo inteiro (jsonb). */
export interface EstadoSalvavelCatalogo {
  catalogo: unknown;
  slug: string;
  ativo: boolean;
}

/**
 * Forma canônica para comparar: chaves de objeto em ordem alfabética (o jsonb do Postgres
 * reordena as chaves, então a ordem que volta do banco não é a do CONFIG_PADRAO), e
 * "ausente" unificado: undefined, null e lista vazia somem do objeto. Isso evita o selo
 * logo ao abrir, porque a tela troca itensSelecionadosIds `undefined` por `[]` ao limpar a
 * seleção, e os dois significam "todos". Texto vazio ("") NÃO é ausente: título vazio muda
 * o catálogo (cai no nome da loja). A ordem dentro de listas é mantida (é a ordem salva).
 */
export function canonico(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map((v) => (v === undefined ? null : canonico(v)));
  if (valor !== null && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const chave of Object.keys(valor as Record<string, unknown>).sort()) {
      const v = (valor as Record<string, unknown>)[chave];
      if (v === undefined || v === null) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      saida[chave] = canonico(v);
    }
    return saida;
  }
  if (typeof valor === "number" && !Number.isFinite(valor)) return null;
  return valor;
}

/** Texto estável do estado; guardar este texto como "original" depois de carregar/salvar. */
export function assinaturaEstado(estado: EstadoSalvavelCatalogo): string {
  return JSON.stringify(
    canonico({
      catalogo: estado.catalogo ?? {},
      slug: (estado.slug ?? "").trim(),
      ativo: estado.ativo === true,
    }),
  );
}

/** true quando há algo para salvar. Original ausente (ainda carregando) = sem alterações. */
export function temAlteracoes(assinaturaOriginal: string | null | undefined, atual: EstadoSalvavelCatalogo): boolean {
  if (assinaturaOriginal == null) return false;
  return assinaturaOriginal !== assinaturaEstado(atual);
}

/**
 * Quais partes mudaram (para o aviso e para depuração): "slug", "ativo" e, dentro do
 * catálogo, as chaves de primeiro nível ("catalogo.textos", "catalogo.templateId"...).
 * Em ordem alfabética.
 */
export function partesAlteradas(original: EstadoSalvavelCatalogo, atual: EstadoSalvavelCatalogo): string[] {
  const a = JSON.parse(assinaturaEstado(original)) as Record<string, unknown>;
  const b = JSON.parse(assinaturaEstado(atual)) as Record<string, unknown>;
  const partes: string[] = [];
  if (a.slug !== b.slug) partes.push("slug");
  if (a.ativo !== b.ativo) partes.push("ativo");
  const ca = (a.catalogo ?? {}) as Record<string, unknown>;
  const cb = (b.catalogo ?? {}) as Record<string, unknown>;
  const chaves = new Set([...Object.keys(ca), ...Object.keys(cb)]);
  for (const chave of chaves) {
    if (JSON.stringify(ca[chave]) !== JSON.stringify(cb[chave])) partes.push(`catalogo.${chave}`);
  }
  return partes.sort();
}

/** Estado do botão Salvar: chave de texto para a tela traduzir. */
export type EstadoBotaoSalvar = "salvando" | "salvar" | "tudo_salvo";

export function estadoBotaoSalvar(alterado: boolean, salvando: boolean): EstadoBotaoSalvar {
  if (salvando) return "salvando";
  return alterado ? "salvar" : "tudo_salvo";
}

/** Botão habilitado só com alteração e sem salvamento em andamento. */
export function podeSalvar(alterado: boolean, salvando: boolean): boolean {
  return alterado && !salvando;
}
