/**
 * Grupo(s) de cada modelo compatível, para a lista do computador. Usa só o que
 * encontrarCompativeis já devolve (resultado.grupos traz os modelos de cada
 * grupo). Sem dependências do app (testado com Deno em scripts/testes-compat-vidros/).
 */

interface ModeloDoGrupoMinimo {
  marca: string;
  modelo: string;
}

interface GrupoMinimo {
  nome: string;
  modelos: ModeloDoGrupoMinimo[];
}

export interface CompativelComGrupos {
  marca: string;
  modelo: string;
  /** Nomes dos grupos em que o modelo aparece, sem repetir, na ordem de resultado.grupos. */
  grupos: string[];
}

/**
 * Para cada compatível (na mesma ordem de `compativeis`), os nomes dos grupos de
 * `grupos` em que ele aparece. Comparação exata de marca e modelo, como na busca.
 */
export function gruposDosCompativeis(resultado: {
  grupos: GrupoMinimo[];
  compativeis: ModeloDoGrupoMinimo[];
}): CompativelComGrupos[] {
  return resultado.compativeis.map(({ marca, modelo }) => {
    const nomes: string[] = [];
    for (const grupo of resultado.grupos) {
      if (!grupo.modelos.some((m) => m.marca === marca && m.modelo === modelo)) continue;
      if (!nomes.includes(grupo.nome)) nomes.push(grupo.nome);
    }
    return { marca, modelo, grupos: nomes };
  });
}
