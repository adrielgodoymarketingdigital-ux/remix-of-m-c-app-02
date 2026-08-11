export interface GrupoCompatibilidadePelicula {
  id: string;
  nome: string;
  criado_em: string;
  criado_por: string | null;
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
