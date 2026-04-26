import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  CalendarIcon, 
  Loader2, 
  Image, 
  Palette, 
  Upload, 
  X, 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  Gift, 
  ExternalLink,
  Monitor,
  Smartphone,
  ChevronDown,
  Eye,
  Settings2,
  Users,
  Clock,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { AvisoSistemaInsert } from '@/types/aviso';
import { TIPOS_PLANO, TIPOS_AVISO, POSICOES_IMAGEM, CORES_PRESET } from '@/types/aviso';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AvisoSistemaDB {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  icone: string | null;
  link_url: string | null;
  link_texto: string | null;
  publico_alvo: string[];
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
  prioridade: number;
  cor_fundo: string | null;
  cor_texto: string | null;
  cor_icone: string | null;
  cor_botao: string | null;
  imagem_url: string | null;
  imagem_posicao: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface DialogCadastroAvisoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avisoParaEditar?: AvisoSistemaDB | null;
  onSalvar: (aviso: AvisoSistemaInsert) => Promise<boolean>;
  onAtualizar?: (id: string, aviso: Partial<AvisoSistemaInsert>) => Promise<boolean>;
}

const GUIA_TAMANHOS = {
  topo: { desktop: '1200×200', mobile: '600×150', desc: 'Banner horizontal' },
  fundo: { desktop: '1200×200', mobile: '600×150', desc: 'Banner horizontal' },
  direita: { desktop: '200×200', mobile: '120×120', desc: 'Imagem quadrada' },
  esquerda: { desktop: '200×200', mobile: '120×120', desc: 'Imagem quadrada' },
};

function ColorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-9 w-full rounded-md border flex items-center gap-2 px-3 text-sm",
              "hover:bg-accent transition-colors",
              value ? "border-primary/50" : "border-input"
            )}
          >
            <div 
              className="h-5 w-5 rounded-md border shadow-sm flex-shrink-0"
              style={{ backgroundColor: value || '#E5E7EB' }}
            />
            <span className="truncate text-left flex-1">
              {value || 'Automático'}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-3" align="start">
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-1.5">
              {CORES_PRESET.map((cor) => (
                <button
                  key={cor.value}
                  type="button"
                  className={cn(
                    "h-8 w-8 rounded-lg border-2 transition-all hover:scale-105",
                    value === cor.value ? "border-primary ring-2 ring-primary/20" : "border-transparent"
                  )}
                  style={{ backgroundColor: cor.value }}
                  onClick={() => onChange(cor.value)}
                  title={cor.label}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="color"
                value={value || '#3B82F6'}
                onChange={(e) => onChange(e.target.value)}
                className="w-10 h-8 p-0.5 cursor-pointer"
              />
              <Input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder="#HEX"
                className="flex-1 h-8 text-xs font-mono"
              />
            </div>
            {value && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full h-7 text-xs" 
                onClick={() => onChange('')}
              >
                Usar cor automática
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function PreviewCard({ 
  titulo, 
  mensagem, 
  tipo, 
  corFundo, 
  corTexto, 
  corIcone, 
  corBotao, 
  imagemUrl, 
  imagemPosicao,
  linkTexto,
  isMobile = false,
}: {
  titulo: string;
  mensagem: string;
  tipo: string;
  corFundo: string;
  corTexto: string;
  corIcone: string;
  corBotao: string;
  imagemUrl: string;
  imagemPosicao: string;
  linkTexto: string;
  isMobile?: boolean;
}) {
  const getDefaultStyles = () => {
    switch (tipo) {
      case 'warning':
        return { bg: '#FEF9C3', text: '#854D0E', icon: '#CA8A04', button: '#CA8A04' };
      case 'success':
        return { bg: '#DCFCE7', text: '#166534', icon: '#16A34A', button: '#16A34A' };
      case 'promo':
        return { bg: '#F3E8FF', text: '#6B21A8', icon: '#9333EA', button: '#9333EA' };
      default:
        return { bg: '#DBEAFE', text: '#1E40AF', icon: '#2563EB', button: '#2563EB' };
    }
  };

  const defaults = getDefaultStyles();
  const finalBg = corFundo || defaults.bg;
  const finalText = corTexto || defaults.text;
  const finalIcon = corIcone || defaults.icon;
  const finalButton = corBotao || defaults.button;

  const Icon = tipo === 'warning' ? AlertTriangle : 
               tipo === 'success' ? CheckCircle : 
               tipo === 'promo' ? Gift : Info;

  const hasTopImage = imagemUrl && imagemPosicao === 'topo';
  const hasBottomImage = imagemUrl && imagemPosicao === 'fundo';
  const hasSideImage = imagemUrl && (imagemPosicao === 'direita' || imagemPosicao === 'esquerda');
  const isLeftImage = imagemPosicao === 'esquerda';

  return (
    <Card 
      className="overflow-hidden border-2 shadow-lg"
      style={{ 
        backgroundColor: finalBg,
        borderColor: finalIcon,
      }}
    >
      {hasTopImage && (
        <div className={cn("w-full overflow-hidden", isMobile ? "h-16" : "h-24")}>
          <img src={imagemUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      
      <div className={cn(
        "flex gap-3",
        isMobile ? "p-3" : "p-4",
        hasSideImage && isLeftImage && "flex-row-reverse"
      )}>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div 
              className={cn(
                "flex-shrink-0 rounded-full flex items-center justify-center",
                isMobile ? "h-8 w-8" : "h-10 w-10"
              )}
              style={{ backgroundColor: `${finalIcon}25`, color: finalIcon }}
            >
              <Icon className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 
                className={cn("font-semibold mb-0.5 line-clamp-1", isMobile ? "text-sm" : "text-base")}
                style={{ color: finalText }}
              >
                {titulo || 'Título do aviso'}
              </h3>
              <p 
                className={cn("leading-relaxed line-clamp-2", isMobile ? "text-xs" : "text-sm")}
                style={{ color: finalText, opacity: 0.85 }}
              >
                {mensagem || 'A mensagem do aviso será exibida aqui...'}
              </p>
              {linkTexto && (
                <Button 
                  size="sm" 
                  className={cn("mt-2", isMobile ? "h-6 text-xs px-2" : "h-7 text-xs")}
                  style={{ backgroundColor: finalButton }}
                >
                  {linkTexto}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {hasSideImage && (
          <div className={cn(
            "flex-shrink-0 rounded-lg overflow-hidden",
            isMobile ? "w-14 h-14" : "w-20 h-20"
          )}>
            <img src={imagemUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {hasBottomImage && (
        <div className={cn("w-full overflow-hidden", isMobile ? "h-16" : "h-24")}>
          <img src={imagemUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </Card>
  );
}

export function DialogCadastroAviso({
  open,
  onOpenChange,
  avisoParaEditar,
  onSalvar,
  onAtualizar,
}: DialogCadastroAvisoProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [tipo, setTipo] = useState<string>('info');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTexto, setLinkTexto] = useState('');
  const [publicoAlvo, setPublicoAlvo] = useState<string[]>(['todos']);
  const [ativo, setAtivo] = useState(true);
  const [dataInicio, setDataInicio] = useState<Date>(new Date());
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [prioridade, setPrioridade] = useState(5);
  
  const [corFundo, setCorFundo] = useState('');
  const [corTexto, setCorTexto] = useState('');
  const [corIcone, setCorIcone] = useState('');
  const [corBotao, setCorBotao] = useState('');
  const [imagemUrl, setImagemUrl] = useState('');
  const [imagemPosicao, setImagemPosicao] = useState<string>('direita');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  
  const [showAppearance, setShowAppearance] = useState(false);
  const [showAudience, setShowAudience] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!avisoParaEditar;

  useEffect(() => {
    if (avisoParaEditar) {
      setTitulo(avisoParaEditar.titulo);
      setMensagem(avisoParaEditar.mensagem);
      setTipo(avisoParaEditar.tipo);
      setLinkUrl(avisoParaEditar.link_url || '');
      setLinkTexto(avisoParaEditar.link_texto || '');
      setPublicoAlvo(avisoParaEditar.publico_alvo);
      setAtivo(avisoParaEditar.ativo);
      setDataInicio(new Date(avisoParaEditar.data_inicio));
      setDataFim(avisoParaEditar.data_fim ? new Date(avisoParaEditar.data_fim) : undefined);
      setPrioridade(avisoParaEditar.prioridade);
      setCorFundo(avisoParaEditar.cor_fundo || '');
      setCorTexto(avisoParaEditar.cor_texto || '');
      setCorIcone(avisoParaEditar.cor_icone || '');
      setCorBotao(avisoParaEditar.cor_botao || '');
      setImagemUrl(avisoParaEditar.imagem_url || '');
      setImagemPosicao(avisoParaEditar.imagem_posicao || 'direita');
    } else {
      resetForm();
    }
  }, [avisoParaEditar, open]);

  const resetForm = () => {
    setTitulo('');
    setMensagem('');
    setTipo('info');
    setLinkUrl('');
    setLinkTexto('');
    setPublicoAlvo(['todos']);
    setAtivo(true);
    setDataInicio(new Date());
    setDataFim(undefined);
    setPrioridade(5);
    setCorFundo('');
    setCorTexto('');
    setCorIcone('');
    setCorBotao('');
    setImagemUrl('');
    setImagemPosicao('direita');
    setShowAppearance(false);
    setShowAudience(false);
    setShowSchedule(false);
  };

  const togglePublicoAlvo = (value: string) => {
    if (value === 'todos') {
      setPublicoAlvo(['todos']);
    } else {
      let newPublicoAlvo = publicoAlvo.filter(p => p !== 'todos');
      if (newPublicoAlvo.includes(value)) {
        newPublicoAlvo = newPublicoAlvo.filter(p => p !== value);
      } else {
        newPublicoAlvo.push(value);
      }
      if (newPublicoAlvo.length === 0) {
        newPublicoAlvo = ['todos'];
      }
      setPublicoAlvo(newPublicoAlvo);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setUploadingImage(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `avisos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avisos-imagens')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avisos-imagens')
        .getPublicUrl(filePath);

      setImagemUrl(publicUrl);
      toast.success('Imagem enviada!');
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !mensagem.trim()) return;

    setLoading(true);

    const avisoData: AvisoSistemaInsert = {
      titulo: titulo.trim(),
      mensagem: mensagem.trim(),
      tipo,
      link_url: linkUrl.trim() || null,
      link_texto: linkTexto.trim() || null,
      publico_alvo: publicoAlvo,
      ativo,
      data_inicio: dataInicio.toISOString(),
      data_fim: dataFim?.toISOString() || null,
      prioridade,
      cor_fundo: corFundo || null,
      cor_texto: corTexto || null,
      cor_icone: corIcone || null,
      cor_botao: corBotao || null,
      imagem_url: imagemUrl.trim() || null,
      imagem_posicao: imagemPosicao as any || null,
    };

    let success = false;
    if (isEditing && onAtualizar) {
      success = await onAtualizar(avisoParaEditar.id, avisoData);
    } else {
      success = await onSalvar(avisoData);
    }

    setLoading(false);
    if (success) onOpenChange(false);
  };

  const currentSizeGuide = GUIA_TAMANHOS[imagemPosicao as keyof typeof GUIA_TAMANHOS] || GUIA_TAMANHOS.direita;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] p-0 gap-0 overflow-hidden">
        <div className="flex flex-col h-full max-h-[90vh]">
          {/* Header */}
          <DialogHeader className="px-4 sm:px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">{isEditing ? 'Editar Aviso' : 'Novo Aviso'}</DialogTitle>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1 bg-muted rounded-lg p-1">
                  <Button
                    type="button"
                    variant={previewMode === 'desktop' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 gap-1"
                    onClick={() => setPreviewMode('desktop')}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    <span className="text-xs hidden md:inline">Desktop</span>
                  </Button>
                  <Button
                    type="button"
                    variant={previewMode === 'mobile' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 gap-1"
                    onClick={() => setPreviewMode('mobile')}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span className="text-xs hidden md:inline">Mobile</span>
                  </Button>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Form */}
            <ScrollArea className="flex-1 lg:max-w-[55%]">
              <form id="aviso-form" onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
                {/* Conteúdo Principal */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="titulo" className="text-sm font-medium">Título *</Label>
                    <Input
                      id="titulo"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex: Nova funcionalidade disponível!"
                      className="h-10"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mensagem" className="text-sm font-medium">Mensagem *</Label>
                    <Textarea
                      id="mensagem"
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      placeholder="Descreva o aviso para seus usuários..."
                      rows={3}
                      className="resize-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Tipo</Label>
                      <Select value={tipo} onValueChange={setTipo}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_AVISO.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.cor }} />
                                {t.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Prioridade</Label>
                        <Badge variant="outline" className="font-mono">{prioridade}</Badge>
                      </div>
                      <Slider
                        value={[prioridade]}
                        onValueChange={([v]) => setPrioridade(v)}
                        min={1}
                        max={10}
                        step={1}
                        className="mt-3"
                      />
                    </div>
                  </div>

                  {/* Link */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">URL do Botão</Label>
                      <Input
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://..."
                        type="url"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Texto do Botão</Label>
                      <Input
                        value={linkTexto}
                        onChange={(e) => setLinkTexto(e.target.value)}
                        placeholder="Saiba Mais"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Seções Colapsáveis */}
                <div className="space-y-3">
                  {/* Aparência */}
                  <Collapsible open={showAppearance} onOpenChange={setShowAppearance}>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between h-11"
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          <span className="font-medium">Aparência</span>
                          {(imagemUrl || corFundo || corTexto) && (
                            <Badge variant="secondary" className="text-xs">Personalizado</Badge>
                          )}
                        </div>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", showAppearance && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3 space-y-4">
                      {/* Imagem */}
                      <div className="space-y-3 p-4 rounded-xl border bg-card">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Image className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Imagem</span>
                          </div>
                          {imagemUrl && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setImagemUrl('')}
                              className="h-7 text-destructive hover:text-destructive"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Remover
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Posição</Label>
                            <Select value={imagemPosicao} onValueChange={setImagemPosicao}>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {POSICOES_IMAGEM.map((pos) => (
                                  <SelectItem key={pos.value} value={pos.value}>
                                    {pos.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Tamanhos sugeridos</Label>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="outline" className="text-xs gap-1">
                                <Monitor className="h-3 w-3" />
                                {currentSizeGuide.desktop}
                              </Badge>
                              <Badge variant="outline" className="text-xs gap-1">
                                <Smartphone className="h-3 w-3" />
                                {currentSizeGuide.mobile}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />

                        {imagemUrl ? (
                          <div className="relative rounded-lg border overflow-hidden bg-muted/50">
                            <img src={imagemUrl} alt="Preview" className="w-full max-h-28 object-contain" />
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full h-20 border-dashed hover:border-primary/50 hover:bg-primary/5"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                          >
                            {uploadingImage ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                                <Upload className="h-5 w-5" />
                                <span className="text-xs">Clique para enviar (máx. 5MB)</span>
                              </div>
                            )}
                          </Button>
                        )}
                      </div>

                      {/* Cores */}
                      <div className="space-y-3 p-4 rounded-xl border bg-card">
                        <div className="flex items-center gap-2">
                          <Palette className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Cores</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <ColorPicker label="Fundo" value={corFundo} onChange={setCorFundo} />
                          <ColorPicker label="Texto" value={corTexto} onChange={setCorTexto} />
                          <ColorPicker label="Ícone" value={corIcone} onChange={setCorIcone} />
                          <ColorPicker label="Botão" value={corBotao} onChange={setCorBotao} />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Público-alvo */}
                  <Collapsible open={showAudience} onOpenChange={setShowAudience}>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between h-11"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">Público-alvo</span>
                          <Badge variant="secondary" className="text-xs">
                            {publicoAlvo.includes('todos') ? 'Todos' : `${publicoAlvo.length} planos`}
                          </Badge>
                        </div>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", showAudience && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <div className="p-4 rounded-xl border bg-card">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {TIPOS_PLANO.map((plano) => (
                            <div key={plano.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={`plano-${plano.value}`}
                                checked={publicoAlvo.includes(plano.value)}
                                onCheckedChange={() => togglePublicoAlvo(plano.value)}
                              />
                              <label
                                htmlFor={`plano-${plano.value}`}
                                className="text-sm cursor-pointer leading-tight"
                              >
                                {plano.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Agendamento */}
                  <Collapsible open={showSchedule} onOpenChange={setShowSchedule}>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between h-11"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-green-500" />
                          <span className="font-medium">Agendamento</span>
                          <Badge variant="secondary" className="text-xs">
                            {format(dataInicio, 'dd/MM', { locale: ptBR })}
                            {dataFim ? ` - ${format(dataFim, 'dd/MM', { locale: ptBR })}` : ' - Sem fim'}
                          </Badge>
                        </div>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", showSchedule && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <div className="p-4 rounded-xl border bg-card space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Início</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start h-10">
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {format(dataInicio, 'dd/MM/yyyy', { locale: ptBR })}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={dataInicio}
                                  onSelect={(date) => date && setDataInicio(date)}
                                  locale={ptBR}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Término</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start h-10">
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {dataFim ? format(dataFim, 'dd/MM/yyyy', { locale: ptBR }) : 'Sem término'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <div className="p-2 border-b">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDataFim(undefined)}
                                    className="w-full text-xs"
                                  >
                                    Remover data de término
                                  </Button>
                                </div>
                                <Calendar
                                  mode="single"
                                  selected={dataFim}
                                  onSelect={setDataFim}
                                  locale={ptBR}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                {/* Status */}
                <div className="flex items-center gap-3 p-4 rounded-xl border bg-card">
                  <Checkbox
                    id="ativo"
                    checked={ativo}
                    onCheckedChange={(v) => setAtivo(!!v)}
                  />
                  <div>
                    <label htmlFor="ativo" className="text-sm font-medium cursor-pointer">
                      Aviso ativo
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Quando ativo, será exibido na dashboard dos usuários
                    </p>
                  </div>
                </div>

                {/* Preview Mobile (só aparece em mobile) */}
                <div className="lg:hidden space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Pré-visualização</span>
                    </div>
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                      <Button
                        type="button"
                        variant={previewMode === 'desktop' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => setPreviewMode('desktop')}
                      >
                        <Monitor className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant={previewMode === 'mobile' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => setPreviewMode('mobile')}
                      >
                        <Smartphone className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <PreviewCard
                    titulo={titulo}
                    mensagem={mensagem}
                    tipo={tipo}
                    corFundo={corFundo}
                    corTexto={corTexto}
                    corIcone={corIcone}
                    corBotao={corBotao}
                    imagemUrl={imagemUrl}
                    imagemPosicao={imagemPosicao}
                    linkTexto={linkTexto}
                    isMobile={previewMode === 'mobile'}
                  />
                </div>
              </form>
            </ScrollArea>

            {/* Preview Desktop */}
            <div className="hidden lg:flex flex-col w-[45%] border-l bg-gradient-to-b from-muted/30 to-muted/10">
              <div className="flex-1 p-6 flex items-start justify-center overflow-auto">
                <div className={cn(
                  "transition-all duration-300 w-full",
                  previewMode === 'mobile' ? "max-w-[280px]" : "max-w-md"
                )}>
                  <PreviewCard
                    titulo={titulo}
                    mensagem={mensagem}
                    tipo={tipo}
                    corFundo={corFundo}
                    corTexto={corTexto}
                    corIcone={corIcone}
                    corBotao={corBotao}
                    imagemUrl={imagemUrl}
                    imagemPosicao={imagemPosicao}
                    linkTexto={linkTexto}
                    isMobile={previewMode === 'mobile'}
                  />
                </div>
              </div>
              <div className="px-6 py-3 border-t bg-background/50 backdrop-blur-sm">
                <p className="text-xs text-muted-foreground text-center">
                  Visualização em tempo real • {previewMode === 'desktop' ? 'Desktop' : 'Mobile'}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t bg-background flex-shrink-0">
            <div className="flex items-center gap-2">
              {ativo ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>
              ) : (
                <Badge variant="secondary">Inativo</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                form="aviso-form"
                disabled={loading || !titulo.trim() || !mensagem.trim()}
                className="min-w-[100px]"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Salvar' : 'Criar Aviso'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
