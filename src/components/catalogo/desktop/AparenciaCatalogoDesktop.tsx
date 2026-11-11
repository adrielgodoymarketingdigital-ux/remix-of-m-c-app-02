// Passo "Aparência" do Catálogo no computador: editor (subabas Templates / Visual / Textos / Opções)
// à esquerda e a prévia à direita a partir de 1280 px; abaixo disso, empilhados.
// Visual, Textos e Opções são os MESMOS painéis do celular (extraídos da ConfiguracaoTemplates sem
// mudar o JSX). Em Opções, o computador esconde os controles que não têm efeito (esconderSemEfeito).
// Tudo mexe no estado da tela (configCatalogo); quem grava é o Salvar do cabeçalho.
import { useState } from "react";
import { Paintbrush, Palette, Settings2, Type } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PainelVisualCatalogo } from "@/components/catalogo/PainelVisualCatalogo";
import { PainelTextosCatalogo } from "@/components/catalogo/PainelTextosCatalogo";
import { PainelOpcoesCatalogo } from "@/components/catalogo/PainelOpcoesCatalogo";
import { escolherTemplate } from "@/lib/catalogo/resumoAparencia";
import { cn } from "@/lib/utils";
import type { ConfiguracaoCatalogo } from "@/types/catalogo";
import type { ItemCatalogo } from "@/types/catalogo-item";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { GradeTemplatesDesktop } from "./GradeTemplatesDesktop";
import { PreviaCatalogoDesktop, type DispositivoPrevia } from "./PreviaCatalogoDesktop";
import { ResumoTemplateDesktop } from "./ResumoTemplateDesktop";

type Subaba = "templates" | "visual" | "textos" | "opcoes";

const SUBABAS: { valor: Subaba; Icone: typeof Palette }[] = [
  { valor: "templates", Icone: Palette },
  { valor: "visual", Icone: Paintbrush },
  { valor: "textos", Icone: Type },
  { valor: "opcoes", Icone: Settings2 },
];

interface AparenciaCatalogoDesktopProps {
  config: ConfiguracaoCatalogo;
  onConfigChange: (config: ConfiguracaoCatalogo) => void;
  /** Itens da prévia (os mesmos da prévia de hoje). */
  itensPrevia: ItemCatalogo[];
  configLoja: ConfiguracaoLoja | null;
  previewDevice: DispositivoPrevia;
  setPreviewDevice: (v: DispositivoPrevia) => void;
}

export function AparenciaCatalogoDesktop(p: AparenciaCatalogoDesktopProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop" });
  const [subaba, setSubaba] = useState<Subaba>("templates");

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="min-w-0 rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
              <Palette className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">{t("aparencia.titulo")}</CardTitle>
              <CardDescription>{t("aparencia.descricao")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={subaba} onValueChange={(v) => setSubaba(v as Subaba)}>
            <TabsList aria-label={t("aparencia.subabasRotulo")} className="grid h-auto w-full grid-cols-4 gap-1 rounded-xl bg-muted/70 p-1 dark:bg-muted/40">
              {SUBABAS.map(({ valor, Icone }) => (
                <TabsTrigger
                  key={valor}
                  value={valor}
                  className={cn(
                    "h-9 gap-1.5 rounded-lg border border-transparent text-sm font-medium text-muted-foreground hover:text-foreground",
                    // Subaba ativa contornada (borda na cor da loja), sem preenchimento forte.
                    "data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm",
                  )}
                >
                  <Icone className="h-4 w-4" aria-hidden="true" />
                  {t(`aparencia.subabas.${valor}`)}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="templates" className="mt-4 space-y-4">
              <GradeTemplatesDesktop templateId={p.config.templateId} onEscolher={(id) => p.onConfigChange(escolherTemplate(p.config, id))} />
              <ResumoTemplateDesktop
                config={p.config}
                logoDaLoja={p.configLoja?.logo_url}
                temWhatsApp={Boolean(p.configLoja?.whatsapp)}
                onIrParaVisual={() => setSubaba("visual")}
              />
            </TabsContent>

            {/* Mesmas classes dos TabsContent da ConfiguracaoTemplates (espaçamento entre os blocos). */}
            <TabsContent value="visual" className="mt-4 space-y-6">
              <PainelVisualCatalogo config={p.config} onConfigChange={p.onConfigChange} />
            </TabsContent>
            <TabsContent value="textos" className="mt-4 space-y-4">
              <PainelTextosCatalogo config={p.config} onConfigChange={p.onConfigChange} />
            </TabsContent>
            <TabsContent value="opcoes" className="mt-4 space-y-4">
              <PainelOpcoesCatalogo config={p.config} onConfigChange={p.onConfigChange} esconderSemEfeito />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <PreviaCatalogoDesktop
        className="min-w-0"
        itens={p.itensPrevia}
        configLoja={p.configLoja}
        config={p.config}
        dispositivo={p.previewDevice}
        onDispositivo={p.setPreviewDevice}
        titulo={t("previa.titulo")}
        descricao={t("previa.descricao")}
        altura={720}
        mostrarAvisoAoVivo
      />
    </div>
  );
}
