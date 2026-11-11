// Tela Catálogo no computador (>= 1024px): cabeçalho, passos (Itens → Aparência → Compartilhar,
// + Landing Page com o módulo) e o Salvar único (catalogo_config + link + publicação).
// Recebe o MESMO estado e as MESMAS funções da página (CatalogoDispositivos); celular e tablet
// seguem com o JSX antigo da página, intocado.
// F2 trocou o passo Itens e a F3 o passo Aparência; Compartilhar (F4) e a Landing Page ainda usam
// os componentes de hoje.
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { FileDown, Globe, Loader2, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { GerenciadorLinkLandingPage } from "@/components/catalogo/GerenciadorLinkLandingPage";
import { ConfiguracaoLandingPage as ConfigLPComponent } from "@/components/catalogo/ConfiguracaoLandingPage";
import { LandingPagePreview } from "@/components/catalogo/LandingPagePreview";
import { toast } from "@/hooks/use-toast";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useLinkCatalogo, type ResultadoSalvarCatalogo } from "@/hooks/useLinkCatalogo";
import { assinaturaEstado, temAlteracoes } from "@/lib/catalogo/alteracoesNaoSalvas";
import { montarMapaCustos, visibilidadeCustoLucro } from "@/lib/catalogo/listaItensDesktop";
import { sanitizarCategoriasCatalogo, sanitizarSelecaoCatalogo } from "@/lib/catalogo-selection";
import { CONFIG_PADRAO, type ConfiguracaoCatalogo, type ConfiguracaoLandingPage } from "@/types/catalogo";
import type { ItemCatalogo } from "@/types/catalogo-item";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import type { Dispositivo } from "@/types/dispositivo";
import type { ItemEstoque } from "@/types/produto";
import { AparenciaCatalogoDesktop } from "./AparenciaCatalogoDesktop";
import { BarraSalvarCatalogo } from "./BarraSalvarCatalogo";
import { CabecalhoCatalogoDesktop, type PassoCatalogo } from "./CabecalhoCatalogoDesktop";
import { ItensCatalogoDesktop } from "./ItensCatalogoDesktop";
import { LinkCatalogoDesktop } from "./LinkCatalogoDesktop";
import { PreviaCatalogoDesktop, SeletorDispositivoPrevia, type DispositivoPrevia } from "./PreviaCatalogoDesktop";

export type { DispositivoPrevia };

type DadosItem = { fotos: string[]; preco: number | null; precoPromocional: number | null };

export interface CatalogoDesktopProps {
  loading: boolean;
  temAcessoLandingPage: boolean;
  dispositivos: Dispositivo[];
  /** Só para o mapa de custos da tela do dono (o custo nunca entra no ItemCatalogo). */
  produtosPecas: ItemEstoque[];
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

  // Trocar de passo não perde nada (o estado é da página): troca direto, sem confirmação.
  const pedirPasso = (valor: string) => setPasso(valor as PassoCatalogo);

  // A página limpa a seleção e as categorias (ids que sumiram) só quando a lista de itens muda
  // (efeito com [itensCatalogo]). Se os itens chegam ANTES da config salva, a limpeza não roda e
  // a tela fica com ids "fantasmas" que o link público descarta. No computador a mesma limpeza,
  // com as mesmas funções, roda sempre que aparecer um id que não existe mais.
  const { selecionados, configCatalogo, onSelecaoChange, setConfigCatalogo } = p;
  useEffect(() => {
    if (idsDisponiveis.length === 0) return;
    const existe = new Set(idsDisponiveis);
    const fantasmaNaSelecao = selecionados.some((id) => !existe.has(id));
    const fantasmaNasCategorias = (configCatalogo.categoriasCatalogo ?? []).some((c) => c.itemIds.some((id) => !existe.has(id)));
    if (!fantasmaNaSelecao && !fantasmaNasCategorias) return;
    if (fantasmaNaSelecao) onSelecaoChange(sanitizarSelecaoCatalogo(selecionados, idsDisponiveis).idsValidos);
    if (fantasmaNasCategorias) {
      setConfigCatalogo((prev) => ({ ...prev, categoriasCatalogo: sanitizarCategoriasCatalogo(prev.categoriasCatalogo, idsDisponiveis) }));
    }
  }, [idsDisponiveis, selecionados, configCatalogo.categoriasCatalogo, onSelecaoChange, setConfigCatalogo]);

