import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { TrialBanner } from "@/components/trial/TrialBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useDispositivos } from "@/hooks/useDispositivos";
import { useProdutos } from "@/hooks/useProdutos";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useAssinatura } from "@/hooks/useAssinatura";
import { SeletorDispositivosCatalogo } from "@/components/catalogo/SeletorDispositivosCatalogo";
import { GerenciadorCategoriasCatalogo } from "@/components/catalogo/GerenciadorCategoriasCatalogo";
import { CatalogoOnline } from "@/components/catalogo/CatalogoOnline";
import { ConfiguracaoTemplates } from "@/components/catalogo/ConfiguracaoTemplates";
import { GerenciadorLinkCatalogo } from "@/components/catalogo/GerenciadorLinkCatalogo";
import { GerenciadorLinkLandingPage } from "@/components/catalogo/GerenciadorLinkLandingPage";
import { gerarCatalogoPDF } from "@/lib/gerarCatalogoPDF";
import { toast } from "@/hooks/use-toast";
import { FileDown, Eye, Loader2, BookOpen, Palette, Link2, Smartphone, Tablet, Monitor, Pencil, Globe, Save } from "lucide-react";
import { ConfiguracaoCatalogo, CONFIG_PADRAO, ConfiguracaoLandingPage, LANDING_PAGE_PADRAO } from "@/types/catalogo";
import { ConfiguracaoLandingPage as ConfigLPComponent } from "@/components/catalogo/ConfiguracaoLandingPage";
import { LandingPagePreview } from "@/components/catalogo/LandingPagePreview";
import { supabase } from "@/integrations/supabase/client";
import { ItemCatalogo, dispositivoParaItemCatalogo, produtoParaItemCatalogo } from "@/types/catalogo-item";
import { sanitizarCategoriasCatalogo, sanitizarSelecaoCatalogo } from "@/lib/catalogo-selection";

type DevicePreview = "mobile" | "tablet" | "desktop";

