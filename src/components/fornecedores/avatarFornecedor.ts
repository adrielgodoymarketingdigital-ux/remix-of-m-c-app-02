// Avatar da lista de fornecedores no computador: iniciais e cor fixa por fornecedor.
// Função pura, sem dado novo: a cor sai de um hash da chave (ID) e as iniciais do nome.

/** Pares fundo/texto que funcionam no tema claro e no escuro (mesmo padrão das outras telas). */
export const CORES_AVATAR_FORNECEDOR = [
  "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  "bg-teal-500/10 text-teal-700 dark:text-teal-300",
] as const;

const CONECTIVOS = new Set(["de", "da", "do", "das", "dos", "e"]);
const PRIMEIRA_LETRA = /[\p{L}\p{N}]/u;

/** Iniciais do nome: 1ª letra da primeira e da última palavra; com uma palavra só, as duas primeiras letras. */
export function iniciaisFornecedor(nome: string | null | undefined): string {
  const palavras = (nome ?? "")
    .split(/\s+/)
    .map((p) => Array.from(p).filter((c) => PRIMEIRA_LETRA.test(c)).join(""))
    .filter((p) => p.length > 0);
  const significativas = palavras.filter((p) => !CONECTIVOS.has(p.toLocaleLowerCase("pt-BR")));
  const usadas = significativas.length > 0 ? significativas : palavras;
  if (usadas.length === 0) return "?";
  const iniciais =
    usadas.length === 1
      ? Array.from(usadas[0]).slice(0, 2).join("")
      : Array.from(usadas[0])[0] + Array.from(usadas[usadas.length - 1])[0];
  return iniciais.toLocaleUpperCase("pt-BR");
}

/** Índice fixo da cor para a chave (FNV-1a 32 bits). A mesma chave dá sempre a mesma cor. */
export function indiceCorAvatar(chave: string | null | undefined): number {
  let hash = 0x811c9dc5;
  for (const c of chave ?? "") {
    hash ^= c.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % CORES_AVATAR_FORNECEDOR.length;
}

export function avatarFornecedor(chave: string | null | undefined, nome: string | null | undefined) {
  return {
    iniciais: iniciaisFornecedor(nome),
    classes: CORES_AVATAR_FORNECEDOR[indiceCorAvatar(chave || nome)],
  };
}
