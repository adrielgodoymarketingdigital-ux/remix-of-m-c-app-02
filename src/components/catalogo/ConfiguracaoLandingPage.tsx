import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SeletorDestaques } from "./SeletorDestaques";
import { ConfiguracaoLandingPage as ConfigLPType, LANDING_PAGE_PADRAO, TEMPLATES_PADRAO } from "@/types/catalogo";
import { Dispositivo } from "@/types/dispositivo";
import { LayoutTemplate, Star, Phone, Grid3X3, Settings2, Trash2, Image, Crown, Type, Palette, ChevronDown, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ConfiguracaoLandingPageProps {
  config: ConfigLPType;
  onConfigChange: (config: ConfigLPType) => void;
  dispositivos: Dispositivo[];
}

// Helper: color picker row
function ColorPickerRow({ label, value, defaultValue, onChange }: { label: string; value?: string; defaultValue: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={value || defaultValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded border cursor-pointer"
        />
        {value && (
          <Button variant="ghost" size="sm" className="text-xs h-6 px-1.5" onClick={() => onChange(undefined)}>
            ✕
          </Button>
        )}
      </div>
    </div>
  );
}

// Collapsible section colors
function SecaoCoresCollapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full p-2 rounded-lg border text-xs font-medium hover:bg-muted/50 transition-colors">
          <span className="flex items-center gap-1.5">
            <Palette className="w-3 h-3" />
            {title}
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 space-y-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ConfiguracaoLandingPage({
  config,
  onConfigChange,
  dispositivos,
}: ConfiguracaoLandingPageProps) {
  const [uploadingImagem, setUploadingImagem] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleChange = <K extends keyof ConfigLPType>(key: K, value: ConfigLPType[K]) => {
    onConfigChange({ ...config, [key]: value });
  };

  const handleSecaoChange = <S extends 'secaoHero' | 'secaoDestaques' | 'secaoGrid' | 'secaoContato' | 'secaoFooter'>(
    secao: S,
    field: string,
    value: unknown
  ) => {
    const current = (config[secao] || {}) as Record<string, unknown>;
    onConfigChange({
      ...config,
      [secao]: { ...current, [field]: value },
    });
  };

  const handleUploadFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    prefix: string,
    onSuccess: (url: string) => void,
    setUploading: (v: boolean) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const fileName = `${user.id}/${prefix}-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('catalogo-assets').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('catalogo-assets').getPublicUrl(fileName);
      onSuccess(publicUrl);
      toast({ title: "Imagem enviada com sucesso!" });
    } catch (error) {
      console.error("Erro ao enviar imagem:", error);
      toast({ title: "Erro ao enviar imagem", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Tabs defaultValue="hero" className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="hero" className="text-xs flex items-center gap-1">
          <LayoutTemplate className="w-3 h-3" />
          <span className="hidden sm:inline">Hero</span>
        </TabsTrigger>
        <TabsTrigger value="destaques" className="text-xs flex items-center gap-1">
          <Star className="w-3 h-3" />
          <span className="hidden sm:inline">Destaques</span>
        </TabsTrigger>
        <TabsTrigger value="grid" className="text-xs flex items-center gap-1">
          <Grid3X3 className="w-3 h-3" />
          <span className="hidden sm:inline">Grid</span>
        </TabsTrigger>
        <TabsTrigger value="contato" className="text-xs flex items-center gap-1">
          <Phone className="w-3 h-3" />
          <span className="hidden sm:inline">Contato</span>
        </TabsTrigger>
        <TabsTrigger value="global" className="text-xs flex items-center gap-1">
          <Settings2 className="w-3 h-3" />
          <span className="hidden sm:inline">Global</span>
        </TabsTrigger>
      </TabsList>

      {/* ========== HERO ========== */}
      <TabsContent value="hero" className="space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Mostrar Hero</Label>
            <p className="text-xs text-muted-foreground">Banner principal com título e CTA</p>
          </div>
          <Switch checked={config.mostrarHero} onCheckedChange={(v) => handleChange('mostrarHero', v)} />
        </div>

        {config.mostrarHero && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título Principal</Label>
              <Input value={config.heroTitulo} onChange={(e) => handleChange('heroTitulo', e.target.value)} placeholder="Os Melhores Dispositivos" />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo</Label>
              <Textarea value={config.heroSubtitulo} onChange={(e) => handleChange('heroSubtitulo', e.target.value)} placeholder="Celulares, tablets e eletrônicos com garantia" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Texto do Botão (CTA)</Label>
              <Input value={config.heroCTA} onChange={(e) => handleChange('heroCTA', e.target.value)} placeholder="Ver Catálogo" />
            </div>

            <div className="space-y-2">
              <Label>Estilo do Hero</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['gradiente', 'imagem', 'simples'] as const).map((estilo) => (
                  <button key={estilo} onClick={() => handleChange('heroEstilo', estilo)}
                    className={`p-3 border rounded-lg text-center text-sm capitalize transition-all ${config.heroEstilo === estilo ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'}`}>
                    {estilo}
                  </button>
                ))}
              </div>
            </div>

            {config.heroEstilo === 'imagem' && (
              <div className="space-y-2">
                <Label>Imagem de Fundo</Label>
                {config.heroImagemFundo ? (
                  <div className="relative">
                    <img src={config.heroImagemFundo} alt="Hero background" className="w-full h-32 object-cover rounded-lg" />
                    <Button variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => handleChange('heroImagemFundo', undefined)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Image className="w-8 h-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">{uploadingImagem ? "Enviando..." : "Clique para enviar imagem"}</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadFile(e, 'hero', (url) => handleChange('heroImagemFundo', url), setUploadingImagem)} disabled={uploadingImagem} />
                  </label>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Animação do Hero</Label>
              <div className="grid grid-cols-4 gap-2">
                {([{ id: 'nenhuma', label: 'Nenhuma' }, { id: 'fade', label: 'Fade' }, { id: 'slide-up', label: 'Slide' }, { id: 'zoom', label: 'Zoom' }] as const).map((anim) => (
                  <button key={anim.id} onClick={() => handleChange('animacaoHero', anim.id)}
                    className={`p-2 border rounded-lg text-center text-xs transition-all ${(config.animacaoHero || 'nenhuma') === anim.id ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'}`}>
                    {anim.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Template de Cores</Label>
              <div className="grid grid-cols-3 gap-2">
                {TEMPLATES_PADRAO.map((template) => (
                  <button key={template.id} onClick={() => handleChange('templateBase', template.id)}
                    className={`p-3 border rounded-lg text-center text-xs transition-all ${config.templateBase === template.id ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'}`}>
                    <div className="flex justify-center gap-1 mb-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: template.cores.primaria }} />
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: template.cores.secundaria }} />
                    </div>
                    <span>{template.nome}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cores do Hero */}
            <SecaoCoresCollapsible title="Personalizar cores do Hero">
              <ColorPickerRow label="Cor de Fundo" value={config.secaoHero?.corFundo} defaultValue="#3B82F6" onChange={(v) => handleSecaoChange('secaoHero', 'corFundo', v)} />
              <ColorPickerRow label="Cor do Texto" value={config.secaoHero?.corTexto} defaultValue="#FFFFFF" onChange={(v) => handleSecaoChange('secaoHero', 'corTexto', v)} />
              <ColorPickerRow label="Cor do Título" value={config.secaoHero?.corTitulo} defaultValue="#FFFFFF" onChange={(v) => handleSecaoChange('secaoHero', 'corTitulo', v)} />
              <ColorPickerRow label="Cor do Botão" value={config.secaoHero?.corBotao} defaultValue="#FFFFFF" onChange={(v) => handleSecaoChange('secaoHero', 'corBotao', v)} />
              <ColorPickerRow label="Texto do Botão" value={config.secaoHero?.corBotaoTexto} defaultValue="#3B82F6" onChange={(v) => handleSecaoChange('secaoHero', 'corBotaoTexto', v)} />
            </SecaoCoresCollapsible>
          </div>
        )}
      </TabsContent>

      {/* ========== DESTAQUES ========== */}
      <TabsContent value="destaques" className="space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Mostrar Destaques</Label>
            <p className="text-xs text-muted-foreground">Seção com até 3 dispositivos em destaque</p>
          </div>
          <Switch checked={config.mostrarDestaques} onCheckedChange={(v) => handleChange('mostrarDestaques', v)} />
        </div>

        {config.mostrarDestaques && (
          <>
            <div className="space-y-2">
              <Label>Título da Seção</Label>
              <Input value={config.tituloDestaques} onChange={(e) => handleChange('tituloDestaques', e.target.value)} placeholder="Destaques" />
            </div>
            <SeletorDestaques dispositivos={dispositivos} selecionados={config.dispositivosDestaque || []} onSelecionar={(ids) => handleChange('dispositivosDestaque', ids)} maxDestaques={3} />

            <SecaoCoresCollapsible title="Personalizar cores dos Destaques">
              <ColorPickerRow label="Cor de Fundo" value={config.secaoDestaques?.corFundo} defaultValue="#F0F9FF" onChange={(v) => handleSecaoChange('secaoDestaques', 'corFundo', v)} />
              <ColorPickerRow label="Cor do Título" value={config.secaoDestaques?.corTitulo} defaultValue="#1F2937" onChange={(v) => handleSecaoChange('secaoDestaques', 'corTitulo', v)} />
              <ColorPickerRow label="Cor do Texto" value={config.secaoDestaques?.corTexto} defaultValue="#1F2937" onChange={(v) => handleSecaoChange('secaoDestaques', 'corTexto', v)} />
              <ColorPickerRow label="Cor da Borda" value={config.secaoDestaques?.corBorda} defaultValue="#3B82F6" onChange={(v) => handleSecaoChange('secaoDestaques', 'corBorda', v)} />
            </SecaoCoresCollapsible>
          </>
        )}
      </TabsContent>

      {/* ========== GRID ========== */}
      <TabsContent value="grid" className="space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Mostrar Grid</Label>
            <p className="text-xs text-muted-foreground">Lista completa de dispositivos</p>
          </div>
          <Switch checked={config.mostrarGrid} onCheckedChange={(v) => handleChange('mostrarGrid', v)} />
        </div>

        {config.mostrarGrid && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título do Grid</Label>
              <Input value={config.tituloGrid || 'Todos os Dispositivos'} onChange={(e) => handleChange('tituloGrid', e.target.value)} placeholder="Todos os Dispositivos" />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo (opcional)</Label>
              <Input value={config.subtituloGrid || ''} onChange={(e) => handleChange('subtituloGrid', e.target.value)} placeholder="Confira nosso estoque atualizado" />
            </div>

            {/* Colunas Mobile */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Colunas no Mobile</Label>
              <div className="grid grid-cols-2 gap-2">
                {([1, 2] as const).map((col) => (
                  <button key={col} onClick={() => handleChange('gridColunasMobile', col)}
                    className={`p-2 border rounded-lg text-center text-xs transition-all ${(config.gridColunasMobile || 1) === col ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'}`}>
                    {col} {col === 1 ? 'coluna' : 'colunas'}
                  </button>
                ))}
              </div>
            </div>

            {/* Colunas Desktop */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Colunas no Desktop</Label>
              <div className="grid grid-cols-3 gap-2">
                {([2, 3, 4] as const).map((col) => (
                  <button key={col} onClick={() => handleChange('gridColunasDesktop', col)}
                    className={`p-2 border rounded-lg text-center text-xs transition-all ${(config.gridColunasDesktop || 3) === col ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'}`}>
                    {col} colunas
                  </button>
                ))}
              </div>
            </div>

            {/* Estilo dos Cards */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Estilo dos Cards</Label>
              <div className="grid grid-cols-3 gap-2">
                {([{ id: 'cards', label: 'Cards' }, { id: 'lista', label: 'Lista' }, { id: 'magazine', label: 'Magazine' }] as const).map((est) => (
                  <button key={est.id} onClick={() => handleChange('gridEstilo', est.id)}
                    className={`p-2 border rounded-lg text-center text-xs transition-all ${(config.gridEstilo || 'cards') === est.id ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'}`}>
                    {est.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sombra dos Cards */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Sombra dos Cards</Label>
              <div className="grid grid-cols-4 gap-2">
                {([{ id: 'nenhuma', label: 'Nenhuma' }, { id: 'leve', label: 'Leve' }, { id: 'media', label: 'Média' }, { id: 'forte', label: 'Forte' }] as const).map((s) => (
                  <button key={s.id} onClick={() => handleSecaoChange('secaoGrid', 'sombraCard', s.id)}
                    className={`p-2 border rounded-lg text-center text-xs transition-all ${(config.secaoGrid?.sombraCard || 'leve') === s.id ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Border Radius dos Cards */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Borda dos Cards</Label>
              <div className="grid grid-cols-4 gap-2">
                {([{ id: 'nenhum', label: 'Sem' }, { id: 'pequeno', label: 'Pequena' }, { id: 'medio', label: 'Média' }, { id: 'grande', label: 'Grande' }] as const).map((b) => (
                  <button key={b.id} onClick={() => handleSecaoChange('secaoGrid', 'borderRadiusCard', b.id)}
                    className={`p-2 border rounded-lg text-center text-xs transition-all ${(config.secaoGrid?.borderRadiusCard || 'medio') === b.id ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'}`}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <SecaoCoresCollapsible title="Personalizar cores do Grid">
              <ColorPickerRow label="Cor de Fundo" value={config.secaoGrid?.corFundo} defaultValue="#FFFFFF" onChange={(v) => handleSecaoChange('secaoGrid', 'corFundo', v)} />
              <ColorPickerRow label="Cor do Título" value={config.secaoGrid?.corTitulo} defaultValue="#1F2937" onChange={(v) => handleSecaoChange('secaoGrid', 'corTitulo', v)} />
              <ColorPickerRow label="Cor do Texto" value={config.secaoGrid?.corTexto} defaultValue="#1F2937" onChange={(v) => handleSecaoChange('secaoGrid', 'corTexto', v)} />
              <ColorPickerRow label="Cor Borda Card" value={config.secaoGrid?.corBordaCard} defaultValue="#E5E7EB" onChange={(v) => handleSecaoChange('secaoGrid', 'corBordaCard', v)} />
            </SecaoCoresCollapsible>
          </div>
        )}
      </TabsContent>

      {/* ========== CONTATO ========== */}
      <TabsContent value="contato" className="space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Mostrar Contato</Label>
            <p className="text-xs text-muted-foreground">WhatsApp, endereço e horário</p>
          </div>
          <Switch checked={config.mostrarContato} onCheckedChange={(v) => handleChange('mostrarContato', v)} />
        </div>

        {config.mostrarContato && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título da Seção de Contato</Label>
              <Input value={config.tituloContato || 'Entre em Contato'} onChange={(e) => handleChange('tituloContato', e.target.value)} placeholder="Entre em Contato" />
            </div>

            <div className="flex items-center justify-between">
              <div><Label>Mostrar Endereço</Label><p className="text-xs text-muted-foreground">Exibe o endereço da loja cadastrado</p></div>
              <Switch checked={config.mostrarEndereco} onCheckedChange={(v) => handleChange('mostrarEndereco', v)} />
            </div>

            <div className="flex items-center justify-between">
              <div><Label>Mostrar Horário</Label><p className="text-xs text-muted-foreground">Exibe o horário de funcionamento</p></div>
              <Switch checked={config.mostrarHorario} onCheckedChange={(v) => handleChange('mostrarHorario', v)} />
            </div>

            {config.mostrarHorario && (
              <div className="space-y-2">
                <Label>Horário de Funcionamento</Label>
                <Input value={config.horarioFuncionamento || ''} onChange={(e) => handleChange('horarioFuncionamento', e.target.value)} placeholder="Seg a Sex: 9h às 18h" />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div><Label>Mostrar Redes Sociais</Label><p className="text-xs text-muted-foreground">Links para Instagram e Facebook</p></div>
              <Switch checked={config.mostrarRedesSociais} onCheckedChange={(v) => handleChange('mostrarRedesSociais', v)} />
            </div>

            {config.mostrarRedesSociais && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input value={config.linkInstagram || ''} onChange={(e) => handleChange('linkInstagram', e.target.value)} placeholder="https://instagram.com/sualoja" />
                </div>
                <div className="space-y-2">
                  <Label>Facebook</Label>
                  <Input value={config.linkFacebook || ''} onChange={(e) => handleChange('linkFacebook', e.target.value)} placeholder="https://facebook.com/sualoja" />
                </div>
              </div>
            )}

            {/* Botão Extra */}
            <div className="pt-3 border-t space-y-3">
              <div className="flex items-center justify-between">
                <div><Label>Botão Extra</Label><p className="text-xs text-muted-foreground">Adicione um botão customizado na seção</p></div>
                <Switch checked={config.secaoContato?.mostrarBotaoExtra || false} onCheckedChange={(v) => handleSecaoChange('secaoContato', 'mostrarBotaoExtra', v)} />
              </div>
              {config.secaoContato?.mostrarBotaoExtra && (
                <div className="space-y-2">
                  <Input value={config.secaoContato?.textoBotaoExtra || ''} onChange={(e) => handleSecaoChange('secaoContato', 'textoBotaoExtra', e.target.value)} placeholder="Texto do botão" />
                  <Input value={config.secaoContato?.linkBotaoExtra || ''} onChange={(e) => handleSecaoChange('secaoContato', 'linkBotaoExtra', e.target.value)} placeholder="https://link-do-botao.com" />
                </div>
              )}
            </div>

            {/* WhatsApp flutuante */}
            <div className="pt-3 border-t space-y-3">
              <Label className="text-sm font-semibold">Botão WhatsApp Flutuante</Label>
              <div className="space-y-2">
                <Label className="text-xs">Posição</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['direita', 'esquerda'] as const).map((pos) => (
                    <button key={pos} onClick={() => handleChange('posicaoWhatsApp', pos)}
                      className={`p-2 border rounded-lg text-center text-xs capitalize transition-all ${(config.posicaoWhatsApp || 'direita') === pos ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'}`}>
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Texto do botão (opcional)</Label>
                <Input value={config.textoWhatsApp || ''} onChange={(e) => handleChange('textoWhatsApp', e.target.value)} placeholder="Fale conosco" />
              </div>
            </div>

            <SecaoCoresCollapsible title="Personalizar cores do Contato">
              <ColorPickerRow label="Cor de Fundo" value={config.secaoContato?.corFundo} defaultValue="#F8FAFC" onChange={(v) => handleSecaoChange('secaoContato', 'corFundo', v)} />
              <ColorPickerRow label="Cor do Título" value={config.secaoContato?.corTitulo} defaultValue="#1F2937" onChange={(v) => handleSecaoChange('secaoContato', 'corTitulo', v)} />
              <ColorPickerRow label="Cor do Texto" value={config.secaoContato?.corTexto} defaultValue="#1F2937" onChange={(v) => handleSecaoChange('secaoContato', 'corTexto', v)} />
              <ColorPickerRow label="Cor dos Ícones" value={config.secaoContato?.corIcones} defaultValue="#3B82F6" onChange={(v) => handleSecaoChange('secaoContato', 'corIcones', v)} />
            </SecaoCoresCollapsible>
          </div>
        )}

        {/* Footer dentro de contato */}
        <div className="pt-4 border-t space-y-3">
          <div className="flex items-center justify-between">
            <div><Label>Rodapé (Footer)</Label><p className="text-xs text-muted-foreground">Informações finais e créditos</p></div>
            <Switch checked={config.mostrarFooter} onCheckedChange={(v) => handleChange('mostrarFooter', v)} />
          </div>
          {config.mostrarFooter && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Texto do Rodapé</Label>
                <Input value={config.textoRodape || ''} onChange={(e) => handleChange('textoRodape', e.target.value)} placeholder="Todos os direitos reservados." />
              </div>
              <SecaoCoresCollapsible title="Personalizar cores do Rodapé">
                <ColorPickerRow label="Cor de Fundo" value={config.secaoFooter?.corFundo} defaultValue="#1F2937" onChange={(v) => handleSecaoChange('secaoFooter', 'corFundo', v)} />
                <ColorPickerRow label="Cor do Texto" value={config.secaoFooter?.corTexto} defaultValue="#FFFFFF" onChange={(v) => handleSecaoChange('secaoFooter', 'corTexto', v)} />
              </SecaoCoresCollapsible>
            </div>
          )}
        </div>
      </TabsContent>

      {/* ========== GLOBAL / PREMIUM ========== */}
      <TabsContent value="global" className="space-y-4 mt-4">
        {/* Upload Logo LP */}
        <div className="space-y-3">
          <Label className="font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Logo da Landing Page
          </Label>
          <p className="text-xs text-muted-foreground">Logo independente que aparece no header da LP</p>
          {config.logoLandingPageUrl ? (
            <div className="relative inline-block">
              <img src={config.logoLandingPageUrl} alt="Logo LP" className="h-16 w-auto object-contain rounded-lg border p-1" />
              <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 w-6 h-6" onClick={() => handleChange('logoLandingPageUrl', undefined)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <label className="flex items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Image className="w-5 h-5" />
                <span className="text-sm">{uploadingLogo ? "Enviando..." : "Enviar logo"}</span>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadFile(e, 'logo-lp', (url) => handleChange('logoLandingPageUrl', url), setUploadingLogo)} disabled={uploadingLogo} />
            </label>
          )}
        </div>

        {/* Badge/Selo */}
        <div className="pt-3 border-t space-y-3">
          <div className="flex items-center justify-between">
            <div><Label>Selo/Badge Promocional</Label><p className="text-xs text-muted-foreground">Ex: "Frete Grátis", "Promoção"</p></div>
            <Switch checked={config.mostrarBadge || false} onCheckedChange={(v) => handleChange('mostrarBadge', v)} />
          </div>
          {config.mostrarBadge && (
            <div className="space-y-2">
              <Input value={config.textoBadge || ''} onChange={(e) => handleChange('textoBadge', e.target.value)} placeholder="🔥 Promoção de Verão" />
              <div className="flex items-center gap-2">
                <Label className="text-xs">Cor</Label>
                <input type="color" value={config.corBadge || '#EF4444'} onChange={(e) => handleChange('corBadge', e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
              </div>
            </div>
          )}
        </div>

        {/* Tipografia */}
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-muted-foreground" />
            <Label className="font-semibold">Tipografia</Label>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Fonte dos Títulos</Label>
            <Select value={config.fonteTitulo || 'inter'} onValueChange={(v) => handleChange('fonteTitulo', v as ConfigLPType['fonteTitulo'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inter">Inter (Moderno)</SelectItem>
                <SelectItem value="poppins">Poppins (Arredondado)</SelectItem>
                <SelectItem value="playfair">Playfair Display (Elegante)</SelectItem>
                <SelectItem value="montserrat">Montserrat (Geométrico)</SelectItem>
                <SelectItem value="raleway">Raleway (Fino)</SelectItem>
                <SelectItem value="oswald">Oswald (Impacto)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Fonte do Corpo</Label>
            <Select value={config.fonteCorpo || 'inter'} onValueChange={(v) => handleChange('fonteCorpo', v as ConfigLPType['fonteCorpo'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inter">Inter</SelectItem>
                <SelectItem value="poppins">Poppins</SelectItem>
                <SelectItem value="open-sans">Open Sans</SelectItem>
                <SelectItem value="roboto">Roboto</SelectItem>
                <SelectItem value="lato">Lato</SelectItem>
                <SelectItem value="nunito">Nunito</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Estilo Header */}
        <div className="space-y-3 pt-3 border-t">
          <Label className="font-semibold">Estilo do Header</Label>
          <div className="grid grid-cols-3 gap-2">
            {([{ id: 'fixo', label: 'Fixo' }, { id: 'transparente', label: 'Transparente' }, { id: 'colorido', label: 'Colorido' }] as const).map((h) => (
              <button key={h.id} onClick={() => handleChange('headerEstilo', h.id)}
                className={`p-2 border rounded-lg text-center text-xs transition-all ${(config.headerEstilo || 'fixo') === h.id ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'}`}>
                {h.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cores globais customizadas */}
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-muted-foreground" />
            <Label className="font-semibold">Cores Globais</Label>
          </div>
          <p className="text-xs text-muted-foreground">Sobrepõem as cores do template</p>
          <div className="grid grid-cols-2 gap-3">
            <ColorPickerRow label="Fundo" value={config.corFundoCustom} defaultValue="#FFFFFF" onChange={(v) => handleChange('corFundoCustom', v)} />
            <ColorPickerRow label="Texto" value={config.corTextoCustom} defaultValue="#1F2937" onChange={(v) => handleChange('corTextoCustom', v)} />
            <ColorPickerRow label="Botão CTA" value={config.corBotaoCustom} defaultValue="#3B82F6" onChange={(v) => handleChange('corBotaoCustom', v)} />
            <ColorPickerRow label="Texto Botão" value={config.corBotaoTextoCustom} defaultValue="#FFFFFF" onChange={(v) => handleChange('corBotaoTextoCustom', v)} />
          </div>
        </div>

        {/* Restaurar padrão */}
        <div className="pt-4 border-t">
          <Button variant="outline" size="sm" onClick={() => onConfigChange(LANDING_PAGE_PADRAO)} className="w-full">
            Restaurar Configurações Padrão
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
