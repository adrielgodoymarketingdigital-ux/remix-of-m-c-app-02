/**
 * "Minhas garantias" — FASE B: a garantia escolhida na venda de um aparelho.
 * Regras puras (sem React), testadas em scripts/testes-garantias-venda/.
 *
 *  - escolhaDeGarantia / escolhaPersonalizada: o que o seletor entrega ao PDV
 *    (id, nome, prazo e texto do termo).
 *  - preSelecionarGarantia: a opção que já vem marcada, pelo prazo cadastrado
 *    no aparelho (dispositivo.garantia + tempo_garantia). Sem garantia_padrao_id
 *    (fase D).
 *  - congelarTextosDaVenda: grava (ou reaproveita) UM texto congelado por texto
 *    distinto da venda, em nome do DONO; NUNCA altera nem apaga; se falhar, a
 *    venda segue (o item fica sem garantia_texto_id e o PDV avisa).
 *  - camposGarantiaVenda: as colunas extras da linha de vendas. Item sem
 *    escolha nova (fluxo antigo) → {} : a linha fica idêntica à de antes.
 */
import { formatarMesesGarantiaTexto } from "./previa.ts";
import { textoPadraoGarantia } from "./textoPadrao.ts";
import type { GarantiaExibida } from "./garantias.ts";
import { md5Hex } from "./md5.ts";

export const MESES_MAX_VENDA = 120;

export interface EscolhaGarantia {
  /** id em garantias_loja; null = padrão virtual ou personalizada. */
  garantia_id: string | null;
  nome: string;
  meses: number;
  /** Texto (modelo, com {{variáveis}}) do termo da garantia. */
  texto: string | null;
  tipo: "loja" | "virtual" | "personalizada";
}

/** Item do carrinho visto pela gravação (só o que importa aqui). */
export interface ItemComGarantia {
  tipo: string;
  garantia_escolhida?: EscolhaGarantia | null;
}

export const OPCAO_PERSONALIZADA = "__personalizada__";

/** Opção de garantia da loja (ou padrão virtual) → escolha. */
export function escolhaDeGarantia(g: GarantiaExibida): EscolhaGarantia {
  return {
    garantia_id: g.virtual ? null : g.id,
    nome: g.nome,
    meses: g.meses,
    texto: g.texto,
    tipo: g.virtual ? "virtual" : "loja",
  };
}

/** Prazo digitado à mão; texto padrão da lib para o prazo. null = prazo inválido. */
export function escolhaPersonalizada(meses: number): EscolhaGarantia | null {
  if (!Number.isInteger(meses) || meses < 0 || meses > MESES_MAX_VENDA) return null;
  return {
    garantia_id: null,
    nome: meses > 0 ? `Personalizada (${formatarMesesGarantiaTexto(meses)})` : "Sem garantia",
    meses,
    texto: textoPadraoGarantia(meses),
    tipo: "personalizada",
  };
}

export type PreSelecao = { tipo: "garantia"; chave: string } | { tipo: "personalizada"; meses: number };

/**
 * Prazo do aparelho: com garantia e tempo > 0 → esse prazo; senão 0 (sem garantia).
 * A 1ª garantia ATIVA com o mesmo prazo, na ordem da lista; nenhuma → personalizada.
 */
export function preSelecionarGarantia(
  lista: readonly GarantiaExibida[],
  dispositivo: { garantia?: boolean | null; tempo_garantia?: number | null },
): PreSelecao {
  const t = dispositivo.tempo_garantia;
  const alvo = dispositivo.garantia && typeof t === "number" && t > 0 ? Math.min(Math.trunc(t), MESES_MAX_VENDA) : 0;
  const achada = lista.find((g) => g.ativo && g.meses === alvo);
  return achada ? { tipo: "garantia", chave: achada.chave } : { tipo: "personalizada", meses: alvo };
}

/** Confere uma escolha vinda de fora (ex.: state da navegação do cartão para o PDV). */
export function escolhaGarantiaValida(x: unknown): x is EscolhaGarantia {
  if (typeof x !== "object" || x === null) return false;
  const e = x as Record<string, unknown>;
  return (
    (e.garantia_id === null || typeof e.garantia_id === "string") &&
    typeof e.nome === "string" && e.nome.trim().length > 0 && [...e.nome].length <= 80 &&
    typeof e.meses === "number" && Number.isInteger(e.meses) && e.meses >= 0 && e.meses <= MESES_MAX_VENDA &&
    (e.texto === null || typeof e.texto === "string") &&
    (e.tipo === "loja" || e.tipo === "virtual" || e.tipo === "personalizada")
  );
}

