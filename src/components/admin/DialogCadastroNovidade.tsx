import { useState, useEffect } from "react";
import { 
  Novidade, 
  NovidadeInsert, 
  SecaoNovidade, 
  TipoSecao,
  PUBLICO_ALVO_OPTIONS 
} from "@/types/novidade";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditorSecaoNovidade } from "./EditorSecaoNovidade";
import { VisualizadorNovidade } from "@/components/novidades/VisualizadorNovidade";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  CalendarIcon, 
  Plus, 
  Layers, 
  Video, 
  Image as ImageIcon, 
  FileText, 
  Type, 
  LayoutGrid,
  Upload,
  Monitor,
  Smartphone
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogCadastroNovidadeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novidadeParaEditar?: Novidade | null;
  onSalvar: (novidade: NovidadeInsert) => void;
  onAtualizar: (id: string, updates: Partial<NovidadeInsert>) => void;
  onUploadImage: (file: File) => Promise<string>;
}

const SECAO_TEMPLATES: { tipo: TipoSecao; label: string; icon: React.ReactNode }[] = [
  { tipo: 'banner', label: 'Banner', icon: <Layers className="h-4 w-4" /> },
  { tipo: 'video', label: 'Vídeo', icon: <Video className="h-4 w-4" /> },
  { tipo: 'imagem', label: 'Imagem', icon: <ImageIcon className="h-4 w-4" /> },
  { tipo: 'card', label: 'Card', icon: <FileText className="h-4 w-4" /> },
  { tipo: 'texto', label: 'Texto', icon: <Type className="h-4 w-4" /> },
  { tipo: 'grid', label: 'Grid', icon: <LayoutGrid className="h-4 w-4" /> },
];

