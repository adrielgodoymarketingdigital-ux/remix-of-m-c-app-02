/**
 * Itens da barra de navegação inferior do celular (personalização guardada em
 * localStorage "mobile-nav-items"). Sem dependências (testado com Deno em
 * scripts/testes-menu-compras/).
 */

export const MAX_ITENS_MENU_INFERIOR = 4;

/**
 * Lê o valor salvo (texto JSON) e devolve de 1 a 4 ids: só ids que existem em
 * `idsValidos`, sem repetidos, na ordem salva, cortando nos 4 primeiros. Valor
 * ausente, inválido ou sem nenhum id válido → `padrao`.
 */
export function lerItensMenuInferior(
  valorBruto: string | null | undefined,
  idsValidos: readonly string[],
  padrao: readonly string[],
): string[] {
  if (!valorBruto) return [...padrao];
  let lista: unknown;
  try {
    lista = JSON.parse(valorBruto);
  } catch {
    return [...padrao];
  }
  if (!Array.isArray(lista)) return [...padrao];

  const validos = new Set(idsValidos);
  const itens: string[] = [];
  for (const id of lista) {
    if (typeof id !== "string" || !validos.has(id) || itens.includes(id)) continue;
    itens.push(id);
    if (itens.length === MAX_ITENS_MENU_INFERIOR) break;
  }
  return itens.length > 0 ? itens : [...padrao];
}
