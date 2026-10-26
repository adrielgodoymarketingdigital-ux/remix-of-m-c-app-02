import { IDIOMA_PADRAO, normalizarIdioma, type Idioma } from "./idiomas";

/**
 * Subdomínio → idioma (ex.: { es: "es" } faz es.appmec.in abrir em espanhol).
 * Vazio = nenhum subdomínio configurado, e o hostname é ignorado.
 */
export const SUBDOMINIOS_IDIOMA: Record<string, Idioma> = {};

/**
 * Domínio principal: sem preferência salva (perfil, ?lang=, localStorage) é
 * sempre pt-BR — o idioma do navegador não conta aqui, só em outros endereços.
 */
export const DOMINIOS_PRINCIPAIS = ["appmec.in", "www.appmec.in"];

/** Chave do localStorage com a última escolha de idioma neste navegador. */
export const CHAVE_IDIOMA_LOCAL = "mecapp_idioma";

export interface FontesIdioma {
  /** profiles.idioma do usuário logado (undefined = sem login ou perfil não lido). */
  perfil?: string | null;
  /** window.location.hostname */
  hostname?: string | null;
  /** valor de ?lang= */
  parametroLang?: string | null;
  /** localStorage[CHAVE_IDIOMA_LOCAL] */
  armazenado?: string | null;
  /** navigator.languages (ou [navigator.language]) */
  navegador?: readonly string[] | null;
  subdominios?: Record<string, Idioma>;
  dominiosPrincipais?: readonly string[];
}

function idiomaDoSubdominio(hostname: string | null | undefined, subdominios: Record<string, Idioma>): Idioma | null {
  if (!hostname) return null;
  const partes = hostname.toLowerCase().split(".");
  // "es.appmec.in" tem 3 partes; "appmec.in" e "localhost" não têm subdomínio.
  if (partes.length < 3) return null;
  return subdominios[partes[0]] ?? null;
}

/**
 * Idioma a usar, nesta ordem: perfil do usuário logado; subdomínio
 * configurado; ?lang=; localStorage; idiomas do navegador (fora do domínio
 * principal); pt-BR. Valor desconhecido numa fonte passa para a próxima.
 *
 * Só vale para quem i18nVisivelPara libera — para os demais o app nem chama
 * isto e fica em pt-BR.
 */
export function resolverIdioma(fontes: FontesIdioma): Idioma {
  const subdominios = fontes.subdominios ?? SUBDOMINIOS_IDIOMA;
  const principal = (fontes.dominiosPrincipais ?? DOMINIOS_PRINCIPAIS).includes((fontes.hostname ?? "").toLowerCase());
  const navegador = principal ? [] : fontes.navegador ?? [];
  return (
    normalizarIdioma(fontes.perfil) ??
    idiomaDoSubdominio(fontes.hostname, subdominios) ??
    normalizarIdioma(fontes.parametroLang) ??
    normalizarIdioma(fontes.armazenado) ??
    navegador.map(normalizarIdioma).find((i): i is Idioma => i !== null) ??
    IDIOMA_PADRAO
  );
}
