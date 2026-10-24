import {
  OPCAO_OUTRA,
  getCoresPorMarca,
  getMarcasPorTipo,
  getModelosPorMarca,
} from "../../data/catalogoDispositivos.ts";

/**
 * Listas de marca, modelo e cor do formulário de um aparelho, pela mesma regra
 * da etapa Dispositivo do aparelho 1 (EtapaDispositivo, que segue com o seu
 * código): marca "Outra" ou tipo sem marcas no catálogo = texto livre, e aí
 * modelo e cor também não têm lista. Os cadastros próprios da loja chegam já
 * buscados para este tipo/marca.
 */
export interface OpcoesCatalogoDispositivo {
  marcas: string[];
  marcasCustom: string[];
  marcaEhTextoLivre: boolean;
  modelos: string[];
  modelosCustom: string[];
  cores: string[];
  coresCustom: string[];
}

export function opcoesCatalogoDispositivo(
  tipo: string,
  marca: string,
  custom: { marcas: string[]; modelos: string[]; cores: string[] },
): OpcoesCatalogoDispositivo {
  const marcas = getMarcasPorTipo(tipo);
  const marcaEhTextoLivre = marca === OPCAO_OUTRA || (marcas.length === 0 && custom.marcas.length === 0);
  return {
    marcas,
    marcasCustom: custom.marcas,
    marcaEhTextoLivre,
    modelos: marcaEhTextoLivre ? [] : getModelosPorMarca(tipo, marca),
    modelosCustom: marcaEhTextoLivre ? [] : custom.modelos,
    cores: marcaEhTextoLivre ? [] : getCoresPorMarca(tipo, marca),
    coresCustom: marcaEhTextoLivre ? [] : custom.cores,
  };
}
