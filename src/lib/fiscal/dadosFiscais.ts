/**
 * Campos fiscais opcionais dos cadastros (colunas da etapa 2A):
 *   produtos, pecas, dispositivos: ncm, cest, unidade, perfil_tributario_id
 *   servicos: codigo_lc116, codigo_municipal, aliquota_iss, iss_retido, perfil_tributario_id
 *   clientes: email, complemento, inscricao_estadual
 *
 * O formulário guarda texto ('' = vazio); para gravar, texto vazio vira null.
 * Os avisos NÃO impedem salvar (o lojista e o contador dele respondem pelos
 * dados). Só quem vê os campos (useFiscalVisivel) manda estas chaves no
 * insert/update — para os demais o payload fica exatamente como antes.
 *
 * Sem React nem imports "@/": testado com Deno em scripts/testes-fiscal/.
 */

export type TipoItemFiscal = "produto" | "servico" | "aparelho_usado";

/** Valor lido do banco (select '*'), que pode nem ter a chave. */
type ValorBanco = string | number | boolean | null | undefined;

const texto = (v: ValorBanco): string => (v === null || v === undefined ? "" : String(v));
const ouNull = (v: string): string | null => {
  const t = v.trim();
  return t === "" ? null : t;
};
const soDigitosComPontos = (v: string) => /^[\d.\s]+$/.test(v);
const qtdDigitos = (v: string) => v.replace(/\D/g, "").length;

// ---------------------------------------------------------------------------
// Produtos, peças e dispositivos
// ---------------------------------------------------------------------------

export interface CamposFiscaisItem {
  ncm: string;
  cest: string;
  unidade: string;
  perfil_tributario_id: string;
}

export interface ColunasFiscaisItem {
  ncm: string | null;
  cest: string | null;
  unidade: string | null;
  perfil_tributario_id: string | null;
}

export const CAMPOS_FISCAIS_ITEM_VAZIOS: CamposFiscaisItem = {
  ncm: "",
  cest: "",
  unidade: "",
  perfil_tributario_id: "",
};

export function camposFiscaisItemDaLinha(
  linha: Partial<Record<keyof ColunasFiscaisItem, ValorBanco>> | null | undefined,
): CamposFiscaisItem {
  return {
    ncm: texto(linha?.ncm),
    cest: texto(linha?.cest),
    unidade: texto(linha?.unidade),
    perfil_tributario_id: texto(linha?.perfil_tributario_id),
  };
}

export function colunasFiscaisItem(c: CamposFiscaisItem): ColunasFiscaisItem {
  return {
    ncm: ouNull(c.ncm),
    cest: ouNull(c.cest),
    unidade: ouNull(c.unidade.toUpperCase()),
    perfil_tributario_id: ouNull(c.perfil_tributario_id),
  };
}

export function avisosFiscaisItem(c: CamposFiscaisItem): Partial<Record<keyof CamposFiscaisItem, string>> {
  const avisos: Partial<Record<keyof CamposFiscaisItem, string>> = {};
  const ncm = c.ncm.trim();
  if (ncm && !(soDigitosComPontos(ncm) && qtdDigitos(ncm) === 8)) avisos.ncm = "O NCM costuma ter 8 dígitos (ex.: 8517.13.00).";
  const cest = c.cest.trim();
  if (cest && !(soDigitosComPontos(cest) && qtdDigitos(cest) === 7)) avisos.cest = "O CEST costuma ter 7 dígitos (ex.: 21.053.00).";
  const unidade = c.unidade.trim();
  if (unidade && !/^[A-Za-z0-9]{1,6}$/.test(unidade)) avisos.unidade = "Use até 6 letras ou números (ex.: UN, PC, KIT).";
  return avisos;
}

// ---------------------------------------------------------------------------
// Serviços
// ---------------------------------------------------------------------------

/** iss_retido no formulário: '' = não informado (grava null). */
export type IssRetidoForm = "" | "sim" | "nao";

export interface CamposFiscaisServico {
  codigo_lc116: string;
  codigo_municipal: string;
  aliquota_iss: string;
  iss_retido: IssRetidoForm;
  perfil_tributario_id: string;
}

