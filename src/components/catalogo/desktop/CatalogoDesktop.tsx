// Tela Catálogo no computador (>= 1024px): cabeçalho, passos (Itens → Aparência → Compartilhar,
// + Landing Page com o módulo) e o Salvar único (catalogo_config + link + publicação).
// Recebe o MESMO estado e as MESMAS funções da página (CatalogoDispositivos); celular e tablet
// seguem com o JSX antigo da página, intocado.
// F1: o conteúdo de cada passo reaproveita os componentes de hoje, sem alterá-los. As fases
// F2 (Itens), F3 (Aparência) e F4 (Compartilhar) trocam esses conteúdos depois.
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FileDown, Globe, Loader2, Monitor, Pencil, Save, Smartphone, Tablet } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SeletorDispositivosCatalogo } from "@/components/catalogo/SeletorDispositivosCatalogo";
import { GerenciadorCategoriasCatalogo } from "@/components/catalogo/GerenciadorCategoriasCatalogo";
import { CatalogoOnline } from "@/components/catalogo/CatalogoOnline";
import { ConfiguracaoTemplates } from "@/components/catalogo/ConfiguracaoTemplates";
import { GerenciadorLinkLandingPage } from "@/components/catalogo/GerenciadorLinkLandingPage";
import { ConfiguracaoLandingPage as ConfigLPComponent } from "@/components/catalogo/ConfiguracaoLandingPage";
import { LandingPagePreview } from "@/components/catalogo/LandingPagePreview";
import { toast } from "@/hooks/use-toast";
import { useLinkCatalogo, type ResultadoSalvarCatalogo } from "@/hooks/useLinkCatalogo";
import { assinaturaEstado, temAlteracoes } from "@/lib/catalogo/alteracoesNaoSalvas";
import { sanitizarCategoriasCatalogo, sanitizarSelecaoCatalogo } from "@/lib/catalogo-selection";
import { CONFIG_PADRAO, type ConfiguracaoCatalogo, type ConfiguracaoLandingPage } from "@/types/catalogo";
import type { ItemCatalogo } from "@/types/catalogo-item";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import type { Dispositivo } from "@/types/dispositivo";
import { BarraSalvarCatalogo } from "./BarraSalvarCatalogo";
import { CabecalhoCatalogoDesktop, type PassoCatalogo } from "./CabecalhoCatalogoDesktop";
import { LinkCatalogoDesktop } from "./LinkCatalogoDesktop";

export type DispositivoPrevia = "mobile" | "tablet" | "desktop";

type DadosItem = { fotos: string[]; preco: number | null; precoPromocional: number | null };

export interface CatalogoDesktopProps {
  loading: boolean;
  temAcessoLandingPage: boolean;
  dispositivos: Dispositivo[];
  configLoja: ConfiguracaoLoja | null;
  itensCatalogo: ItemCatalogo[];
  itensSelecionados: ItemCatalogo[];
  selecionados: string[];
  onSelecaoChange: (ids: string[]) => void;
  onToggleExibirNoCatalogo: (item: ItemCatalogo) => void;
  atualizandoVisibilidade: Set<string>;
  configCatalogo: ConfiguracaoCatalogo;
  setConfigCatalogo: Dispatch<SetStateAction<ConfiguracaoCatalogo>>;
  modoEdicao: boolean;
  setModoEdicao: (v: boolean) => void;
  previewDevice: DispositivoPrevia;
  setPreviewDevice: (v: DispositivoPrevia) => void;
  onAtualizarItem: (id: string, tipoItem: string, dados: DadosItem) => Promise<void>;
  onGerarPDF: () => void;
  gerandoPDF: boolean;
  configLP: ConfiguracaoLandingPage;
  setConfigLP: Dispatch<SetStateAction<ConfiguracaoLandingPage>>;
  onConfigLPChange: (c: ConfiguracaoLandingPage) => void;
  lpAlterada: boolean;
  salvandoLP: boolean;
  onSalvarLP: () => void;
}

/**
 * Como a página deixa o catalogo_config depois de carregar: CONFIG_PADRAO + o salvo e, havendo
 * itens, a seleção e as categorias limpas dos ids que sumiram (mesmas funções e mesma condição
 * de CatalogoDispositivos). É a base do "Alterações não salvas".
 */