export function DialogCadastroNovidade({ 
  open, 
  onOpenChange, 
  novidadeParaEditar,
  onSalvar,
  onAtualizar,
  onUploadImage
}: DialogCadastroNovidadeProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [secoes, setSecoes] = useState<SecaoNovidade[]>([]);
  const [publicoAlvo, setPublicoAlvo] = useState<string[]>([]);
  const [ativo, setAtivo] = useState(false);
  const [dataInicio, setDataInicio] = useState<Date>(new Date());
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [prioridade, setPrioridade] = useState(0);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [uploadingThumb, setUploadingThumb] = useState(false);

  useEffect(() => {
    if (novidadeParaEditar) {
      setTitulo(novidadeParaEditar.titulo);
      setDescricao(novidadeParaEditar.descricao || '');
      setThumbnailUrl(novidadeParaEditar.thumbnail_url || '');
      setSecoes(novidadeParaEditar.conteudo || []);
      setPublicoAlvo(novidadeParaEditar.publico_alvo || []);
      setAtivo(novidadeParaEditar.ativo);
      setDataInicio(new Date(novidadeParaEditar.data_inicio));
      setDataFim(novidadeParaEditar.data_fim ? new Date(novidadeParaEditar.data_fim) : undefined);
      setPrioridade(novidadeParaEditar.prioridade);
    } else {
      resetForm();
    }
  }, [novidadeParaEditar, open]);

  const resetForm = () => {
    setTitulo('');
    setDescricao('');
    setThumbnailUrl('');
    setSecoes([]);
    setPublicoAlvo(PUBLICO_ALVO_OPTIONS.map(o => o.value));
    setAtivo(false);
    setDataInicio(new Date());
    setDataFim(undefined);
    setPrioridade(0);
  };

  const handleAddSecao = (tipo: TipoSecao) => {
    const novaSecao: SecaoNovidade = {
      id: crypto.randomUUID(),
      tipo,
      ordem: secoes.length,
      config: getDefaultConfig(tipo),
    };
    setSecoes([...secoes, novaSecao]);
  };

  const getDefaultConfig = (tipo: TipoSecao): any => {
    switch (tipo) {
      case 'banner':
        return { imagem_url: '', largura: 'full', altura: 'medium' };
      case 'video':
        return { video_url: '' };
      case 'imagem':
        return { imagem_url: '', posicao: 'center' };
      case 'card':
        return { titulo: '' };
      case 'texto':
        return { conteudo: '', estilo: 'normal' };
      case 'grid':
        return { colunas: 3, itens: [] };
      default:
        return {};
    }
  };

  const handleUpdateSecao = (index: number, secao: SecaoNovidade) => {
    const novasSecoes = [...secoes];
    novasSecoes[index] = secao;
    setSecoes(novasSecoes);
  };

  const handleRemoveSecao = (index: number) => {
    setSecoes(secoes.filter((_, i) => i !== index));
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingThumb(true);
    try {
      const url = await onUploadImage(file);
      setThumbnailUrl(url);
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleSalvar = () => {
    const dados: NovidadeInsert = {
      titulo,
      descricao: descricao || undefined,
      thumbnail_url: thumbnailUrl || undefined,
      conteudo: secoes,
      publico_alvo: publicoAlvo,
      ativo,
      data_inicio: dataInicio.toISOString(),
      data_fim: dataFim?.toISOString(),
      prioridade,
    };

    if (novidadeParaEditar) {
      onAtualizar(novidadeParaEditar.id, dados);
    } else {
      onSalvar(dados);
    }
    
    onOpenChange(false);
  };

  const togglePublicoAlvo = (value: string) => {
    if (publicoAlvo.includes(value)) {
      setPublicoAlvo(publicoAlvo.filter(p => p !== value));
    } else {
      setPublicoAlvo([...publicoAlvo, value]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>
            {novidadeParaEditar ? 'Editar Novidade' : 'Nova Novidade'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[calc(95vh-120px)]">
          {/* Editor */}
          <div className="flex-1 border-r">
            <Tabs defaultValue="conteudo" className="h-full flex flex-col">
              <TabsList className="mx-6">
                <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
                <TabsTrigger value="publico">Público</TabsTrigger>
                <TabsTrigger value="agendamento">Agendamento</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 px-6 pb-6">
                <TabsContent value="conteudo" className="mt-4 space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label>Título *</Label>
                      <Input 
                        value={titulo} 
                        onChange={(e) => setTitulo(e.target.value)}
                        placeholder="Título da novidade"
                      />
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea 
                        value={descricao} 
                        onChange={(e) => setDescricao(e.target.value)}
                        placeholder="Breve descrição..."
                      />
                    </div>
                    <div>
                      <Label>Thumbnail</Label>
                      <div className="flex gap-2 mt-1">
                        <Input 
                          value={thumbnailUrl} 
                          onChange={(e) => setThumbnailUrl(e.target.value)}
                          placeholder="URL da imagem de capa"
                        />
                        <Button variant="outline" size="icon" asChild disabled={uploadingThumb}>
                          <label className="cursor-pointer">
                            <Upload className="h-4 w-4" />
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={handleThumbUpload}
                            />
                          </label>
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Seções</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar Seção
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {SECAO_TEMPLATES.map((template) => (
                            <DropdownMenuItem 
                              key={template.tipo}
                              onClick={() => handleAddSecao(template.tipo)}
                            >
                              {template.icon}
                              <span className="ml-2">{template.label}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-3">
                      {secoes.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                          Clique em "Adicionar Seção" para começar
                        </div>
                      ) : (
                        secoes.map((secao, index) => (
                          <EditorSecaoNovidade
                            key={secao.id}
                            secao={secao}
                            onUpdate={(s) => handleUpdateSecao(index, s)}
                            onRemove={() => handleRemoveSecao(index)}
                            onUploadImage={onUploadImage}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="publico" className="mt-4 space-y-4">
                  <div>
                    <Label className="mb-3 block">Quem pode ver esta novidade?</Label>
                    <div className="space-y-2">
                      {PUBLICO_ALVO_OPTIONS.map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={option.value}
                            checked={publicoAlvo.includes(option.value)}
                            onCheckedChange={() => togglePublicoAlvo(option.value)}
                          />
                          <label 
                            htmlFor={option.value}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {option.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setPublicoAlvo(PUBLICO_ALVO_OPTIONS.map(o => o.value))}
                    >
                      Selecionar Todos
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setPublicoAlvo([])}
                    >
                      Limpar Seleção
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="agendamento" className="mt-4 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ativo"
                      checked={ativo}
                      onCheckedChange={setAtivo}
                    />
                    <Label htmlFor="ativo">Publicar imediatamente</Label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Data de Início</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !dataInicio && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dataInicio ? format(dataInicio, "PPP", { locale: ptBR }) : "Selecionar data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={dataInicio}
                            onSelect={(date) => date && setDataInicio(date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>Data de Fim (opcional)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !dataFim && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dataFim ? format(dataFim, "PPP", { locale: ptBR }) : "Sem data fim"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={dataFim}
                            onSelect={setDataFim}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div>
                    <Label>Prioridade</Label>
                    <Input 
                      type="number"
                      value={prioridade}
                      onChange={(e) => setPrioridade(Number(e.target.value))}
                      placeholder="0"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Valores maiores aparecem primeiro
                    </p>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>

          {/* Preview */}
          <div className="w-[400px] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <span className="text-sm font-medium">Preview</span>
              <div className="flex gap-1">
                <Button
                  variant={previewMode === 'desktop' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('desktop')}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={previewMode === 'mobile' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('mobile')}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className={cn(
                "mx-auto bg-background rounded-lg border p-4",
                previewMode === 'mobile' ? 'max-w-[320px]' : 'w-full'
              )}>
                {thumbnailUrl && (
                  <img 
                    src={thumbnailUrl} 
                    alt="Thumbnail"
                    className="w-full aspect-video object-cover rounded-lg mb-4"
                  />
                )}
                <h2 className="text-xl font-bold mb-2">{titulo || 'Título da novidade'}</h2>
                {descricao && (
                  <p className="text-muted-foreground mb-4">{descricao}</p>
                )}
                <VisualizadorNovidade conteudo={secoes} />
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={!titulo}>
            {novidadeParaEditar ? 'Atualizar' : 'Criar Novidade'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
