import type { AvariaVisual, Checklist, SenhaDesbloqueio } from "../../types/ordem-servico";
import { nomeLinhaServico } from "./linhaServicoOS.ts";

/**
 * Dispositivos ADICIONAIS da OS (tabela os_dispositivos_adicionais). O
 * dispositivo 1 continua nas colunas dispositivo_* de ordens_servico e em
 * avarias. Módulo puro (sem React nem banco), testado com Deno em
 * scripts/testes-os-multi/. Regra de ouro: sem adicionais, todo texto montado
 * aqui sai IDÊNTICO ao de antes.
 *
 * Numeração na tela/impressão: pela posição (o 1º adicional é o "Dispositivo 2"),
 * não pela coluna `ordem`, que pode ter buracos após exclusão.
 */
export interface DispositivoAdicionalOS {
  id: string;
  os_id: string;
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
  /** Ainda criptografada, como avarias.senha_desbloqueio (usar decryptSenhaDesbloqueio). */
  senha_desbloqueio: SenhaDesbloqueio | null;
  defeito_relatado: string | null;
  checklist: Checklist | null;
  avarias_visuais: AvariaVisual[];
  fotos_dispositivo: string[];
  observacoes: string | null;
  created_at: string;
}

/** Só o que a lista de OS precisa (selo "+1 aparelho", busca e exportação). */
export type ResumoDispositivoAdicional = Pick<
  DispositivoAdicionalOS,
  "id" | "os_id" | "ordem" | "dispositivo_marca" | "dispositivo_modelo" | "dispositivo_imei" | "dispositivo_numero_serie"
>;

/** os_id → adicionais da OS, já em ordem. */
export type AdicionaisPorOS = Record<string, ResumoDispositivoAdicional[]>;

export const COLUNAS_RESUMO_ADICIONAIS =
  "id, os_id, ordem, dispositivo_marca, dispositivo_modelo, dispositivo_imei, dispositivo_numero_serie, created_at";

/**
 * Teto de linhas do resumo da lista (uma consulta por loja). É também o teto
 * padrão de linhas por resposta da API do Supabase. Ao atingir, vêm os MAIS
 * NOVOS; as OS mais antigas ficam sem o selo e sem busca pelo adicional na
 * lista — detalhes, impressão, recibo e WhatsApp não usam o resumo e seguem
 * completos (consultam por OS).
 */
export const LIMITE_RESUMO_ADICIONAIS = 1000;

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const objeto = <T>(v: unknown): T | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : null);

function lerAvarias(v: unknown): AvariaVisual[] {
  if (!Array.isArray(v)) return [];
  return v.filter((a): a is AvariaVisual => {
    const o = a as Partial<AvariaVisual> | null;
    return !!o && typeof o === "object" && typeof o.x === "number" && typeof o.y === "number" && (o.lado === "frente" || o.lado === "traseira");
  });
}

function lerFotos(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((f): f is string => typeof f === "string" && f.trim() !== "") : [];
}

function lerChecklist(v: unknown): Checklist | null {
  const c = objeto<Partial<Checklist>>(v);
  if (!c) return null;
  return { ...c, entrada: objeto(c.entrada) ?? {}, saida: objeto(c.saida) ?? {} } as Checklist;
}

