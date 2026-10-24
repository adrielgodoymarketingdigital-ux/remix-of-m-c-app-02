import type { AvariaVisual, Checklist, SenhaDesbloqueio } from "../../types/ordem-servico";
import { decryptSenhaDesbloqueio, encryptSenhaDesbloqueio } from "../password-encryption.ts";
import { caminhoMiniatura, ehFotoV2 } from "../dispositivos/fotosDispositivoNomes.ts";
import { numeroAdicional, tituloDispositivo, type DispositivoAdicionalOS } from "./dispositivosAdicionaisOS.ts";
import type { CamposNovosLinhaServico } from "./linhaServicoOS.ts";

/**
 * GRAVAÇÃO dos dispositivos adicionais da OS (tabela os_dispositivos_adicionais),
 * etapa 5a da OS com vários dispositivos. Módulo sem React e sem o cliente do
 * Supabase (o banco entra por ClienteGravacaoAdicionais), testado com Deno em
 * scripts/testes-os-multi/.
 *
 * Regras (aprovadas):
 * - id do aparelho gerado pelo app (crypto.randomUUID) ao criá-lo na tela, para
 *   que o upsert possa ser repetido sem duplicar e o serviço possa apontar para
 *   ele (dispositivo_ref) antes de gravar.
 * - upsert de TODOS os aparelhos da tela, depois delete SÓ dos ids removidos
 *   pelo usuário. Nunca "apagar o que não está na lista": isso apagaria o
 *   aparelho que outra pessoa adicionou na mesma OS ao mesmo tempo.
 * - ordem recalculada pela posição (2, 3, ...) a cada gravação.
 * - user_id sempre o dono da OS (effectiveUserId), nunca de campo da tela; a
 *   RLS recusa qualquer outro.
 * - fotos de aparelho removido só saem do storage depois de a OS, o upsert e o
 *   delete terem dado certo.
 */

/** Máximo de aparelhos ALÉM do dispositivo 1. */
export const MAX_DISPOSITIVOS_ADICIONAIS = 10;

/** Aparelho adicional no formulário da OS: senha EM CLARO, textos "" quando vazios. */
export interface DispositivoAdicionalForm {
  id: string;
  dispositivo_tipo: string;
  dispositivo_marca: string;
  dispositivo_modelo: string;
  dispositivo_cor: string;
  dispositivo_imei: string;
  dispositivo_numero_serie: string;
  dispositivo_sistema: string;
  dispositivo_fabricante: string;
  dispositivo_subtipo: string;
  senha_desbloqueio: SenhaDesbloqueio;
  defeito_relatado: string;
  checklist: Checklist;
  avarias_visuais: AvariaVisual[];
  fotos_dispositivo: string[];
  observacoes: string;
}

/** O que a tela entrega para gravar: a lista atual (em ordem) e o que o usuário removeu. */
export interface EntradaGravacaoAdicionais {
  dispositivos: DispositivoAdicionalForm[];
  /**
   * Aparelhos que vieram do banco e o usuário removeu (com as fotos, para apagar
   * depois). `rotulo` ("iPhone 12") só serve para o aviso se a remoção falhar.
   */
  removidos: { id: string; fotos_dispositivo: string[]; rotulo?: string }[];
}

/** Linha enviada ao upsert (colunas de os_dispositivos_adicionais). */
export interface LinhaGravacaoAdicional {
  id: string;
  os_id: string;
  user_id: string;
  ordem: number;
  dispositivo_tipo: string;
  dispositivo_marca: string;
  dispositivo_modelo: string;
  dispositivo_cor: string | null;
  dispositivo_imei: string | null;
  dispositivo_numero_serie: string | null;
  dispositivo_sistema: string | null;
  dispositivo_fabricante: string | null;
  dispositivo_subtipo: string | null;
  senha_desbloqueio: SenhaDesbloqueio | null;
  defeito_relatado: string | null;
  checklist: Checklist;
  avarias_visuais: AvariaVisual[];
  fotos_dispositivo: string[];
  observacoes: string | null;
}

export interface PlanoGravacaoAdicionais {
  osId: string;
  linhas: LinhaGravacaoAdicional[];
  idsRemover: string[];
  /** Caminhos no bucket dispositivos-fotos (com a miniatura, se v2). */
  fotosApagar: string[];
}

export const BUCKET_FOTOS_OS = "dispositivos-fotos";

export const senhaVazia = (): SenhaDesbloqueio => ({ tipo: "numero", valor: "", padrao: [] });

