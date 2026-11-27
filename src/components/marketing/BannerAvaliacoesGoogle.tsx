import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";

/**
 * Banner da seção Avaliações no Google. A nota à direita é só ILUSTRAÇÃO
 * (aria-hidden, com o selo "Exemplo"): não é a nota real da loja.
 * Sem logotipo do Google (não há asset no repositório): usa uma estrela.
 */
export function BannerAvaliacoesGoogle() {
  const { t } = useTranslation("marketing");

  return (
    <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-primary/10 via-primary/5 to-card shadow-sm">
      <div className="flex items-center gap-4 p-4 sm:gap-5 sm:p-6 md:pr-[340px]">
        <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-card shadow-sm sm:flex">
          <Star className="h-7 w-7 fill-amber-400 text-amber-400" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">{t("banner.titulo")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("banner.descricao")}</p>
        </div>
      </div>

      {/* Ilustração decorativa (dados fictícios). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-6 hidden w-[310px] items-center md:flex">
        <div className="-rotate-2 rounded-2xl border bg-card px-4 py-3 shadow-lg">
          <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("banner.exemplo")}
          </span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold">{t("banner.notaExemplo")}</span>
            <span className="flex">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
              ))}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t("banner.totalExemplo")}</p>
        </div>
        <svg viewBox="0 0 100 60" className="ml-1 h-16 w-24 text-primary" fill="none">
          <path
            d="M4 52 C 22 54, 30 30, 46 36 S 70 26, 88 10"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path d="M72 8 L92 6 L88 26" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  );
}
