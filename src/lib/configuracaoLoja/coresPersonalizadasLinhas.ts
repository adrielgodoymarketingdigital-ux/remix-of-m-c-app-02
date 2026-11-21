/**
 * Gravação de configuracoes_loja.cores_personalizadas LINHA A LINHA.
 *
 * O dono com filial tem várias linhas em configuracoes_loja (matriz + uma por
 * filial). A tela de Cores lia com .single(), que falha com mais de uma linha
 * (PGRST116), e gravava { ...{}, ...cores } em TODAS as linhas — apagando
 * tracking_config (página de acompanhamento) e qualquer outra chave. Aqui cada
 * linha do dono é lida (id + cores_personalizadas), mesclada com o próprio
 * valor e gravada pelo id. Dono sem filial (uma linha): mesmo valor final de
 * antes. Erro de leitura agora interrompe (antes gravava sobre {}).
 *
 * As funções de mescla são puras: recebem o valor atual de UMA linha e
 * devolvem o novo (null = coluna nula, como o "Resetar" já fazia).
 */
import { CHAVE_COR_CABECALHO_RECIBO, normalizarCorHex } from "../recibo/corCabecalhoRecibo.ts";

export type ValorCores = Record<string, unknown>;
export type Mescla = (atual: ValorCores) => ValorCores | null;

/** Chaves das cores do app (dashboard) — as únicas que "Resetar para Padrão" remove. */
export const CHAVES_CORES_APP = [
  "primary_from",
  "primary_via",
  "primary_to",
  "card_faturamento_from",
  "card_faturamento_via",
  "card_faturamento_to",
] as const;

/** Valor da coluna como objeto (null, lista ou outro tipo → {}). */
export function comoObjeto(valor: unknown): ValorCores {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? { ...(valor as ValorCores) } : {};
}

const semChaves = (atual: ValorCores, chaves: readonly string[]): ValorCores | null => {
  const resto = { ...atual };
  for (const c of chaves) delete resto[c];
  return Object.keys(resto).length > 0 ? resto : null;
};

/** Salvar cores do app: as cores por cima do que a linha já tem (igual ao de antes). */
export const mesclarCoresApp = (cores: ValorCores): Mescla => (atual) => ({ ...atual, ...cores });

/** Resetar cores do app: tira só as 6 chaves do app; sobrou nada → null (igual ao de antes). */
export const removerCoresApp: Mescla = (atual) => semChaves(atual, CHAVES_CORES_APP);

/** Salvar a cor do cabeçalho dos recibos (só hex válido). */
export function definirCorRecibo(cor: string): Mescla {
  const hex = normalizarCorHex(cor);
  if (!hex) throw new Error("Cor inválida");
  return (atual) => ({ ...atual, [CHAVE_COR_CABECALHO_RECIBO]: hex });
}

/** "Voltar ao azul padrão": REMOVE a chave (nunca grava o azul); sobrou nada → null. */
export const removerCorRecibo: Mescla = (atual) => semChaves(atual, [CHAVE_COR_CABECALHO_RECIBO]);

export interface LinhaCores {
  id: string;
  empresa_id?: string | null;
  cores_personalizadas: unknown;
}

/** Linha que a tela mostra: a da matriz (empresa_id nulo); sem ela, a primeira. */
export function linhaDeReferencia<T extends { empresa_id?: string | null }>(linhas: T[] | null | undefined): T | null {
  if (!linhas?.length) return null;
  return linhas.find((l) => l.empresa_id == null) ?? linhas[0];
}

// Cliente mínimo (o supabase-js real ou um simulado nos testes).
interface ResultadoSupabase<T> {
  data: T | null;
  error: unknown;
}
export interface ClienteCores {
  from(tabela: "configuracoes_loja"): {
    select(colunas: string): { eq(coluna: string, valor: string): PromiseLike<ResultadoSupabase<LinhaCores[]>> };
    update(valores: { cores_personalizadas: ValorCores | null }): { eq(coluna: string, valor: string): PromiseLike<ResultadoSupabase<unknown>> };
  };
}

/**
 * Aplica `mescla` em cada linha do dono (matriz e filiais), pelo id.
 * Devolve quantas linhas foram gravadas (0 = o usuário não tem linha).
 */
export async function gravarCoresPorLinha(cliente: ClienteCores, userId: string, mescla: Mescla): Promise<number> {
  const { data, error } = await cliente.from("configuracoes_loja").select("id, cores_personalizadas").eq("user_id", userId);
  if (error) throw error;
  const linhas = data ?? [];
  for (const linha of linhas) {
    const novo = mescla(comoObjeto(linha.cores_personalizadas));
    const { error: erroGravar } = await cliente.from("configuracoes_loja").update({ cores_personalizadas: novo }).eq("id", linha.id);
    if (erroGravar) throw erroGravar;
  }
  return linhas.length;
}