/** Aparelho novo, em branco, com o id que vai para o banco. */
export function novoDispositivoAdicionalForm(id: string): DispositivoAdicionalForm {
  return {
    id,
    dispositivo_tipo: "",
    dispositivo_marca: "",
    dispositivo_modelo: "",
    dispositivo_cor: "",
    dispositivo_imei: "",
    dispositivo_numero_serie: "",
    dispositivo_sistema: "",
    dispositivo_fabricante: "",
    dispositivo_subtipo: "",
    senha_desbloqueio: senhaVazia(),
    defeito_relatado: "",
    checklist: { entrada: {}, saida: {} },
    avarias_visuais: [],
    fotos_dispositivo: [],
    observacoes: "",
  };
}

const textoOuNull = (v: string | null | undefined): string | null =>
  typeof v === "string" && v.trim() !== "" ? v : null;

function senhaPreenchida(s: SenhaDesbloqueio | null | undefined): boolean {
  if (!s) return false;
  return s.nao_informada === true || (s.valor ?? "") !== "" || (s.padrao?.length ?? 0) > 0;
}

/** Aparelho do formulário → linha do banco, com a senha criptografada (null se em branco). */
export function montarLinhaAdicional(
  d: DispositivoAdicionalForm,
  ctx: { osId: string; userId: string; ordem: number },
): LinhaGravacaoAdicional {
  return {
    id: d.id,
    os_id: ctx.osId,
    user_id: ctx.userId,
    ordem: ctx.ordem,
    dispositivo_tipo: d.dispositivo_tipo,
    dispositivo_marca: d.dispositivo_marca,
    dispositivo_modelo: d.dispositivo_modelo,
    dispositivo_cor: textoOuNull(d.dispositivo_cor),
    dispositivo_imei: textoOuNull(d.dispositivo_imei),
    dispositivo_numero_serie: textoOuNull(d.dispositivo_numero_serie),
    dispositivo_sistema: textoOuNull(d.dispositivo_sistema),
    dispositivo_fabricante: textoOuNull(d.dispositivo_fabricante),
    dispositivo_subtipo: textoOuNull(d.dispositivo_subtipo),
    senha_desbloqueio: senhaPreenchida(d.senha_desbloqueio) ? encryptSenhaDesbloqueio(d.senha_desbloqueio) ?? null : null,
    defeito_relatado: textoOuNull(d.defeito_relatado),
    checklist: d.checklist ?? { entrada: {}, saida: {} },
    avarias_visuais: d.avarias_visuais ?? [],
    fotos_dispositivo: d.fotos_dispositivo ?? [],
    observacoes: textoOuNull(d.observacoes),
  };
}

/** Aparelho lido do banco (lerDispositivoAdicional) → formulário, com a senha em claro. */
export function adicionalParaFormulario(d: DispositivoAdicionalOS): DispositivoAdicionalForm {
  return {
    id: d.id,
    dispositivo_tipo: d.dispositivo_tipo,
    dispositivo_marca: d.dispositivo_marca,
    dispositivo_modelo: d.dispositivo_modelo,
    dispositivo_cor: d.dispositivo_cor ?? "",
    dispositivo_imei: d.dispositivo_imei ?? "",
    dispositivo_numero_serie: d.dispositivo_numero_serie ?? "",
    dispositivo_sistema: d.dispositivo_sistema ?? "",
    dispositivo_fabricante: d.dispositivo_fabricante ?? "",
    dispositivo_subtipo: d.dispositivo_subtipo ?? "",
    senha_desbloqueio: decryptSenhaDesbloqueio(d.senha_desbloqueio ?? undefined) ?? senhaVazia(),
    defeito_relatado: d.defeito_relatado ?? "",
    checklist: d.checklist ?? { entrada: {}, saida: {} },
    avarias_visuais: d.avarias_visuais,
    fotos_dispositivo: d.fotos_dispositivo,
    observacoes: d.observacoes ?? "",
  };
}

export interface ErroValidacaoAdicional {
  /** Posição na lista (0 = Dispositivo 2); null para erro da lista inteira. */
  indice: number | null;
  campo: "dispositivo_tipo" | "dispositivo_marca" | "dispositivo_modelo" | "id" | "quantidade";
  mensagem: string;
}

