// Grade dos templates do Catálogo no computador (passo Aparência → Templates).
// Os templates e as cores vêm de TEMPLATES_PADRAO; ids e nomes salvos não mudam (o nome só é
// traduzido na tela, com o do template como reserva). A miniatura é desenhada em CSS.
import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TEMPLATES_PADRAO, type TemplatesCatalogo } from "@/types/catalogo";
import { coresDoTemplate, templateEmUso } from "@/lib/catalogo/resumoAparencia";
import { proximoIndiceRadio } from "@/lib/catalogo/navegacaoRadio";
import { cn } from "@/lib/utils";

/** Miniatura: degradê das cores do template + um celular desenhado com a "tela" do catálogo. */
export function MiniaturaTemplate({ template, className }: { template: TemplatesCatalogo; className?: string }) {
  const { primaria, secundaria, fundo, texto, destaque } = template.cores;
  return (
    <div
      aria-hidden="true"
      className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-black/5 dark:ring-white/10", className)}
      style={{ background: `linear-gradient(135deg, ${primaria} 0%, ${secundaria} 100%)` }}
    >
      {/* brilho */}
      <div className="absolute -right-4 -top-6 h-16 w-16 rounded-full bg-white/20 blur-md" />
      {/* aparelho */}
      <div className="relative h-[72%] w-[44%] rotate-[-8deg] rounded-[9px] bg-neutral-900 p-[3px] shadow-lg shadow-black/30">
        <div className="flex h-full w-full flex-col gap-[3px] overflow-hidden rounded-[6px] p-[3px]" style={{ backgroundColor: fundo }}>
          <div className="h-[22%] rounded-[3px]" style={{ backgroundColor: primaria }} />
          <div className="grid flex-1 grid-cols-2 gap-[3px]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col justify-end gap-[2px] rounded-[2px] p-[2px]" style={{ backgroundColor: `${texto}14` }}>
                <div className="h-[2px] w-3/4 rounded-full" style={{ backgroundColor: `${texto}66` }} />
                <div className="h-[2px] w-1/2 rounded-full" style={{ backgroundColor: i % 2 ? destaque : primaria }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BolinhasCores({ cores, className }: { cores: string[]; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-hidden="true">
      {cores.map((cor, i) => (
        <span key={`${cor}-${i}`} className="h-4 w-4 rounded-full ring-1 ring-black/10 dark:ring-white/20" style={{ backgroundColor: cor }} />
      ))}
    </div>
  );
}

interface GradeTemplatesDesktopProps {
  templateId: string | undefined;
  onEscolher: (templateId: string) => void;
}

export function GradeTemplatesDesktop({ templateId, onEscolher }: GradeTemplatesDesktopProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop.aparencia" });
  // Mesma regra do CatalogoOnline: id desconhecido usa o primeiro template.
  const emUso = templateEmUso(TEMPLATES_PADRAO, templateId).id;

  // Padrão "radio": um só ponto de Tab (o escolhido); as setas andam e escolhem.
  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    const atual = TEMPLATES_PADRAO.findIndex((tp) => tp.id === emUso);
    const proximo = proximoIndiceRadio(e.key, atual, TEMPLATES_PADRAO.length);
    if (proximo === null) return;
    e.preventDefault();
    const id = TEMPLATES_PADRAO[proximo].id;
    onEscolher(id);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-template="${id}"]`)?.focus();
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("escolhaTemplate")}</p>
      <div role="radiogroup" aria-label={t("escolhaTemplate")} onKeyDown={teclado} className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-2">
        {TEMPLATES_PADRAO.map((template) => {
          const ativo = template.id === emUso;
          return (
            <button
              key={template.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              tabIndex={ativo ? 0 : -1}
              data-template={template.id}
              onClick={() => onEscolher(template.id)}
              className={cn(
                "relative flex min-w-0 items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-all",
                "hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                ativo ? "border-primary ring-2 ring-primary/25" : "border-border",
              )}
            >
              <MiniaturaTemplate template={template} className="h-16 w-16 2xl:h-[72px] 2xl:w-[72px]" />
              <div className="min-w-0 flex-1 space-y-1.5 pr-5">
                <p className="break-words text-sm font-semibold leading-tight">{t(`templates.${template.id}.nome`, { defaultValue: template.nome })}</p>
                <BolinhasCores cores={coresDoTemplate(template)} />
                <p className="text-xs leading-4 text-muted-foreground">
                  {t(`templates.${template.id}.descricao`, { defaultValue: template.descricao })}
                </p>
              </div>
              {ativo && (
                <span
                  className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-md bg-primary text-primary-foreground"
                  title={t("selecionado")}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">{t("selecionado")}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
