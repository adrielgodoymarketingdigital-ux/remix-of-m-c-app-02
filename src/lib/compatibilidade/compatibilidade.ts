/**
 * Compatibilidade de películas e de vidros (troca de vidro da tela): mesma base
 * (grupos_compatibilidade_pelicula + grupo_compatibilidade_modelos), separada
 * pela coluna `tipo` do grupo. Sem dependências do app (testado com Deno em
 * scripts/testes-compat-vidros/).
 */

export type TipoCompatibilidade = "pelicula" | "vidro";

export const TIPOS_COMPATIBILIDADE: TipoCompatibilidade[] = ["pelicula", "vidro"];

export interface ModeloDoGrupo {
  id: string;
  grupo_id: string;
  marca: string;
  modelo: string;
}

export interface GrupoComModelos {
  id: string;
  nome: string;
  /** Ausente/null antes da migration da coluna `tipo`: vale "pelicula". */
  tipo?: string | null;
  modelos: ModeloDoGrupo[];
}

export interface MarcaModelo {
  marca: string;
  modelo: string;
}

/** Valor do parâmetro ?tipo= da URL; qualquer coisa diferente de "vidro" é película. */
export function lerTipoCompatibilidade(valor: string | null | undefined): TipoCompatibilidade {
  return valor === "vidro" ? "vidro" : "pelicula";
}

export function tipoDoGrupo(grupo: { tipo?: string | null }): TipoCompatibilidade {
  return grupo.tipo === "vidro" ? "vidro" : "pelicula";
}

export function filtrarPorTipo<T extends { tipo?: string | null }>(grupos: T[], tipo: TipoCompatibilidade): T[] {
  return grupos.filter((g) => tipoDoGrupo(g) === tipo);
}

// Ordem "natural" (A2 antes de A10), ignorando maiúsculas; empate decidido pelo texto exato.
function compararNomes(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }) || (a < b ? -1 : a > b ? 1 : 0);
}

export interface OpcoesMarcaModelo {
  marcas: string[];
  modelosPorMarca: Record<string, string[]>;
}

/**
 * Opções do seletor a partir dos próprios dados: pares distintos marca/modelo
 * (texto exatamente como está gravado), ordenados e sem repetidos.
 */
export function montarOpcoesMarcaModelo(grupos: GrupoComModelos[]): OpcoesMarcaModelo {
  const porMarca = new Map<string, Set<string>>();
  for (const grupo of grupos) {
    for (const m of grupo.modelos) {
      if (!m.marca || !m.modelo) continue;
      let modelos = porMarca.get(m.marca);
      if (!modelos) porMarca.set(m.marca, (modelos = new Set()));
      modelos.add(m.modelo);
    }
  }
  const marcas = [...porMarca.keys()].sort(compararNomes);
  const modelosPorMarca: Record<string, string[]> = {};
  for (const marca of marcas) modelosPorMarca[marca] = [...porMarca.get(marca)!].sort(compararNomes);
  return { marcas, modelosPorMarca };
}

export interface ResultadoCompatibilidade<G extends GrupoComModelos = GrupoComModelos> {
  /** Todos os grupos em que o modelo aparece (normalmente 1). */
  grupos: G[];
  /** União dos outros modelos desses grupos, sem repetir e sem o próprio modelo. */
  compativeis: MarcaModelo[];
}

/** Compatíveis de marca+modelo (comparação exata); grupos vazio = modelo sem dados. */
export function encontrarCompativeis<G extends GrupoComModelos>(grupos: G[], marca: string, modelo: string): ResultadoCompatibilidade<G> {
  const encontrados = grupos.filter((g) => g.modelos.some((m) => m.marca === marca && m.modelo === modelo));
  const vistos = new Set<string>();
  const compativeis: MarcaModelo[] = [];
  for (const g of encontrados) {
    for (const m of g.modelos) {
      if (m.marca === marca && m.modelo === modelo) continue;
      const chave = `${m.marca}\u0000${m.modelo}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      compativeis.push({ marca: m.marca, modelo: m.modelo });
    }
  }
  return { grupos: encontrados, compativeis };
}

/**
 * Erro do PostgREST/Postgres quando a coluna `tipo` ainda não existe (front
 * publicado antes da migration): 42703 = undefined_column no SELECT/filtro,
 * PGRST204 = coluna fora do cache do schema no INSERT.
 */
export function ehErroColunaTipoAusente(erro: { code?: string; message?: string } | null | undefined): boolean {
  if (!erro) return false;
  if (erro.code !== "42703" && erro.code !== "PGRST204") return false;
  return /\btipo\b/.test(erro.message ?? "");
}