/** Tipo, marca e modelo obrigatórios (como o dispositivo 1), ids únicos, no máximo 10. */
export function validarDispositivosAdicionais(dispositivos: readonly DispositivoAdicionalForm[]): ErroValidacaoAdicional[] {
  const erros: ErroValidacaoAdicional[] = [];
  if (dispositivos.length > MAX_DISPOSITIVOS_ADICIONAIS) {
    erros.push({
      indice: null,
      campo: "quantidade",
      mensagem: `No máximo ${MAX_DISPOSITIVOS_ADICIONAIS} aparelhos adicionais por OS.`,
    });
  }
  const vistos = new Set<string>();
  dispositivos.forEach((d, i) => {
    const titulo = tituloDispositivo(numeroAdicional(i));
    if (typeof d.id !== "string" || d.id.trim() === "" || vistos.has(d.id)) {
      erros.push({ indice: i, campo: "id", mensagem: `${titulo}: identificação inválida.` });
    }
    vistos.add(d.id);
    if (!(d.dispositivo_tipo ?? "").trim()) {
      erros.push({ indice: i, campo: "dispositivo_tipo", mensagem: `${titulo}: selecione o tipo de dispositivo.` });
    }
    if (!(d.dispositivo_marca ?? "").trim()) {
      erros.push({ indice: i, campo: "dispositivo_marca", mensagem: `${titulo}: informe a marca do dispositivo.` });
    }
    if (!(d.dispositivo_modelo ?? "").trim()) {
      erros.push({ indice: i, campo: "dispositivo_modelo", mensagem: `${titulo}: informe o modelo do dispositivo.` });
    }
  });
  return erros;
}

const normalizarImei = (v: string | null | undefined): string => (v ?? "").replace(/[\s.\-/]/g, "").toLowerCase();

/**
 * Avisos (nunca bloqueiam) de IMEI repetido entre os aparelhos da MESMA OS,
 * incluindo o dispositivo 1. Ex.: "IMEI 3567… repetido: Dispositivo 1 e Dispositivo 3."
 */
export function avisosImeiRepetido(
  imeiDispositivo1: string | null | undefined,
  dispositivos: readonly Pick<DispositivoAdicionalForm, "dispositivo_imei">[],
): string[] {
  const grupos = new Map<string, { imei: string; numeros: number[] }>();
  const registrar = (imei: string | null | undefined, numero: number) => {
    const chave = normalizarImei(imei);
    if (!chave) return;
    const g = grupos.get(chave) ?? { imei: (imei ?? "").trim(), numeros: [] };
    g.numeros.push(numero);
    grupos.set(chave, g);
  };
  registrar(imeiDispositivo1, 1);
  dispositivos.forEach((d, i) => registrar(d.dispositivo_imei, numeroAdicional(i)));
  const avisos: string[] = [];
  for (const { imei, numeros } of grupos.values()) {
    if (numeros.length < 2) continue;
    const nomes = numeros.map(tituloDispositivo);
    const lista = nomes.length === 2 ? nomes.join(" e ") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
    avisos.push(`IMEI ${imei} repetido: ${lista}.`);
  }
  return avisos;
}

/**
 * Tira das linhas de serviço o dispositivo_ref que aponta para aparelho que não
 * existe mais (a linha volta para "OS / aparelho principal"). Linhas sem
 * mudança voltam como o MESMO objeto; linha_os que fica vazia vira undefined,
 * como numa linha que nunca teve campos novos.
 */
export function limparLigacoesOrfas<T extends { linha_os?: CamposNovosLinhaServico }>(
  servicos: readonly T[],
  idsExistentes: Iterable<string>,
): T[] {
  const ids = new Set(idsExistentes);
  return servicos.map((s) => {
    const ref = s.linha_os?.dispositivo_ref;
    if (ref === undefined || ids.has(ref)) return s;
    const { dispositivo_ref: _ref, ...resto } = s.linha_os as CamposNovosLinhaServico;
    return { ...s, linha_os: Object.keys(resto).length > 0 ? resto : undefined };
  });
}

