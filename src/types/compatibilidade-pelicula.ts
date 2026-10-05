import type { TipoCompatibilidade } from "@/lib/compatibilidade/compatibilidade";

export interface GrupoCompatibilidadePelicula {
  id: string;
  nome: string;
  criado_em: string;
  criado_por: string | null;
  /** "pelicula" ou "vidro" (troca de vidro da tela). */
  tipo: TipoCompatibilidade;
}

export interface ModeloCompatibilidade {
  id: string;
  grupo_id: string;
  marca: string;
  modelo: string;
}

export interface GrupoCompatibilidadeComModelos extends GrupoCompatibilidadePelicula {
  modelos: ModeloCompatibilidade[];
}
