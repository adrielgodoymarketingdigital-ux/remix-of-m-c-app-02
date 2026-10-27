import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import comumPtBR from "@/locales/pt-BR/comum";
import menuPtBR from "@/locales/pt-BR/menu";
import { IDIOMA_PADRAO, IDIOMAS, type Idioma } from "@/lib/i18n/idiomas";

/**
 * Instância única do i18next. O pt-BR vai EMBUTIDO no pacote principal e a
 * inicialização é síncrona: a primeira renderização já sai em pt-BR, sem
 * requisição e sem piscar. es/en/it ficam um arquivo por idioma e namespace
 * (src/locales/<idioma>/<ns>.ts), cada um num chunk baixado só quando aquele
 * idioma é aplicado (aplicarIdioma) — quem usa pt-BR nunca baixa nenhum.
 */
export const NAMESPACES = ["comum", "menu"] as const;
export type Namespace = (typeof NAMESPACES)[number];

const ARQUIVOS = import.meta.glob<{ default: Record<string, unknown> }>([
  "../../locales/*/*.ts",
  "!../../locales/pt-BR/*.ts",
  "!../../locales/tipos.ts",
]);

const arquivoDe = (idioma: Idioma, ns: Namespace) => ARQUIVOS[`../../locales/${idioma}/${ns}.ts`];

/** pt-BR + os idiomas que já têm algum arquivo de tradução (o seletor só oferece estes). */
export const IDIOMAS_DISPONIVEIS: Idioma[] = IDIOMAS.filter(
  (idioma) => idioma === IDIOMA_PADRAO || NAMESPACES.some((ns) => arquivoDe(idioma, ns)),
);

void i18n.use(initReactI18next).init({
  lng: IDIOMA_PADRAO,
  fallbackLng: IDIOMA_PADRAO,
  supportedLngs: [...IDIOMAS],
  load: "currentOnly",
  ns: [...NAMESPACES],
  defaultNS: "comum",
  resources: { [IDIOMA_PADRAO]: { comum: comumPtBR, menu: menuPtBR } },
  partialBundledLanguages: true,
  initAsync: false,
  // O React já escapa o texto.
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

async function carregarNamespace(idioma: Idioma, ns: Namespace): Promise<void> {
  if (i18n.hasResourceBundle(idioma, ns)) return;
  const arquivo = arquivoDe(idioma, ns);
  // Sem arquivo: o namespace inteiro sai em pt-BR (fallbackLng).
  if (!arquivo) return;
  const { default: textos } = await arquivo();
  i18n.addResourceBundle(idioma, ns, textos, true, true);
}

let ultimaTroca = 0;

/**
 * Baixa (se ainda não baixou) os arquivos do idioma e troca. Duas trocas
 * seguidas: vale a última. Falha ao baixar: fica no idioma atual.
 */
export async function aplicarIdioma(idioma: Idioma): Promise<void> {
  const troca = ++ultimaTroca;
  if (idioma !== IDIOMA_PADRAO) {
    try {
      await Promise.all(NAMESPACES.map((ns) => carregarNamespace(idioma, ns)));
    } catch (erro) {
      console.error(`Erro ao carregar o idioma ${idioma}:`, erro);
      return;
    }
  }
  if (troca !== ultimaTroca) return;
  if (i18n.language !== idioma) await i18n.changeLanguage(idioma);
  // index.html já nasce com lang="pt-BR": só mexe quando muda.
  if (document.documentElement.lang !== idioma) document.documentElement.lang = idioma;
}

export function idiomaAtual(): Idioma {
  return (i18n.language as Idioma) ?? IDIOMA_PADRAO;
}

export default i18n;
