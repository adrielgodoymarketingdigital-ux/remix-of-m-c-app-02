/**
 * Fotos do aparelho nos links de acompanhamento (/acompanhar/:token e
 * /acompanhar-cliente/:token). Módulo puro (sem React, navegador nem banco),
 * testado com Deno em scripts/testes-acompanhamento-fotos/.
 *
 * Quem decide se as fotos saem é o banco (RPCs get_os_tracking e
 * get_cliente_tracking), nunca só a tela:
 *  1. loja: configuracoes_loja (linha da matriz) → cores_personalizadas
 *     .tracking_config.mostrar_fotos === true. Desligada ou ausente: nada sai;
 *  2. OS: com a loja ligada, as fotos saem POR PADRÃO. Só não saem quando
 *     ordens_servico.avarias.fotos_acompanhamento === false (caixa desmarcada).
 *     Chave ausente, null ou true = inclui.
 * Aqui ficam só a leitura da resposta, o estado da caixa por OS e as mesclas de
 * gravação (cada tela grava só a sua chave, sobre o valor relido do banco).
 */

/** Máximo de fotos no acompanhamento (o corte de verdade é feito no SQL). */
export const MAX_FOTOS_ACOMPANHAMENTO = 6;

export const ROTULO_OPCAO_LOJA = "Mostrar fotos no acompanhamento";
export const ROTULO_CAIXA_OS = "Incluir fotos neste link";
export const TITULO_FOTOS_ACOMPANHAMENTO = "Fotos do aparelho";
/** Texto de apoio da caixa por OS (ela já vem marcada quando a loja ligou a opção). */
export const AVISO_CAIXA_OS = "Desmarque se houver foto de documento do cliente.";
/** Confirmação ao LIGAR a opção da loja: vale para todas as OS com fotos, inclusive links já enviados. */
export const AVISO_LIGAR_FOTOS_LOJA =
  "Todas as OS com fotos passarão a exibir as fotos no link do cliente, inclusive links já enviados. Desmarque nas OS com foto de documento.";
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

/**
 * A OS inclui as fotos no link: sempre, a não ser que "Incluir fotos neste link"
 * tenha sido desmarcada (false explícito). Ausente, null ou true = inclui.
 */
export function osIncluiFotos(avarias: unknown): boolean {
  return comoObjeto(avarias).fotos_acompanhamento !== false;
}

/** Salvar a tela da loja vai LIGAR as fotos (estava desligada no banco): pede confirmação antes. */
export function precisaConfirmarFotosLoja(p: { ligadaNoBanco: boolean; ligadaNaTela: boolean }): boolean {
  return p.ligadaNaTela && !p.ligadaNoBanco;
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

/**
 * Gravação da caixa por OS: só a chave fotos_acompanhamento; o resto de avarias fica
 * como está. Desmarcar grava false; marcar de novo grava true (registro explícito
 * da escolha, que vale também se a regra do banco voltar a exigir a marca).
 */
export function mesclarFotosAcompanhamento(avariasAtuais: unknown, incluir: boolean): Chaves {
  return { ...comoObjeto(avariasAtuais), fotos_acompanhamento: incluir };
}

/**
 * Para telas que remontam avarias a partir de um objeto que pode estar velho
 * (edição da OS, assinatura de saída): a escolha da caixa é a que está no banco.
 * Sem isso, um "desmarcado" (false) sumiria e as fotos voltariam a aparecer.
 */
export function aplicarEscolhaFotosDoBanco(avarias: { fotos_acompanhamento?: boolean }, avariasNoBanco: unknown): void {
  const escolha = comoObjeto(avariasNoBanco).fotos_acompanhamento;
  if (typeof escolha === "boolean") avarias.fotos_acompanhamento = escolha;
  else delete avarias.fotos_acompanhamento;
}