/** Só aparelho com escolha nova, prazo > 0 e texto tem texto a congelar. */
export function textoACongelar(item: ItemComGarantia): string | null {
  const e = item.garantia_escolhida;
  if (item.tipo !== "dispositivo" || !e) return null;
  if (e.meses <= 0) return null; // "Sem garantia": nada de texto congelado
  return e.texto && e.texto.trim() ? e.texto : null;
}

// ── Gravação do texto congelado ─────────────────────────────────────────────

/** Acesso a garantias_textos_venda (o PDV usa o do Supabase; os testes, um simulado). */
export interface RepositorioTextosVenda {
  /** Texto do dono com esse md5, ou null. */
  buscar(userId: string, md5: string): Promise<{ id: string; texto: string } | null>;
  /** INSERT; erro com `code` "23505" = já existe (corrida). Nunca UPDATE/DELETE. */
  inserir(userId: string, texto: string): Promise<{ id: string }>;
}

/** Id do texto congelado do dono: reaproveita se já existe, senão cria. */
export async function obterOuCriarTextoCongelado(repo: RepositorioTextosVenda, userId: string, texto: string): Promise<string> {
  const md5 = md5Hex(texto);
  const existente = await repo.buscar(userId, md5);
  if (existente) {
    if (existente.texto !== texto) throw new Error("texto congelado com o mesmo md5 e conteúdo diferente");
    return existente.id;
  }
  try {
    return (await repo.inserir(userId, texto)).id;
  } catch (erro) {
    // Outra venda gravou o mesmo texto entre a busca e o insert: reaproveita.
    if ((erro as { code?: string })?.code === "23505") {
      const agora = await repo.buscar(userId, md5);
      if (agora && agora.texto === texto) return agora.id;
    }
    throw erro;
  }
}

export interface ResultadoTextosVenda {
  /** garantia_texto_id de cada item do carrinho (mesma ordem); null = sem texto. */
  textoIdPorItem: (string | null)[];
  /** Itens com texto a congelar que ficaram SEM o texto (a venda segue). */
  falhas: number;
}

/**
 * Um texto congelado por texto distinto da venda (itens e parcelas com o mesmo
 * texto compartilham o id), em nome do DONO da venda (userIdDono). Nunca lança:
 * erro num item → null para ele e `falhas` + 1. Sem nenhum item com escolha
 * nova → nenhuma chamada ao banco.
 */
export async function congelarTextosDaVenda(
  repo: RepositorioTextosVenda,
  userIdDono: string,
  itens: readonly ItemComGarantia[],
): Promise<ResultadoTextosVenda> {
  const porTexto = new Map<string, Promise<string>>();
  const textoIdPorItem: (string | null)[] = [];
  let falhas = 0;
  for (const item of itens) {
    const texto = textoACongelar(item);
    if (!texto) {
      textoIdPorItem.push(null);
      continue;
    }
    if (!porTexto.has(texto)) porTexto.set(texto, obterOuCriarTextoCongelado(repo, userIdDono, texto));
    try {
      textoIdPorItem.push(await porTexto.get(texto)!);
    } catch (erro) {
      console.error("[garantias] texto congelado não gravado; a venda segue sem ele", erro);
      textoIdPorItem.push(null);
      falhas++;
    }
  }
  return { textoIdPorItem, falhas };
}

/**
 * Colunas de garantia da linha de vendas. Fluxo antigo (sem escolha) ou item
 * que não é aparelho → {} (a linha fica exatamente como antes).
 * tempo_garantia legado continua: meses se > 0, senão null.
 */
export function camposGarantiaVenda(item: ItemComGarantia, textoId: string | null | undefined): Record<string, string | number | null> {
  const e = item.garantia_escolhida;
  if (item.tipo !== "dispositivo" || !e) return {};
  return {
    garantia_id: e.garantia_id,
    garantia_nome: e.nome,
    garantia_meses: e.meses,
    garantia_texto_id: e.meses > 0 ? textoId ?? null : null,
    tempo_garantia: e.meses > 0 ? e.meses : null,
  };
}
