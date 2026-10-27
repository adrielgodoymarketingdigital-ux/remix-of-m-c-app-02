/**
 * Rota → chave do namespace "menu": sem a barra inicial, "/" vira "_"
 * ("/configuracoes/fiscal" → "configuracoes_fiscal"). As rotas não têm ".",
 * que é o separador de chaves do i18next.
 */
export function chaveDaRota(url: string): string {
  return url.replace(/^\//, "").replace(/\//g, "_");
}