/** Caminho no bucket de uma foto da OS (URL pública do Supabase); null se não for desse bucket. */
export function caminhoFotoOS(url: string): string | null {
  try {
    const m = new URL(url).pathname.match(/\/storage\/v1\/object\/public\/dispositivos-fotos\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Monta o que gravar. Não valida (ver validarDispositivosAdicionais) e não toca
 * no banco. Ids removidos que ainda estão na lista são ignorados; fotos que
 * ainda são usadas (por outro aparelho ou pelo dispositivo 1) não são apagadas.
 */
export function planejarGravacaoAdicionais(
  entrada: EntradaGravacaoAdicionais,
  ctx: { osId: string; userId: string; fotosDispositivo1?: readonly string[] },
): PlanoGravacaoAdicionais {
  const linhas = entrada.dispositivos.map((d, i) =>
    montarLinhaAdicional(d, { osId: ctx.osId, userId: ctx.userId, ordem: numeroAdicional(i) }),
  );
  const idsMantidos = new Set(linhas.map((l) => l.id));
  const removidos = entrada.removidos.filter((r) => r.id && !idsMantidos.has(r.id));
  const idsRemover = [...new Set(removidos.map((r) => r.id))];

  const fotosEmUso = new Set([...(ctx.fotosDispositivo1 ?? []), ...linhas.flatMap((l) => l.fotos_dispositivo)]);
  const fotosApagar: string[] = [];
  for (const url of removidos.flatMap((r) => r.fotos_dispositivo ?? [])) {
    if (fotosEmUso.has(url)) continue;
    const caminho = caminhoFotoOS(url);
    if (!caminho) continue;
    for (const c of ehFotoV2(caminho) ? [caminho, caminhoMiniatura(caminho)] : [caminho]) {
      if (!fotosApagar.includes(c)) fotosApagar.push(c);
    }
  }
  return { osId: ctx.osId, linhas, idsRemover, fotosApagar };
}

type RespostaBanco = PromiseLike<{ error: { message?: string } | null }>;

/** O banco, injetado (em produção: supabase; nos testes: falso). */
export interface ClienteGravacaoAdicionais {
  upsert(linhas: LinhaGravacaoAdicional[]): RespostaBanco;
  remover(osId: string, ids: string[]): RespostaBanco;
  apagarFotos(caminhos: string[]): RespostaBanco;
}

/**
 * Resultado para a tela tratar (5b):
 * - "ok": tudo gravado (ou nada a gravar).
 * - "remocao_falhou": aparelhos atuais gravados; os removidos continuam no
 *   banco (nada se perde) e as fotos deles não foram apagadas.
 * - "falhou": o upsert falhou 2 vezes; os adicionais no banco ficam como
 *   estavam. A OS em si JÁ ESTÁ SALVA.
 */
export type ResultadoGravacaoAdicionais =
  | { status: "ok"; gravados: number; removidos: number; avisos: string[] }
  | { status: "remocao_falhou"; gravados: number; idsNaoRemovidos: string[]; mensagem: string; avisos: string[] }
  | { status: "falhou"; etapa: "upsert" | "os_sem_id"; mensagem: string; tentativas: number };

const TENTATIVAS = 2;

async function comNovaTentativa(acao: () => RespostaBanco): Promise<{ erro: string | null; tentativas: number }> {
  let erro: string | null = null;
  for (let t = 1; t <= TENTATIVAS; t++) {
    try {
      const { error } = await acao();
      if (!error) return { erro: null, tentativas: t };
      erro = error.message || "erro desconhecido";
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
    }
  }
  return { erro, tentativas: TENTATIVAS };
}

/**
 * Executa o plano: upsert (2 tentativas) → delete dos removidos (2 tentativas)
 * → fotos dos removidos. Plano vazio não faz nenhum pedido. Nunca rejeita.
 */
export async function executarGravacaoAdicionais(
  cliente: ClienteGravacaoAdicionais,
  plano: PlanoGravacaoAdicionais,
): Promise<ResultadoGravacaoAdicionais> {
  if (plano.linhas.length > 0) {
    const r = await comNovaTentativa(() => cliente.upsert(plano.linhas));
    if (r.erro) return { status: "falhou", etapa: "upsert", mensagem: r.erro, tentativas: r.tentativas };
  }

  if (plano.idsRemover.length > 0) {
    const r = await comNovaTentativa(() => cliente.remover(plano.osId, plano.idsRemover));
    if (r.erro) {
      return {
        status: "remocao_falhou",
        gravados: plano.linhas.length,
        idsNaoRemovidos: plano.idsRemover,
        mensagem: r.erro,
        avisos: [],
      };
    }
  }

  const avisos: string[] = [];
  if (plano.fotosApagar.length > 0) {
    // Falhar aqui só deixa arquivo sobrando no storage; o aparelho já saiu.
    try {
      const { error } = await cliente.apagarFotos(plano.fotosApagar);
      if (error) avisos.push(`Fotos do aparelho removido não foram apagadas: ${error.message || "erro desconhecido"}`);
    } catch (e) {
      avisos.push(`Fotos do aparelho removido não foram apagadas: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { status: "ok", gravados: plano.linhas.length, removidos: plano.idsRemover.length, avisos };
}