function configComoNaTela(salva: Record<string, unknown> | null, idsDisponiveis: string[]): ConfiguracaoCatalogo {
  const base = salva ? ({ ...CONFIG_PADRAO, ...salva } as ConfiguracaoCatalogo) : CONFIG_PADRAO;
  if (idsDisponiveis.length === 0) return base;
  const { idsValidos } = sanitizarSelecaoCatalogo(base.itensSelecionadosIds, idsDisponiveis);
  return {
    ...base,
    itensSelecionadosIds: idsValidos,
    categoriasCatalogo: sanitizarCategoriasCatalogo(base.categoriasCatalogo, idsDisponiveis),
  };
}

const LARGURA_PREVIA: Record<DispositivoPrevia, string> = { mobile: "375px", tablet: "768px", desktop: "100%" };

export function CatalogoDesktop(p: CatalogoDesktopProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop" });
  const link = useLinkCatalogo();
  const [passo, setPasso] = useState<PassoCatalogo>("itens");
  const [passoPendente, setPassoPendente] = useState<PassoCatalogo | null>(null);

  // ---------- Alterações não salvas ----------
  const idsDisponiveis = useMemo(() => p.itensCatalogo.map((i) => i.id), [p.itensCatalogo]);
  const assinaturaBase = useMemo(
    () =>
      link.carregado
        ? assinaturaEstado({ catalogo: configComoNaTela(link.configSalva, idsDisponiveis), slug: link.slugSalvo, ativo: link.ativoSalvo })
        : null,
    [link.carregado, link.configSalva, link.slugSalvo, link.ativoSalvo, idsDisponiveis],
  );
  const estadoAtual = { catalogo: p.configCatalogo, slug: link.slug, ativo: link.ativo };
  const assinaturaAtual = assinaturaEstado(estadoAtual);
  // A página e este hook leem o banco cada um por conta própria. Até a tela "alcançar" o que está
  // salvo pela primeira vez, nada conta como alteração (evita o selo piscar ao abrir).
  const [sincronizado, setSincronizado] = useState(false);
  useEffect(() => {
    if (!sincronizado && assinaturaBase !== null && assinaturaBase === assinaturaAtual) setSincronizado(true);
  }, [sincronizado, assinaturaBase, assinaturaAtual]);
  const alterado = sincronizado && temAlteracoes(assinaturaBase, estadoAtual);

  // Fechar ou recarregar a aba com algo por salvar (o clique no menu lateral não dá para barrar).
  const avisarAoSair = alterado || p.lpAlterada;
  useEffect(() => {
    if (!avisarAoSair) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [avisarAoSair]);

  // ---------- Salvar único ----------
  const mensagemErro = (motivo: Exclude<ResultadoSalvarCatalogo, { ok: true }>["motivo"]) => {
    switch (motivo) {
      case "sem_permissao":
        return t("salvar.erroSemPermissao");
      case "link_curto":
        return t("salvar.erroLinkCurto");
      case "link_em_uso":
        return t("salvar.erroLinkEmUso");
      case "conferindo_link":
        return t("salvar.erroConferindoLink");
      case "publicar_sem_link":
        return t("salvar.erroPublicarSemLink");
      default:
        return t("salvar.erroGenerico");
    }
  };

  const salvar = async (): Promise<boolean> => {
    const resultado = await link.salvar(p.configCatalogo);
    // "in" e não "ok": sem strictNullChecks o TS não estreita a união pelo booleano.
    if ("motivo" in resultado) {
      toast({ title: t("salvar.erroTitulo"), description: mensagemErro(resultado.motivo), variant: "destructive" });
      return false;
    }
    toast({ title: t("salvar.sucesso"), description: resultado.ativo ? t("salvar.sucessoPublicado") : t("salvar.sucessoNaoPublicado") });
    return true;
  };

  // ---------- Troca de passo ----------
  const pedirPasso = (valor: string) => {
    const novo = valor as PassoCatalogo;
    if (novo === passo) return;
    if (alterado) setPassoPendente(novo);
    else setPasso(novo);
  };
  const trocarSemSalvar = () => {
    if (passoPendente) setPasso(passoPendente);
    setPassoPendente(null);
  };
  const salvarETrocar = async () => {
    const destino = passoPendente;
    setPassoPendente(null);
    if ((await salvar()) && destino) setPasso(destino);
  };

  // Mesmo valor que a aba Online antiga passava às categorias.
  const itensParaCategorias = p.selecionados.length > 0 ? p.itensSelecionados : p.itensCatalogo;
  const dispositivosDisponiveis = p.dispositivos.filter((d) => !d.vendido);

  return (
    <main className="flex-1 space-y-6 overflow-auto p-6">
      <Tabs value={passo} onValueChange={pedirPasso} className="space-y-6">
        <CabecalhoCatalogoDesktop
          temLandingPage={p.temAcessoLandingPage}
          acoes={<BarraSalvarCatalogo alterado={alterado} salvando={link.salvando} onSalvar={() => void salvar()} />}
        />

        {p.loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* 1. Itens */}
            <TabsContent value="itens" className="mt-0 space-y-5">
              <Card className="rounded-2xl">
                <CardContent className="space-y-3 px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                        <Pencil className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <Label htmlFor="modo-edicao-desktop" className="cursor-pointer text-sm font-semibold">
                          {t("itens.modoEdicao")}
                        </Label>
                        <p className="text-xs text-muted-foreground">{t("itens.modoEdicaoDescricao")}</p>
                      </div>
                    </div>
                    <Switch id="modo-edicao-desktop" checked={p.modoEdicao} onCheckedChange={p.setModoEdicao} />
                  </div>
                  {p.modoEdicao && (
                    <div
                      role="note"
                      className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{t("itens.avisoEstoque")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <Card className="rounded-2xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("itens.selecionarTitulo")}</CardTitle>
                    <CardDescription>{t("itens.selecionarDescricao")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SeletorDispositivosCatalogo
                      itens={p.itensCatalogo}
                      selecionados={p.selecionados}
                      onSelecionar={p.onSelecaoChange}
                      onToggleExibirNoCatalogo={p.onToggleExibirNoCatalogo}
                      atualizandoIds={p.atualizandoVisibilidade}
                    />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("itens.categoriasTitulo")}</CardTitle>
                    <CardDescription>{t("itens.categoriasDescricao")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <GerenciadorCategoriasCatalogo
                      categorias={p.configCatalogo.categoriasCatalogo || []}
                      itensDisponiveis={itensParaCategorias}
                      onChange={(cats) => p.setConfigCatalogo((prev) => ({ ...prev, categoriasCatalogo: cats }))}
                    />
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-hidden rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("itens.previaTitulo")}</CardTitle>
                  <CardDescription>{t("itens.previaDescricao")}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <CatalogoOnline
                    itens={p.itensSelecionados}
                    configuracaoLoja={p.configLoja}
                    config={p.configCatalogo}
                    modoEdicao={p.modoEdicao}
                    onAtualizarItem={p.onAtualizarItem}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* 2. Aparência */}
            <TabsContent value="aparencia" className="mt-0">
              <div className="grid items-start gap-5 xl:grid-cols-2">
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-lg">{t("aparencia.titulo")}</CardTitle>
                    <CardDescription>{t("aparencia.descricao")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ConfiguracaoTemplates config={p.configCatalogo} onConfigChange={p.setConfigCatalogo} />
                  </CardContent>
                </Card>
                <PreviaCatalogo {...p} titulo={t("previa.titulo")} descricao={t("previa.descricao")} alturaMaxima="max-h-[600px]" />
              </div>
            </TabsContent>

            {/* 3. Compartilhar */}
            <TabsContent value="compartilhar" className="mt-0 space-y-5">
              <div className="grid items-start gap-5 xl:grid-cols-2">
                <LinkCatalogoDesktop link={link} />
                <Card className="rounded-2xl">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <FileDown className="h-5 w-5 text-primary" aria-hidden="true" />
                      <CardTitle className="text-lg">{t("compartilhar.pdfTitulo")}</CardTitle>
                    </div>
                    <CardDescription>{t("compartilhar.pdfDescricao")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={p.onGerarPDF}
                      disabled={p.gerandoPDF}
                      className="h-11 w-full rounded-xl font-semibold"
                    >
                      {p.gerandoPDF ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      {p.gerandoPDF ? t("compartilhar.gerandoPdf") : t("compartilhar.baixarPdf")}
                    </Button>
                  </CardContent>
                </Card>
              </div>
              <PreviaCatalogo
                {...p}
                titulo={t("compartilhar.previaTitulo")}
                descricao={t("compartilhar.previaDescricao")}
                alturaMaxima="max-h-[500px]"
              />
            </TabsContent>

            {/* 4. Landing Page: conteúdo de hoje, com o salvar próprio (não passa pelo Salvar único). */}
            {p.temAcessoLandingPage && (
              <TabsContent value="landingpage" className="mt-0">
                <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Globe className="h-5 w-5" />
                          Configurar Landing Page
                        </CardTitle>
                        <CardDescription>Personalize sua landing page profissional</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ConfigLPComponent config={p.configLP} onConfigChange={p.onConfigLPChange} dispositivos={dispositivosDisponiveis} />
                      </CardContent>
                    </Card>

                    <Button onClick={p.onSalvarLP} disabled={p.salvandoLP || !p.lpAlterada} className="w-full gap-2" size="lg">
                      {p.salvandoLP ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {p.lpAlterada ? "Salvar Alterações" : "Tudo salvo"}
                    </Button>

                    <GerenciadorLinkLandingPage configLP={p.configLP} onConfigLPChange={p.setConfigLP} />
                  </div>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                      <div>
                        <CardTitle>Preview da Landing Page</CardTitle>
                        <CardDescription>Acesse em /lp/seu-slug</CardDescription>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor="modo-edicao-lp-desktop" className="text-sm">
                            Editar
                          </Label>
                          <Switch id="modo-edicao-lp-desktop" checked={p.modoEdicao} onCheckedChange={p.setModoEdicao} />
                        </div>
                        <SeletorDispositivoPrevia valor={p.previewDevice} onChange={p.setPreviewDevice} compacto />
                      </div>
                    </CardHeader>
                    <CardContent className="overflow-hidden bg-muted/30 p-0">
                      <div
                        className="mx-auto box-border max-h-[600px] overflow-y-auto overflow-x-hidden border-x bg-background transition-all duration-300"
                        style={{ width: LARGURA_PREVIA[p.previewDevice], maxWidth: "100%" }}
                      >
                        <LandingPagePreview
                          config={p.configLP}
                          configCatalogo={p.configCatalogo}
                          dispositivos={dispositivosDisponiveis}
                          configuracaoLoja={p.configLoja}
                          modoEdicao={p.modoEdicao}
                          onAtualizarDispositivo={async (id, dados) => {
                            await p.onAtualizarItem(id, "dispositivo", dados);
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}
          </>
        )}
      </Tabs>

      <AlertDialog open={passoPendente !== null} onOpenChange={(aberto) => !aberto && setPassoPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("trocarPasso.titulo")}</AlertDialogTitle>
            <AlertDialogDescription>{t("trocarPasso.descricao")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("trocarPasso.ficar")}</AlertDialogCancel>
            <Button variant="outline" onClick={trocarSemSalvar}>
              {t("trocarPasso.continuar")}
            </Button>
            <AlertDialogAction onClick={() => void salvarETrocar()}>{t("trocarPasso.salvarEContinuar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function SeletorDispositivoPrevia({
  valor,
  onChange,
  compacto = false,
}: {
  valor: DispositivoPrevia;
  onChange: (v: DispositivoPrevia) => void;
  compacto?: boolean;
}) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop.previa" });
  const px = compacto ? "px-2" : "px-3";
  return (
    <ToggleGroup type="single" value={valor} onValueChange={(v) => v && onChange(v as DispositivoPrevia)} className="rounded-lg border p-1">
      <ToggleGroupItem value="desktop" aria-label={t("computador")} title={t("computador")} className={px}>
        <Monitor className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="tablet" aria-label={t("tablet")} title={t("tablet")} className={px}>
        <Tablet className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="mobile" aria-label={t("celular")} title={t("celular")} className={px}>
        <Smartphone className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/** A prévia de hoje (6 primeiros itens no CatalogoOnline, largura por aparelho). */
function PreviaCatalogo(
  p: CatalogoDesktopProps & { titulo: string; descricao: string; alturaMaxima: "max-h-[600px]" | "max-h-[500px]" },
) {
  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg">{p.titulo}</CardTitle>
          <CardDescription>{p.descricao}</CardDescription>
        </div>
        <SeletorDispositivoPrevia valor={p.previewDevice} onChange={p.setPreviewDevice} />
      </CardHeader>
      <CardContent className="overflow-hidden bg-muted/30 p-0">
        <div
          className={`mx-auto box-border overflow-y-auto overflow-x-hidden border-x bg-background transition-all duration-300 ${p.alturaMaxima}`}
          style={{ width: LARGURA_PREVIA[p.previewDevice], maxWidth: "100%" }}
        >
          <CatalogoOnline itens={p.itensSelecionados.slice(0, 6)} configuracaoLoja={p.configLoja} config={p.configCatalogo} />
        </div>
      </CardContent>
    </Card>
  );
}
