import { normalizarNomeParaComparacao } from "./comissaoPorTipoServico";

/**
 * Validação do "+ Adicionar novo modelo" no seletor de modelo da OS: o nome
 * digitado vai para o catálogo próprio da loja (catalogo_dispositivos_custom).
 * Sem rede: quem chama passa os modelos já existentes daquele tipo + marca
 * (catálogo fixo + os da loja).
 */
export const NOVO_MODELO_MIN = 2;
export const NOVO_MODELO_MAX = 60;

export type MotivoNovoModeloInvalido = "vazio" | "curto" | "longo" | "duplicado";

export type ResultadoNovoModelo =
  | { ok: true; nome: string }
  | { ok: false; motivo: MotivoNovoModeloInvalido; existente?: string };

/** trim + espaços repetidos viram um só. */
export function limparNomeModelo(nome: string): string {
  return (nome || "").trim().replace(/\s+/g, " ");
}

/**
 * Chave de comparação: normalizarNomeParaComparacao (trim, minúsculas, espaços)
 * e, além dela, sem acento — "Moto G Pówer" e "moto g power" são o mesmo modelo.
 */
function chaveModelo(nome: string): string {
  return normalizarNomeParaComparacao(nome).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function validarNovoModelo(nome: string, existentes: readonly string[]): ResultadoNovoModelo {
  const limpo = limparNomeModelo(nome);
  if (!limpo) return { ok: false, motivo: "vazio" };
  if (limpo.length < NOVO_MODELO_MIN) return { ok: false, motivo: "curto" };
  if (limpo.length > NOVO_MODELO_MAX) return { ok: false, motivo: "longo" };
  const chave = chaveModelo(limpo);
  const existente = existentes.find((e) => chaveModelo(e) === chave);
  if (existente !== undefined) return { ok: false, motivo: "duplicado", existente };
  return { ok: true, nome: limpo };
}

/**
 * Só dá para adicionar modelo com Tipo escolhido e Marca escolhida da lista
 * (fixa ou da loja). Marca "Outra"/digitada à mão não está em `marcasDaLista`,
 * então não libera — o modelo ficaria preso a uma marca que não existe no catálogo.
 */
export function podeAdicionarModelo(tipo: string, marca: string, marcasDaLista: readonly string[]): boolean {
  return !!tipo && !!marca && marcasDaLista.includes(marca);
}
