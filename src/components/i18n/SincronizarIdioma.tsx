import { useEffect } from "react";
import { useI18nVisivel } from "@/hooks/useI18nVisivel";
import { useMercado } from "@/hooks/useMercado";
import { aplicarIdioma, idiomaAtual } from "@/lib/i18n/instancia";
import { CHAVE_IDIOMA_LOCAL } from "@/lib/i18n/resolverIdioma";

/**
 * Põe o i18next no idioma da conta (useMercado). Não desenha nada. Fica no
 * AppLayout, junto do menu. Para quem não tem i18n (hoje: não-admin) o idioma
 * é sempre pt-BR, que já é o atual: não faz nada, nem grava no navegador.
 */
export function SincronizarIdioma() {
  const visivel = useI18nVisivel();
  const { idioma } = useMercado();

  useEffect(() => {
    if (idioma === idiomaAtual()) return;
    void aplicarIdioma(idioma);
    if (!visivel) return;
    try {
      localStorage.setItem(CHAVE_IDIOMA_LOCAL, idioma);
    } catch {
      /* navegador sem localStorage: só não lembra antes de o perfil carregar */
    }
  }, [idioma, visivel]);

  return null;
}
