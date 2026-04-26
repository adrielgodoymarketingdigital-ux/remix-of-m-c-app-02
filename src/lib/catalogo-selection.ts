import { CategoriaCatalogo } from '@/types/catalogo';

interface ResultadoSelecaoCatalogo {
  idsValidos: string[];
  idsInvalidos: string[];
  resetarSelecao: boolean;
}

export const sanitizarSelecaoCatalogo = (
  idsSelecionados: string[] | undefined,
  idsDisponiveis: string[]
): ResultadoSelecaoCatalogo => {
  const idsUnicos = Array.from(new Set(idsSelecionados || []));

  if (idsUnicos.length === 0) {
    return {
      idsValidos: [],
      idsInvalidos: [],
      resetarSelecao: false,
    };
  }

  const idsDisponiveisSet = new Set(idsDisponiveis);
  const idsValidos = idsUnicos.filter((id) => idsDisponiveisSet.has(id));
  const idsInvalidos = idsUnicos.filter((id) => !idsDisponiveisSet.has(id));

  return {
    idsValidos: idsInvalidos.length > 0 && idsInvalidos.length >= idsValidos.length ? [] : idsValidos,
    idsInvalidos,
    resetarSelecao: idsInvalidos.length > 0 && idsInvalidos.length >= idsValidos.length,
  };
};

export const sanitizarCategoriasCatalogo = (
  categorias: CategoriaCatalogo[] | undefined,
  idsDisponiveis: string[]
): CategoriaCatalogo[] | undefined => {
  if (!categorias || categorias.length === 0) return categorias;

  const idsDisponiveisSet = new Set(idsDisponiveis);

  return categorias
    .map((categoria) => ({
      ...categoria,
      itemIds: Array.from(new Set(categoria.itemIds.filter((id) => idsDisponiveisSet.has(id)))),
    }))
    .filter((categoria) => categoria.itemIds.length > 0 || categoria.nome.trim().length > 0);
};