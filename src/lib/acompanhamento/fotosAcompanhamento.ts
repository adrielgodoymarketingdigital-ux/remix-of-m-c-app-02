/**
 * Fotos do aparelho nos links de acompanhamento (/acompanhar/:token e
 * /acompanhar-cliente/:token). Módulo puro (sem React, navegador nem banco),
 * testado com Deno em scripts/testes-acompanhamento-fotos/.
 *
 * As fotos só saem quando as DUAS regras valem, e quem decide é o banco (RPCs
 * get_os_tracking e get_cliente_tracking), nunca só a tela:
 *  1. loja: configuracoes_loja (linha da matriz) → cores_personalizadas
 *     .tracking_config.mostrar_fotos === true;
 *  2. OS: ordens_servico.avarias.fotos_acompanhamento === true.
 * Aqui ficam só a leitura da resposta, o estado da caixa por OS e as mesclas de
 * gravação (cada tela grava só a sua chave, sobre o valor relido do banco).
 */

/** Máximo de fotos no acompanhamento (o corte de verdade é feito no SQL). */
export const MAX_FOTOS_ACOMPANHAMENTO = 6;

export const ROTULO_OPCAO_LOJA = "Mostrar fotos no acompanhamento";
export const ROTULO_CAIXA_OS = "Incluir fotos neste link";
export const TITULO_FOTOS_ACOMPANHAMENTO = "Fotos do aparelho";
export const MOTIVO_OS_SEM_FOTOS = "Esta OS não tem fotos";
export const MOTIVO_LOJA_DESLIGADA = `A loja não ligou "${ROTULO_OPCAO_LOJA}" (Página de Acompanhamento)`;

export const textoVerFotos = (n: number) => `Ver fotos (${n})`;

type Chaves = Record<string, unknown>;

function comoObjeto(valor: unknown): Chaves {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? (valor as Chaves) : {};
}

function urlsValidas(valor: unknown): string[] {
  return Array.isArray(valor)
    ? valor.filter((f): f is string => typeof f === "string" && /^https?:\/\//i.test(f.trim())).map((f) => f.trim())
    : [];
}

/**
 * Coluna "fotos" das RPCs de acompanhamento. Antes da migration a coluna não
 * existe (undefined): vira lista vazia, sem erro.
 */
export function fotosDoAcompanhamento(valor: unknown): string[] {
  return urlsValidas(valor).slice(0, MAX_FOTOS_ACOMPANHAMENTO);
}

/** A loja ligou "Mostrar fotos no acompanhamento" (só true de verdade conta). */
export function lojaMostraFotos(coresPersonalizadas: unknown): boolean {
  return comoObjeto(comoObjeto(coresPersonalizadas).tracking_config).mostrar_fotos === true;
}

/** A OS está marcada com "Incluir fotos neste link". */
export function osIncluiFotos(avarias: unknown): boolean {
  return comoObjeto(avarias).fotos_acompanhamento === true;
}

/** Quantas fotos da OS iriam para o link (no máximo 6). */
export function totalFotosParaLink(avarias: unknown): number {
  return Math.min(urlsValidas(comoObjeto(avarias).fotos_dispositivo).length, MAX_FOTOS_ACOMPANHAMENTO);
}

export interface DecisaoCaixaFotosLink {
  /** A caixa "Incluir fotos neste link" pode ser marcada. */
  habilitada: boolean;
  /** Por que a caixa está desabilitada (mostrado abaixo dela). */
  motivo: string | null;
  /** O cliente vai ver fotos neste link. */
  incluir: boolean;
}

export function decidirCaixaFotosLink(p: { lojaLigada: boolean; totalFotos: number; marcada: boolean }): DecisaoCaixaFotosLink {
  const motivo = p.totalFotos <= 0 ? MOTIVO_OS_SEM_FOTOS : !p.lojaLigada ? MOTIVO_LOJA_DESLIGADA : null;
  return { habilitada: motivo === null, motivo, incluir: motivo === null && p.marcada };
}

/**
 * Gravação da tela "Página de Acompanhamento": mantém tudo que já estava em
 * cores_personalizadas (tema da loja etc.) e, dentro de tracking_config, aplica
 * por cima só o que a tela editou.
 */
export function mesclarTrackingConfig(coresAtuais: unknown, editado: object): Chaves {
  const cores = comoObjeto(coresAtuais);
  return { ...cores, tracking_config: { ...comoObjeto(cores.tracking_config), ...editado } };
}

/** Gravação da caixa por OS: só a chave fotos_acompanhamento; o resto de avarias fica como está. */
export function mesclarFotosAcompanhamento(avariasAtuais: unknown, incluir: boolean): Chaves {
  return { ...comoObjeto(avariasAtuais), fotos_acompanhamento: incluir };
}