export interface ColunasFiscaisServico {
  codigo_lc116: string | null;
  codigo_municipal: string | null;
  aliquota_iss: number | null;
  iss_retido: boolean | null;
  perfil_tributario_id: string | null;
}

export const CAMPOS_FISCAIS_SERVICO_VAZIOS: CamposFiscaisServico = {
  codigo_lc116: "",
  codigo_municipal: "",
  aliquota_iss: "",
  iss_retido: "",
  perfil_tributario_id: "",
};

export function camposFiscaisServicoDaLinha(
  linha: Partial<Record<keyof ColunasFiscaisServico, ValorBanco>> | null | undefined,
): CamposFiscaisServico {
  const retido = linha?.iss_retido;
  return {
    codigo_lc116: texto(linha?.codigo_lc116),
    codigo_municipal: texto(linha?.codigo_municipal),
    aliquota_iss: linha?.aliquota_iss === null || linha?.aliquota_iss === undefined
      ? ""
      : String(Number(linha.aliquota_iss)).replace(".", ","),
    iss_retido: retido === true ? "sim" : retido === false ? "nao" : "",
    perfil_tributario_id: texto(linha?.perfil_tributario_id),
  };
}

/** "5", "5,5", "2.75" -> número com até 2 casas; vazio, inválido ou fora de 0..100 -> null. */
export function aliquotaParaNumero(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (t === "" || !/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

export function colunasFiscaisServico(c: CamposFiscaisServico): ColunasFiscaisServico {
  return {
    codigo_lc116: ouNull(c.codigo_lc116),
    codigo_municipal: ouNull(c.codigo_municipal),
    aliquota_iss: aliquotaParaNumero(c.aliquota_iss),
    iss_retido: c.iss_retido === "sim" ? true : c.iss_retido === "nao" ? false : null,
    perfil_tributario_id: ouNull(c.perfil_tributario_id),
  };
}

export function avisosFiscaisServico(c: CamposFiscaisServico): Partial<Record<keyof CamposFiscaisServico, string>> {
  const avisos: Partial<Record<keyof CamposFiscaisServico, string>> = {};
  const lc = c.codigo_lc116.trim();
  if (lc && !/^\d{1,2}\.\d{2}$/.test(lc)) avisos.codigo_lc116 = "Formato do item da LC 116: 14.01 (ou 1.01).";
  const aliq = c.aliquota_iss.trim();
  if (aliq) {
    const t = aliq.replace(",", ".");
    if (aliquotaParaNumero(aliq) === null) {
      avisos.aliquota_iss = "Alíquota inválida: use um número de 0 a 100. Do jeito que está, ela será salva em branco.";
    } else if (/\.\d{3,}$/.test(t)) {
      avisos.aliquota_iss = "A alíquota será arredondada para 2 casas.";
    }
  }
  return avisos;
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export interface CamposFiscaisCliente {
  email: string;
  complemento: string;
  inscricao_estadual: string;
}

export interface ColunasFiscaisCliente {
  email: string | null;
  complemento: string | null;
  inscricao_estadual: string | null;
}

export const CAMPOS_FISCAIS_CLIENTE_VAZIOS: CamposFiscaisCliente = {
  email: "",
  complemento: "",
  inscricao_estadual: "",
};

export function camposFiscaisClienteDaLinha(
  linha: Partial<Record<keyof ColunasFiscaisCliente, ValorBanco>> | null | undefined,
): CamposFiscaisCliente {
  return {
    email: texto(linha?.email),
    complemento: texto(linha?.complemento),
    inscricao_estadual: texto(linha?.inscricao_estadual),
  };
}

export function colunasFiscaisCliente(c: CamposFiscaisCliente): ColunasFiscaisCliente {
  return {
    email: ouNull(c.email),
    complemento: ouNull(c.complemento),
    inscricao_estadual: ouNull(c.inscricao_estadual),
  };
}

export function avisosFiscaisCliente(c: CamposFiscaisCliente): Partial<Record<keyof CamposFiscaisCliente, string>> {
  const avisos: Partial<Record<keyof CamposFiscaisCliente, string>> = {};
  const email = c.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) avisos.email = "E-mail com formato inválido.";
  return avisos;
}