/** Linha do banco → adicional; null se faltar o essencial (id, os_id). */
export function lerDispositivoAdicional(linha: unknown): DispositivoAdicionalOS | null {
  const o = objeto<Record<string, unknown>>(linha);
  if (!o || typeof o.id !== "string" || typeof o.os_id !== "string") return null;
  return {
    id: o.id,
    os_id: o.os_id,
    ordem: typeof o.ordem === "number" ? o.ordem : 0,
    dispositivo_tipo: texto(o.dispositivo_tipo) ?? "",
    dispositivo_marca: texto(o.dispositivo_marca) ?? "",
    dispositivo_modelo: texto(o.dispositivo_modelo) ?? "",
    dispositivo_cor: texto(o.dispositivo_cor),
    dispositivo_imei: texto(o.dispositivo_imei),
    dispositivo_numero_serie: texto(o.dispositivo_numero_serie),
    dispositivo_sistema: texto(o.dispositivo_sistema),
    dispositivo_fabricante: texto(o.dispositivo_fabricante),
    dispositivo_subtipo: texto(o.dispositivo_subtipo),
    senha_desbloqueio: objeto<SenhaDesbloqueio>(o.senha_desbloqueio),
    defeito_relatado: texto(o.defeito_relatado),
    checklist: lerChecklist(o.checklist),
    avarias_visuais: lerAvarias(o.avarias_visuais),
    fotos_dispositivo: lerFotos(o.fotos_dispositivo),
    observacoes: texto(o.observacoes),
    created_at: typeof o.created_at === "string" ? o.created_at : "",
  };
}

const porOrdem = (a: { ordem: number; created_at?: string }, b: { ordem: number; created_at?: string }) =>
  a.ordem - b.ordem || (a.created_at ?? "").localeCompare(b.created_at ?? "");

/** Resposta da consulta → adicionais válidos, ordenados por ordem e created_at. */
export function lerDispositivosAdicionais(dados: unknown): DispositivoAdicionalOS[] {
  if (!Array.isArray(dados)) return [];
  return dados.map(lerDispositivoAdicional).filter((d): d is DispositivoAdicionalOS => d !== null).sort(porOrdem);
}

/** Resposta do resumo da lista → mapa os_id → adicionais em ordem. */
export function agruparResumoPorOS(dados: unknown): AdicionaisPorOS {
  const mapa: AdicionaisPorOS = {};
  const linhas = (Array.isArray(dados) ? dados : [])
    .map((l) => {
      const o = objeto<Record<string, unknown>>(l);
      if (!o || typeof o.id !== "string" || typeof o.os_id !== "string") return null;
      return {
        id: o.id,
        os_id: o.os_id,
        ordem: typeof o.ordem === "number" ? o.ordem : 0,
        dispositivo_marca: texto(o.dispositivo_marca) ?? "",
        dispositivo_modelo: texto(o.dispositivo_modelo) ?? "",
        dispositivo_imei: texto(o.dispositivo_imei),
        dispositivo_numero_serie: texto(o.dispositivo_numero_serie),
        created_at: typeof o.created_at === "string" ? o.created_at : "",
      };
    })
    .filter((l): l is ResumoDispositivoAdicional & { created_at: string } => l !== null)
    .sort(porOrdem);
  for (const { created_at: _c, ...l } of linhas) (mapa[l.os_id] ??= []).push(l);
  return mapa;
}

/**
 * Roda a consulta e devolve `vazio` em QUALQUER falha (erro do PostgREST,
 * tabela ausente, rede, exceção) — sem toast nem console: a tela segue igual.
 */
export async function consultarSemFalhar<T>(
  consulta: () => PromiseLike<{ data: unknown; error: unknown }>,
  ler: (dados: unknown) => T,
  vazio: T,
): Promise<T> {
  try {
    const { data, error } = await consulta();
    return error ? vazio : ler(data);
  } catch {
    return vazio;
  }
}

/** "Dispositivo 2" — `numero` é a posição na OS (1 = o da própria OS). */
export const tituloDispositivo = (numero: number): string => `Dispositivo ${numero}`;

/** Título do 1º adicional é "Dispositivo 2": posição na lista + 2. */
export const numeroAdicional = (indice: number): number => indice + 2;

/** "Apple iPhone 12" (sem espaços sobrando). */
export function marcaModelo(d: { dispositivo_marca?: string | null; dispositivo_modelo?: string | null }): string {
  return [d.dispositivo_marca, d.dispositivo_modelo].filter(Boolean).join(" ");
}

