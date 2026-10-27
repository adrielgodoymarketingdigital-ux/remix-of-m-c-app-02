import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";
import { i18nVisivelPara } from "@/lib/i18n/visibilidadeI18n";

/**
 * true para quem tem o idioma da conta aplicado. Hoje: só admin. NUNCA
 * consulta: lê o cache "is-admin-mecapp" que o menu lateral já preenche em
 * toda tela do AppLayout (useFiscalVisivel no AppSidebar), então nem abrir uma
 * aba depois de o cache envelhecer gera consulta nova. Enquanto o cache não
 * existe, devolve false (tudo em pt-BR, como sempre). Por isso só deve ser
 * usado dentro do AppLayout. Com I18N_PARA_TODOS a regra nem olha admin.
 * Para mudar quem vê, mexa em src/lib/i18n/visibilidadeI18n.ts, não aqui.
 */
export function useI18nVisivel(): boolean {
  const { data: isAdmin } = useIsAdminMecApp({ enabled: false });
  return i18nVisivelPara({ isAdmin: isAdmin === true });
}
