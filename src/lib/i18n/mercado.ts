import {
  ehIdioma,
  ehMercado,
  IDIOMA_PADRAO,
  MERCADO_PADRAO,
  type CodigoMercado,
  type Idioma,
} from "./idiomas";
import { ehFusoValido, fusoPadraoDoPais } from "./regiao";

/**
 * O que existe em cada mercado. Brasil = tudo ligado (é o app de sempre).
 * temFiscal é o que o mercado comporta; quem vê o módulo fiscal hoje continua
 * sendo decidido por useFiscalVisivel — na tela valem os dois juntos.
 */
export interface CapacidadesMercado {
  /** NF-e/NFC-e/NFS-e e campos fiscais (CNPJ, IE, NCM...). */
  temFiscal: boolean;
  /** Pix como forma de pagamento. */
  temPix: boolean;
  /** CEP com busca de endereço (ViaCEP). */
  temCep: boolean;
  /** Rótulo e validação do documento do cliente: CPF/CNPJ ou documento livre. */
  documentoPessoa: "CPF" | "documento";
  /** Máscara do telefone: (11) 98765-4321 ou formato internacional livre. */
  mascaraTelefone: "BR" | "internacional";
}

const CAPACIDADES_BRASIL: CapacidadesMercado = {
  temFiscal: true,
  temPix: true,
  temCep: true,
  documentoPessoa: "CPF",
  mascaraTelefone: "BR",
};

const CAPACIDADES_FORA_DO_BRASIL: CapacidadesMercado = {
  temFiscal: false,
  temPix: false,
  temCep: false,
  documentoPessoa: "documento",
  mascaraTelefone: "internacional",
};

export function capacidadesDoMercado(mercado: CodigoMercado): CapacidadesMercado {
  return mercado === "BR" ? CAPACIDADES_BRASIL : CAPACIDADES_FORA_DO_BRASIL;
}

/** Colunas regionais de profiles (etapa 1). */
export interface PerfilRegional {
  idioma: string | null;
  mercado: string | null;
  pais: string | null;
  moeda: string | null;
  fuso_horario: string | null;
}

export interface InfoMercado {
  idioma: Idioma;
  mercado: CodigoMercado;
  /** ISO 4217 (BRL, USD...). */
  moeda: string;
  /** ISO 3166-1 alfa-2 (BR, MX...). */
  pais: string;
  /** IANA (America/Sao_Paulo...). */
  fuso: string;
  capacidades: CapacidadesMercado;
}

/** O app de sempre. Mesmo objeto em toda chamada (não muda referência em render). */
export const MERCADO_BRASIL: InfoMercado = {
  idioma: IDIOMA_PADRAO,
  mercado: MERCADO_PADRAO,
  moeda: "BRL",
  pais: "BR",
  fuso: "America/Sao_Paulo",
  capacidades: CAPACIDADES_BRASIL,
};

const ehMoeda = (v: string | null): v is string => !!v && /^[A-Z]{3}$/.test(v);
const ehPais = (v: string | null): v is string => !!v && /^[A-Z]{2}$/.test(v);

/**
 * Perfil → mercado. Sem perfil, ou coluna vazia/inválida, cai no padrão
 * Brasil daquela coluna (as mesmas DEFAULTs do banco). O fuso inválido cai no
 * padrão do PAÍS (loja chilena num iPhone que não conhece America/Coyhaique
 * fica em Santiago, não em São Paulo); no Brasil, America/Sao_Paulo.
 */
export function infoMercadoDoPerfil(perfil: PerfilRegional | null | undefined): InfoMercado {
  if (!perfil) return MERCADO_BRASIL;
  const mercado = ehMercado(perfil.mercado) ? perfil.mercado : MERCADO_BRASIL.mercado;
  const pais = ehPais(perfil.pais) ? perfil.pais : MERCADO_BRASIL.pais;
  return {
    idioma: ehIdioma(perfil.idioma) ? perfil.idioma : MERCADO_BRASIL.idioma,
    mercado,
    moeda: ehMoeda(perfil.moeda) ? perfil.moeda : MERCADO_BRASIL.moeda,
    pais,
    fuso: ehFusoValido(perfil.fuso_horario) ? perfil.fuso_horario : fusoPadraoDoPais(pais),
    capacidades: capacidadesDoMercado(mercado),
  };
}