/** "Dispositivo 2 (iPhone 12)" para a linha de serviço com dispositivo_ref; null se o ref não existe. */
export function rotuloDispositivoRef(
  ref: unknown,
  adicionais: readonly { id: string; dispositivo_marca?: string | null; dispositivo_modelo?: string | null }[],
): string | null {
  if (typeof ref !== "string" || ref === "") return null;
  const i = adicionais.findIndex((a) => a.id === ref);
  if (i < 0) return null;
  const a = adicionais[i];
  const nome = a.dispositivo_modelo || a.dispositivo_marca;
  return nome ? `${tituloDispositivo(numeroAdicional(i))} (${nome})` : tituloDispositivo(numeroAdicional(i));
}

/**
 * Nome da linha de serviço com o rótulo do dispositivo:
 * "Formatação — Dispositivo 2 (iPhone 12)". Sem dispositivo_ref (ou ref que
 * não existe mais) sai exatamente nomeLinhaServico — o de hoje.
 */
export function nomeLinhaServicoComDispositivo(
  linha: { nome?: string | null; quantidade?: unknown; dispositivo_ref?: unknown },
  adicionais: readonly { id: string; dispositivo_marca?: string | null; dispositivo_modelo?: string | null }[] | null | undefined,
): string {
  const nome = nomeLinhaServico(linha);
  const rotulo = adicionais && adicionais.length > 0 ? rotuloDispositivoRef(linha.dispositivo_ref, adicionais) : null;
  return rotulo ? `${nome} — ${rotulo}` : nome;
}

/**
 * Texto do dispositivo da OS com os adicionais: "Apple iPhone 11 + Apple iPhone 12".
 * `textoDispositivo1` é o texto que o leitor já monta hoje — sem adicionais
 * ele volta intacto (mesmos espaços).
 */
export function juntarDispositivos(
  textoDispositivo1: string,
  adicionais: readonly { dispositivo_marca?: string | null; dispositivo_modelo?: string | null }[] | null | undefined,
  separador = " + ",
): string {
  if (!adicionais || adicionais.length === 0) return textoDispositivo1;
  return [textoDispositivo1.trim(), ...adicionais.map(marcaModelo)].filter(Boolean).join(separador);
}

/** "+1 aparelho" / "+2 aparelhos"; "" sem adicionais. */
export function seloAdicionais(quantidade: number): string {
  if (!(quantidade > 0)) return "";
  return `+${quantidade} ${quantidade === 1 ? "aparelho" : "aparelhos"}`;
}

/**
 * Busca da lista nos adicionais: IMEI, modelo e marca — os mesmos campos que a
 * busca usa no dispositivo 1 (número de série fica de fora, como no 1º).
 * `termo` já em minúsculas.
 */
export function adicionaisCorrespondemBusca(
  adicionais: readonly ResumoDispositivoAdicional[] | null | undefined,
  termo: string,
): boolean {
  if (!termo || !adicionais) return false;
  return adicionais.some((a) =>
    (a.dispositivo_imei?.toLowerCase() || "").includes(termo) ||
    (a.dispositivo_modelo?.toLowerCase() || "").includes(termo) ||
    (a.dispositivo_marca?.toLowerCase() || "").includes(termo),
  );
}

/** IMEI ou série do adicional (como o dispositivo 1 nas impressões). */
export const imeiOuSerie = (d: { dispositivo_imei: string | null; dispositivo_numero_serie: string | null }): string | null =>
  d.dispositivo_imei || d.dispositivo_numero_serie || null;

/** Coluna "IMEI" da exportação: IMEI/série do dispositivo 1 e dos adicionais, separados por " / ". */
export function juntarImeis(
  imeiDispositivo1: string,
  adicionais: readonly Pick<DispositivoAdicionalOS, "dispositivo_imei" | "dispositivo_numero_serie">[] | null | undefined,
): string {
  if (!adicionais || adicionais.length === 0) return imeiDispositivo1;
  return [imeiDispositivo1, ...adicionais.map(imeiOuSerie)].filter(Boolean).join(" / ");
}
