/**
 * Números das OS que impedem excluir um cadastro (serviço, tipo de serviço),
 * para o aviso dizer QUAIS são: os `limite` menores em ordem crescente e
 * quantos ficaram de fora ("101, 102, 115 e mais 4"). Só o número da OS;
 * nada do cliente.
 */
export interface NumerosOsBloqueio {
  lista: string;
  restantes: number;
}

const ordemNumerica = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true });

export function resumirNumerosOs(numeros: readonly string[], limite = 10): NumerosOsBloqueio {
  const unicos = [...new Set(numeros.map((n) => n.trim()).filter(Boolean))].sort(ordemNumerica);
  return { lista: unicos.slice(0, limite).join(", "), restantes: Math.max(0, unicos.length - limite) };
}

/** Texto pronto da lista, com "e mais N" pela chave servicos:exclusao.numerosComMais. */
export function textoNumerosOs(
  numeros: readonly string[],
  t: (chave: string, opcoes: Record<string, unknown>) => string,
): string {
  const { lista, restantes } = resumirNumerosOs(numeros);
  return restantes > 0 ? t("exclusao.numerosComMais", { lista, restantes }) : lista;
}