  // ---------- Custo e lucro (só a tela do dono) ----------
  // Mapa id → custo montado à parte, com o que useDispositivos/useProdutos já carregam.
  // Nunca entra no ItemCatalogo: a prévia, o link público e o PDF não o recebem.
  const mapaCustos = useMemo(
    () =>
      montarMapaCustos([
        ...p.dispositivos.map((d) => ({ id: d.id, custo: d.custo })),
        // Produto/peça: custo 0 é o vazio do useProdutos → desconhecido ("—").
        ...p.produtosPecas.map((i) => ({ id: i.id, custo: i.custo, zeroEhDesconhecido: true })),
      ]),
    [p.dispositivos, p.produtosPecas],
  );
  // Mesma permissão das telas de Dispositivos e Produtos: dono sempre; funcionário pelo
  // ver_custos / ver_lucros. Enquanto carrega, nada aparece (isDonoLoja ainda é false).
  const permissoes = useFuncionarioPermissoes();
  const visibilidade = visibilidadeCustoLucro({
    ehDono: permissoes.isDonoLoja,
    ver_custos: permissoes.permissoes?.recursos?.ver_custos,
    ver_lucros: permissoes.permissoes?.recursos?.ver_lucros,
  });

  // A seleção salva foi descartada pela regra de sempre (sanitizarSelecaoCatalogo volta a
  // "todos" quando metade ou mais dos marcados sumiu): só avisa, a regra não muda.
  const selecaoDescartada = useMemo(() => {
    if (!link.carregado || idsDisponiveis.length === 0) return null;
    const salvos = link.configSalva?.itensSelecionadosIds;
    if (!Array.isArray(salvos) || salvos.length === 0) return null;
    const ids = salvos.filter((id): id is string => typeof id === "string");
    const r = sanitizarSelecaoCatalogo(ids, idsDisponiveis);
    return r.resetarSelecao ? { salvos: new Set(ids).size, sumiram: r.idsInvalidos.length } : null;
  }, [link.carregado, link.configSalva, idsDisponiveis]);

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
            <TabsContent value="itens" className="mt-0">
              <ItensCatalogoDesktop
                itens={p.itensCatalogo}
                itensParaVincular={itensParaCategorias}
                selecionados={p.selecionados}
                onSelecaoChange={p.onSelecaoChange}
                categorias={p.configCatalogo.categoriasCatalogo}
                onCategoriasChange={(cats) => p.setConfigCatalogo((prev) => ({ ...prev, categoriasCatalogo: cats }))}
                onToggleExibirNoCatalogo={p.onToggleExibirNoCatalogo}
                atualizandoVisibilidade={p.atualizandoVisibilidade}
                modoEdicao={p.modoEdicao}
                setModoEdicao={p.setModoEdicao}
                onAtualizarItem={p.onAtualizarItem}
                tituloCatalogo={p.configCatalogo.textos?.tituloCapa || p.configLoja?.nome_loja || t("titulo")}
                mapaCustos={mapaCustos}
                mostrarCusto={visibilidade.custo}
                mostrarLucro={visibilidade.lucro}
                selecaoDescartada={selecaoDescartada}
              />
            </TabsContent>

            {/* 2. Aparência */}
            <TabsContent value="aparencia" className="mt-0">
              <AparenciaCatalogoDesktop
                config={p.configCatalogo}
                onConfigChange={p.setConfigCatalogo}
                itensPrevia={p.itensSelecionados.slice(0, 6)}
                configLoja={p.configLoja}
                previewDevice={p.previewDevice}
                setPreviewDevice={p.setPreviewDevice}
              />
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
              <PreviaCatalogoDesktop
                itens={p.itensSelecionados.slice(0, 6)}
                configLoja={p.configLoja}
                config={p.configCatalogo}
                dispositivo={p.previewDevice}
                onDispositivo={p.setPreviewDevice}
                titulo={t("compartilhar.previaTitulo")}
                descricao={t("compartilhar.previaDescricao")}
                altura={500}
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

    </main>
  );
}
