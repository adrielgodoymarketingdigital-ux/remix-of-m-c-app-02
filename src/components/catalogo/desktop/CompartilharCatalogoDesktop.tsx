// Passo "Compartilhar" do Catálogo no computador: "Baixar PDF" e "Link público" lado a lado a partir
// de 1280 px (empilhados abaixo disso) e a prévia pública embaixo.
// O PDF chama o handleGerarPDF da página (não mexido); a contagem usa o mesmo itensParaPdf.
// O link é rascunho até o Salvar único do cabeçalho; este passo não tem botão de salvar.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FileDown, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LinkCatalogo } from "@/hooks/useLinkCatalogo";
import { resumoPdf } from "@/lib/catalogo/compartilharDesktop";
import type { ConfiguracaoCatalogo } from "@/types/catalogo";
import type { ItemCatalogo } from "@/types/catalogo-item";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { LinkCatalogoDesktop } from "./LinkCatalogoDesktop";
import { PreviaCatalogoDesktop, type DispositivoPrevia } from "./PreviaCatalogoDesktop";

interface CompartilharCatalogoDesktopProps {
  link: LinkCatalogo;
  temLandingPage: boolean;
  /** Itens e seleção da tela: os mesmos que o handleGerarPDF usa. */
  itensCatalogo: ItemCatalogo[];
  selecionados: string[];
  onGerarPDF: () => void;
  gerandoPDF: boolean;
  /** Prévia pública (a mesma da Aparência). */
  itensPrevia: ItemCatalogo[];
  configLoja: ConfiguracaoLoja | null;
  config: ConfiguracaoCatalogo;
  previewDevice: DispositivoPrevia;
  setPreviewDevice: (v: DispositivoPrevia) => void;
}

export function CompartilharCatalogoDesktop(p: CompartilharCatalogoDesktopProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop" });
  const resumo = useMemo(() => resumoPdf(p.itensCatalogo, p.selecionados), [p.itensCatalogo, p.selecionados]);
  const semItens = resumo.entram === 0;

  return (
    <div className="space-y-5">
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="min-w-0 rounded-2xl" data-cartao="pdf">
          <CardHeader className="pb-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                <FileDown className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg">{t("compartilhar.pdfTitulo")}</CardTitle>
                <CardDescription>{t("compartilhar.pdfDescricao")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-2xl font-bold tracking-tight" data-pdf-entram={resumo.entram}>
                {t("compartilhar.pdfEntram", { count: resumo.entram })}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {resumo.comSelecao ? t("compartilhar.pdfBaseSelecao") : t("compartilhar.pdfBaseTodos")}
              </p>
              <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {t("compartilhar.pdfRegraFora")}
                  {resumo.ficamDeFora > 0 && <> {t("compartilhar.pdfFicamDeFora", { count: resumo.ficamDeFora })}</>}
                </span>
              </p>
            </div>

            {semItens && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300" role="status">
                {t("compartilhar.pdfVazio")}
              </p>
            )}

            <Button onClick={p.onGerarPDF} disabled={p.gerandoPDF || semItens} className="h-11 w-full rounded-xl font-semibold">
              {p.gerandoPDF ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {p.gerandoPDF ? t("compartilhar.gerandoPdf") : t("compartilhar.baixarPdf")}
            </Button>
          </CardContent>
        </Card>

        <LinkCatalogoDesktop link={p.link} temLandingPage={p.temLandingPage} className="min-w-0" />
      </div>

      <PreviaCatalogoDesktop
        itens={p.itensPrevia}
        configLoja={p.configLoja}
        config={p.config}
        dispositivo={p.previewDevice}
        onDispositivo={p.setPreviewDevice}
        titulo={t("compartilhar.previaTitulo")}
        descricao={t("compartilhar.previaDescricao")}
        altura={560}
      />
    </div>
  );
}
