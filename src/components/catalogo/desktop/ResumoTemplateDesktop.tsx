// Resumo do template escolhido (passo Aparência → Templates, no computador): só o que o catálogo
// online realmente aplica (4 cores, cabeçalho, cartões, logo e o botão de compra do WhatsApp).
import { Paintbrush } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { TEMPLATES_PADRAO, type ConfiguracaoCatalogo } from "@/types/catalogo";
import { cabecalhoEmUso, cartoesEmUso, coresEmUso, logoEmUso, templateEmUso } from "@/lib/catalogo/resumoAparencia";
import { MiniaturaTemplate } from "./GradeTemplatesDesktop";

interface ResumoTemplateDesktopProps {
  config: ConfiguracaoCatalogo;
  logoDaLoja: string | null | undefined;
  temWhatsApp: boolean;
  onIrParaVisual: () => void;
}

export function ResumoTemplateDesktop({ config, logoDaLoja, temWhatsApp, onIrParaVisual }: ResumoTemplateDesktopProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop.aparencia" });
  const template = templateEmUso(TEMPLATES_PADRAO, config.templateId);
  const nome = t(`templates.${template.id}.nome`, { defaultValue: template.nome });
  const cores = coresEmUso(TEMPLATES_PADRAO, config);
  const cartoes = cartoesEmUso(config);
  const textoBotao = config.textoBotaoWhatsApp || "WhatsApp";

  const linha = (rotulo: string, valor: string) => (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{rotulo}</dt>
      <dd className="min-w-0 break-words text-right font-medium">
        {valor}
      </dd>
    </div>
  );

  return (
    <section aria-label={t("resumo.titulo", { nome })} className="rounded-2xl border bg-muted/40 p-4 dark:bg-muted/20">
      <div className="flex flex-wrap items-start gap-3">
        <MiniaturaTemplate template={template} className="h-12 w-12" />
        <div className="min-w-0 flex-1 basis-48">
          <h3 className="break-words text-sm font-semibold">{t("resumo.titulo", { nome })}</h3>
          <p className="text-xs text-muted-foreground">{t("resumo.descricao")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onIrParaVisual}>
          <Paintbrush className="h-3.5 w-3.5" aria-hidden="true" />
          {t("resumo.editarVisual")}
        </Button>
      </div>

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("resumo.cores")}</p>
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {cores.map((c) => (
          <li key={c.chave} className="flex min-w-0 items-center gap-2 rounded-xl border bg-card px-2.5 py-2" data-cor={c.chave}>
            <span className="h-6 w-6 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20" style={{ backgroundColor: c.hex }} aria-hidden="true" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-medium">{t(`resumo.cor.${c.chave}`)}</p>
              <p className="font-mono text-[11px] uppercase text-muted-foreground">{c.hex}</p>
              <p className={c.personalizada ? "text-[11px] font-medium text-primary" : "text-[11px] text-muted-foreground"}>
                {c.personalizada ? t("resumo.personalizada") : t("resumo.doTemplate")}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <dl className="mt-3 divide-y divide-border/60">
        {linha(t("resumo.cabecalho"), t(`resumo.estiloCabecalho.${cabecalhoEmUso(config)}`))}
        {linha(
          t("resumo.cartoes"),
          [t(`resumo.borda.${cartoes.borda}`), t(`resumo.sombra.${cartoes.sombra}`), t(`resumo.espacamento.${cartoes.espacamento}`)].join(", "),
        )}
        {linha(t("resumo.logo"), t(`resumo.logoValor.${logoEmUso(config, logoDaLoja)}`))}
        {linha(t("resumo.botao"), temWhatsApp ? t("resumo.botaoValor", { texto: textoBotao }) : t("resumo.botaoSemWhatsApp"))}
      </dl>
    </section>
  );
}