export default function CatalogoDispositivos() {
  const { dispositivos, loading: loadingDispositivos, carregarDispositivos } = useDispositivos();
  const { items: produtosPecas, loading: loadingProdutos, carregarTodos: carregarProdutos } = useProdutos();
  const { config: configLoja, loading: loadingConfig } = useConfiguracaoLoja();
  const { temAcessoModulo } = useAssinatura();
  
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [configCatalogo, setConfigCatalogo] = useState<ConfiguracaoCatalogo>(CONFIG_PADRAO);
  const [configLP, setConfigLP] = useState<ConfiguracaoLandingPage>(LANDING_PAGE_PADRAO);
  const [previewDevice, setPreviewDevice] = useState<DevicePreview>("desktop");
  const [modoEdicao, setModoEdicao] = useState(false);
  const [mostrarSeletorOnline, setMostrarSeletorOnline] = useState(false);
  const [salvandoLP, setSalvandoLP] = useState(false);
  const [lpAlterada, setLpAlterada] = useState(false);
  const [configLPOriginal, setConfigLPOriginal] = useState<string>("");
  
  const temAcessoLandingPage = temAcessoModulo('landing_page');

  // Carregar produtos/peças ao montar
  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  // Carregar configurações salvas do banco de dados
  useEffect(() => {
    const carregarConfigSalva = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('configuracoes_loja')
        .select('catalogo_config, landing_page_config')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.catalogo_config) {
        const savedConfig = { ...CONFIG_PADRAO, ...(data.catalogo_config as Record<string, unknown>) } as ConfiguracaoCatalogo;
        setConfigCatalogo(savedConfig);
        // Restaurar seleção salva
        if (savedConfig.itensSelecionadosIds && savedConfig.itensSelecionadosIds.length > 0) {
          setSelecionados(savedConfig.itensSelecionadosIds);
        }
      }
      if (data?.landing_page_config) {
        const lpConfig = { ...LANDING_PAGE_PADRAO, ...(data.landing_page_config as Record<string, unknown>) } as ConfiguracaoLandingPage;
        setConfigLP(lpConfig);
        setConfigLPOriginal(JSON.stringify(lpConfig));
      }
    };

    carregarConfigSalva();
  }, []);

  // Detectar alterações na LP
  const handleConfigLPChange = (newConfig: ConfiguracaoLandingPage) => {
    setConfigLP(newConfig);
    setLpAlterada(JSON.stringify(newConfig) !== configLPOriginal);
  };

  const handleSalvarLP = async () => {
    setSalvandoLP(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from('configuracoes_loja')
        .update({
          landing_page_config: JSON.parse(JSON.stringify(configLP)),
          catalogo_config: JSON.parse(JSON.stringify(configCatalogo)),
        })
        .eq('user_id', user.id);
      if (error) throw error;
      setConfigLPOriginal(JSON.stringify(configLP));
      setLpAlterada(false);
      toast({ title: "Alterações salvas com sucesso!" });
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({ title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setSalvandoLP(false);
    }
  };

  const getPreviewWidth = () => {
    switch (previewDevice) {
      case "mobile": return "375px";
      case "tablet": return "768px";
      case "desktop": return "100%";
    }
  };

  // Converter dispositivos para itens do catálogo
  const itensCatalogo = useMemo(() => {
    const dispositivosConvertidos = dispositivos
      .filter((d) => !d.vendido)
      .map(dispositivoParaItemCatalogo);

    const produtosConvertidos = produtosPecas
      .map(produtoParaItemCatalogo);

    return [...dispositivosConvertidos, ...produtosConvertidos].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR')
    );
  }, [dispositivos, produtosPecas]);

  useEffect(() => {
    if (itensCatalogo.length === 0) return;

    const idsDisponiveis = itensCatalogo.map((item) => item.id);
    const { idsValidos } = sanitizarSelecaoCatalogo(configCatalogo.itensSelecionadosIds, idsDisponiveis);
    const categoriasSanitizadas = sanitizarCategoriasCatalogo(configCatalogo.categoriasCatalogo, idsDisponiveis);

    const selecaoAtual = configCatalogo.itensSelecionadosIds || [];
    const categoriasAtuais = configCatalogo.categoriasCatalogo || [];
    const selecaoMudou = JSON.stringify(selecaoAtual) !== JSON.stringify(idsValidos);
    const categoriasMudaram = JSON.stringify(categoriasAtuais) !== JSON.stringify(categoriasSanitizadas || []);
    const estadoLocalMudou = JSON.stringify(selecionados) !== JSON.stringify(idsValidos);

    if (!selecaoMudou && !categoriasMudaram && !estadoLocalMudou) return;

    setSelecionados(idsValidos);
    setConfigCatalogo((prev) => ({
      ...prev,
      itensSelecionadosIds: idsValidos,
      categoriasCatalogo: categoriasSanitizadas,
    }));
  }, [itensCatalogo, configCatalogo.itensSelecionadosIds, configCatalogo.categoriasCatalogo, selecionados]);

  const itensSelecionados = useMemo(() => {
    if (selecionados.length === 0) return itensCatalogo;
    return itensCatalogo.filter((item) => selecionados.includes(item.id));
  }, [itensCatalogo, selecionados]);

  // Salvar seleção no config quando mudar
  const handleSelecaoChange = (ids: string[]) => {
    setSelecionados(ids);
    setConfigCatalogo(prev => ({ ...prev, itensSelecionadosIds: ids }));
  };

  const handleGerarPDF = async () => {
    if (itensSelecionados.length === 0) {
      toast({
        title: "Nenhum item disponível",
        description: "Não há itens disponíveis para gerar o catálogo.",
        variant: "destructive",
      });
      return;
    }

    setGerandoPDF(true);
    try {
      // Filtrar apenas dispositivos para o PDF (mantém compatibilidade)
      const dispositivosSelecionados = dispositivos.filter(d => selecionados.includes(d.id));
      await gerarCatalogoPDF({
        dispositivos: dispositivosSelecionados,
        configuracaoLoja: configLoja,
        config: configCatalogo,
      });
      toast({
        title: "Catálogo gerado!",
        description: `PDF com ${selecionados.length} itens foi baixado.`,
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o catálogo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setGerandoPDF(false);
    }
  };

  const handleAtualizarItem = async (
    id: string, 
    tipoItem: string,
    dados: { fotos: string[]; preco: number | null; precoPromocional: number | null }
  ) => {
    if (tipoItem === 'dispositivo') {
      const foto_url = dados.fotos.length > 0 ? dados.fotos[0] : null;
      const fotosRestantes = dados.fotos.length > 1 ? dados.fotos.slice(1) : [];
      
      const { error } = await supabase
        .from('dispositivos')
        .update({ 
          foto_url, 
          fotos: fotosRestantes,
          preco: dados.preco,
          preco_promocional: dados.precoPromocional
        })
        .eq('id', id);

      if (error) throw error;
      await carregarDispositivos();
    } else if (tipoItem === 'produto') {
      const { error } = await supabase
        .from('produtos')
        .update({ 
          fotos: dados.fotos,
          preco: dados.preco,
        })
        .eq('id', id);

      if (error) throw error;
      await carregarProdutos();
    } else if (tipoItem === 'peca') {
      const { error } = await supabase
        .from('pecas')
        .update({ 
          fotos: dados.fotos,
          preco: dados.preco,
        })
        .eq('id', id);

      if (error) throw error;
      await carregarProdutos();
    }
  };

  const loading = loadingDispositivos || loadingConfig || loadingProdutos;

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        {/* TrialBanner agora fica no AppLayout */}
        <div className="hidden md:flex items-center justify-between border-b px-6 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Catálogo
            </h1>
          </div>
        </div>

          <div className="p-4 md:p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Tabs defaultValue="visualizar" className="space-y-6">
                <TabsList className={`grid w-full max-w-3xl ${temAcessoLandingPage ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  <TabsTrigger value="visualizar" className="flex items-center gap-1 text-xs sm:text-sm">
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">Online</span>
                  </TabsTrigger>
                  <TabsTrigger value="personalizar" className="flex items-center gap-1 text-xs sm:text-sm">
                    <Palette className="w-4 h-4" />
                    <span className="hidden sm:inline">Templates</span>
                  </TabsTrigger>
                  <TabsTrigger value="compartilhar" className="flex items-center gap-1 text-xs sm:text-sm">
                    <Link2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Link</span>
                  </TabsTrigger>
                  {temAcessoLandingPage && (
                    <TabsTrigger value="landingpage" className="flex items-center gap-1 text-xs sm:text-sm">
                      <Globe className="w-4 h-4" />
                      <span className="hidden sm:inline">Landing Page</span>
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Tab: Visualizar Online */}
                <TabsContent value="visualizar" className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Card className="flex-1">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <Label htmlFor="modo-edicao" className="text-sm font-medium cursor-pointer">
                                Modo de Edição
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Editar fotos e preços
                              </p>
                            </div>
                          </div>
                          <Switch
                            id="modo-edicao"
                            checked={modoEdicao}
                            onCheckedChange={setModoEdicao}
                          />
                        </div>
                      </CardContent>
                    </Card>
                    <Button
                      variant={mostrarSeletorOnline ? "secondary" : "outline"}
                      onClick={() => setMostrarSeletorOnline(!mostrarSeletorOnline)}
                      className="h-auto py-3"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {selecionados.length > 0 
                        ? `${selecionados.length} itens selecionados`
                        : "Selecionar itens"
                      }
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleGerarPDF}
                      disabled={itensSelecionados.length === 0 || gerandoPDF}
                      className="h-auto py-3"
                    >
                      {gerandoPDF ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4 mr-2" />
                      )}
                      Gerar PDF
                    </Button>
                  </div>

                  {mostrarSeletorOnline && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Selecionar Itens do Catálogo</CardTitle>
                        <CardDescription className="text-xs">
                          Escolha quais itens aparecerão no catálogo online e público. Se nenhum for selecionado, todos serão exibidos.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <SeletorDispositivosCatalogo
                          itens={itensCatalogo}
                          selecionados={selecionados}
                          onSelecionar={handleSelecaoChange}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Gerenciador de categorias */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Categorias do Catálogo</CardTitle>
                      <CardDescription className="text-xs">
                        Organize os itens em categorias para exibição agrupada no catálogo público.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <GerenciadorCategoriasCatalogo
                        categorias={configCatalogo.categoriasCatalogo || []}
                        itensDisponiveis={selecionados.length > 0 ? itensSelecionados : itensCatalogo}
                        onChange={(cats) => setConfigCatalogo(prev => ({ ...prev, categoriasCatalogo: cats }))}
                      />
                    </CardContent>
                  </Card>

                  <CatalogoOnline
                    itens={itensSelecionados}
                    configuracaoLoja={configLoja}
                    config={configCatalogo}
                    modoEdicao={modoEdicao}
                    onAtualizarItem={handleAtualizarItem}
                  />
                </TabsContent>

                {/* Tab: Personalizar Templates */}
                <TabsContent value="personalizar">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Personalizar Catálogo</CardTitle>
                        <CardDescription>
                          Escolha templates, personalize textos e configure as opções de exibição
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ConfiguracaoTemplates
                          config={configCatalogo}
                          onConfigChange={setConfigCatalogo}
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div>
                          <CardTitle>Preview</CardTitle>
                          <CardDescription>
                            Visualize como ficará o catálogo online
                          </CardDescription>
                        </div>
                        <ToggleGroup 
                          type="single" 
                          value={previewDevice} 
                          onValueChange={(v) => v && setPreviewDevice(v as DevicePreview)}
                          className="border rounded-lg p-1"
                        >
                          <ToggleGroupItem value="mobile" aria-label="Mobile" className="px-3">
                            <Smartphone className="h-4 w-4" />
                          </ToggleGroupItem>
                          <ToggleGroupItem value="tablet" aria-label="Tablet" className="px-3">
                            <Tablet className="h-4 w-4" />
                          </ToggleGroupItem>
                          <ToggleGroupItem value="desktop" aria-label="Desktop" className="px-3">
                            <Monitor className="h-4 w-4" />
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </CardHeader>
                      <CardContent className="p-0 bg-muted/30 overflow-hidden">
                        <div 
                          className="max-h-[600px] overflow-x-hidden overflow-y-auto transition-all duration-300 bg-background border-x mx-auto box-border"
                          style={{ 
                            width: previewDevice === 'desktop' ? '100%' : getPreviewWidth(),
                            maxWidth: '100%',
                          }}
                        >
                          <CatalogoOnline
                            itens={itensSelecionados.slice(0, 6)}
                            configuracaoLoja={configLoja}
                            config={configCatalogo}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Tab: Compartilhar Link */}
                <TabsContent value="compartilhar">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <GerenciadorLinkCatalogo 
                      configCatalogo={configCatalogo}
                    />

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div>
                          <CardTitle>Preview do Catálogo Público</CardTitle>
                          <CardDescription>
                            Assim ficará seu catálogo para os visitantes
                          </CardDescription>
                        </div>
                        <ToggleGroup 
                          type="single" 
                          value={previewDevice} 
                          onValueChange={(v) => v && setPreviewDevice(v as DevicePreview)}
                          className="border rounded-lg p-1"
                        >
                          <ToggleGroupItem value="mobile" aria-label="Mobile" className="px-3">
                            <Smartphone className="h-4 w-4" />
                          </ToggleGroupItem>
                          <ToggleGroupItem value="tablet" aria-label="Tablet" className="px-3">
                            <Tablet className="h-4 w-4" />
                          </ToggleGroupItem>
                          <ToggleGroupItem value="desktop" aria-label="Desktop" className="px-3">
                            <Monitor className="h-4 w-4" />
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </CardHeader>
                      <CardContent className="p-0 bg-muted/30 overflow-hidden">
                        <div 
                          className="max-h-[500px] overflow-x-hidden overflow-y-auto transition-all duration-300 bg-background border-x mx-auto box-border"
                          style={{ 
                            width: previewDevice === 'desktop' ? '100%' : getPreviewWidth(),
                            maxWidth: '100%',
                          }}
                        >
                          <CatalogoOnline
                            itens={itensSelecionados.slice(0, 6)}
                            configuracaoLoja={configLoja}
                            config={configCatalogo}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Tab: Landing Page */}
                {temAcessoLandingPage && (
                  <TabsContent value="landingpage">
                    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
                      <div className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Globe className="w-5 h-5" />
                              Configurar Landing Page
                            </CardTitle>
                            <CardDescription>
                              Personalize sua landing page profissional
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ConfigLPComponent
                              config={configLP}
                              onConfigChange={handleConfigLPChange}
                              dispositivos={dispositivos.filter(d => !d.vendido)}
                            />
                          </CardContent>
                        </Card>

                        {/* Botão Salvar Global */}
                        <Button
                          onClick={handleSalvarLP}
                          disabled={salvandoLP || !lpAlterada}
                          className="w-full gap-2"
                          size="lg"
                        >
                          {salvandoLP ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          {lpAlterada ? 'Salvar Alterações' : 'Tudo salvo'}
                        </Button>

                        <GerenciadorLinkLandingPage
                          configLP={configLP}
                          onConfigLPChange={setConfigLP}
                        />
                      </div>

                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                          <div>
                            <CardTitle>Preview da Landing Page</CardTitle>
                            <CardDescription>
                              Acesse em /lp/seu-slug
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Pencil className="w-4 h-4 text-muted-foreground" />
                              <Label htmlFor="modo-edicao-lp" className="text-sm">Editar</Label>
                              <Switch
                                id="modo-edicao-lp"
                                checked={modoEdicao}
                                onCheckedChange={setModoEdicao}
                              />
                            </div>
                            <ToggleGroup 
                              type="single" 
                              value={previewDevice} 
                              onValueChange={(v) => v && setPreviewDevice(v as DevicePreview)}
                              className="border rounded-lg p-1"
                            >
                              <ToggleGroupItem value="mobile" aria-label="Mobile" className="px-2">
                                <Smartphone className="h-4 w-4" />
                              </ToggleGroupItem>
                              <ToggleGroupItem value="tablet" aria-label="Tablet" className="px-2">
                                <Tablet className="h-4 w-4" />
                              </ToggleGroupItem>
                              <ToggleGroupItem value="desktop" aria-label="Desktop" className="px-2">
                                <Monitor className="h-4 w-4" />
                              </ToggleGroupItem>
                            </ToggleGroup>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0 bg-muted/30 overflow-hidden">
                          <div 
                            className="max-h-[600px] overflow-x-hidden overflow-y-auto transition-all duration-300 bg-background border-x mx-auto box-border"
                            style={{ 
                              width: previewDevice === 'desktop' ? '100%' : getPreviewWidth(),
                              maxWidth: '100%',
                            }}
                          >
                            <LandingPagePreview
                              config={configLP}
                              configCatalogo={configCatalogo}
                              dispositivos={dispositivos.filter(d => !d.vendido)}
                              configuracaoLoja={configLoja}
                              modoEdicao={modoEdicao}
                              onAtualizarDispositivo={async (id, dados) => {
                                await handleAtualizarItem(id, 'dispositivo', dados);
                              }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            )}
          </div>
        </main>
      </AppLayout>
    );
  }
