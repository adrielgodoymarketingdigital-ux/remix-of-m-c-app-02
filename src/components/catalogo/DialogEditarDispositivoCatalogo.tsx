import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, X, ImageIcon, Loader2, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dispositivo } from "@/types/dispositivo";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";

interface DialogEditarDispositivoCatalogoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispositivo: Dispositivo;
  onSave: (dados: { fotos: string[]; preco: number | null; precoPromocional: number | null }) => Promise<void>;
}

export function DialogEditarDispositivoCatalogo({
  open,
  onOpenChange,
  dispositivo,
  onSave,
}: DialogEditarDispositivoCatalogoProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Inicializa com fotos existentes
  const getInitialFotos = () => {
    const fotos: string[] = [];
    if (dispositivo.foto_url) fotos.push(dispositivo.foto_url);
    if (dispositivo.fotos && Array.isArray(dispositivo.fotos)) {
      dispositivo.fotos.forEach((f) => {
        if (f && !fotos.includes(f)) fotos.push(f);
      });
    }
    return fotos;
  };
  
  const [fotos, setFotos] = useState<string[]>(getInitialFotos);
  const [preco, setPreco] = useState<string>(dispositivo.preco?.toString() || "");
  const [tipoDesconto, setTipoDesconto] = useState<"percentual" | "fixo">("percentual");
  const [valorDesconto, setValorDesconto] = useState<string>("");
  
  const maxFotos = 10;

  // Calcula o desconto inicial baseado no preco_promocional existente
  const calcularDescontoInicial = () => {
    if (dispositivo.preco && dispositivo.preco_promocional && dispositivo.preco_promocional < dispositivo.preco) {
      const percentual = Math.round(((dispositivo.preco - dispositivo.preco_promocional) / dispositivo.preco) * 100);
      return percentual.toString();
    }
    return "";
  };

  // Recalcula quando o dispositivo muda
  useEffect(() => {
    setFotos(getInitialFotos());
    setPreco(dispositivo.preco?.toString() || "");
    setValorDesconto(calcularDescontoInicial());
    setTipoDesconto("percentual");
  }, [dispositivo.id]);

  const precoNumerico = parseFloat(preco) || 0;
  const valorDescontoNumerico = parseFloat(valorDesconto) || 0;
  
  // Calcula o preço promocional baseado no tipo de desconto
  const calcularPrecoPromocional = () => {
    if (!valorDescontoNumerico || valorDescontoNumerico <= 0 || precoNumerico <= 0) {
      return null;
    }
    if (tipoDesconto === "percentual") {
      if (valorDescontoNumerico >= 100) return null;
      return precoNumerico - (precoNumerico * valorDescontoNumerico / 100);
    } else {
      if (valorDescontoNumerico >= precoNumerico) return null;
      return precoNumerico - valorDescontoNumerico;
    }
  };

  const precoPromocionalCalculado = calcularPrecoPromocional();
  
  // Calcula o percentual de desconto para exibição
  const descontoPercentualExibicao = precoPromocionalCalculado && precoNumerico > 0
    ? Math.round(((precoNumerico - precoPromocionalCalculado) / precoNumerico) * 100)
    : null;

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const files = Array.from(event.target.files);
      
      if (fotos.length + files.length > maxFotos) {
        toast({
          title: "Limite excedido",
          description: `Você pode adicionar no máximo ${maxFotos} fotos.`,
          variant: "destructive",
        });
        return;
      }

      const novasUrls: string[] = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('dispositivos-fotos')
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage
          .from('dispositivos-fotos')
          .getPublicUrl(filePath);

        novasUrls.push(data.publicUrl);
      }

      setFotos([...fotos, ...novasUrls]);

      toast({
        title: "Fotos enviadas",
        description: `${files.length} foto(s) enviada(s) com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: "Erro ao enviar fotos",
        description: "Ocorreu um erro ao enviar as fotos.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleRemove = async (urlParaRemover: string, index: number) => {
    try {
      const fileName = urlParaRemover.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('dispositivos-fotos')
          .remove([fileName]);
      }

      const novasFotos = fotos.filter((_, i) => i !== index);
      setFotos(novasFotos);

      toast({
        title: "Foto removida",
        description: "A foto foi removida com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      toast({
        title: "Erro ao remover foto",
        description: "Ocorreu um erro ao remover a foto.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        fotos,
        preco: precoNumerico || null,
        precoPromocional: precoPromocionalCalculado && precoPromocionalCalculado < precoNumerico 
          ? precoPromocionalCalculado 
          : null,
      });
      onOpenChange(false);
      toast({
        title: "Item atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const limparDesconto = () => {
    setValorDesconto("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Item</DialogTitle>
          <DialogDescription>
            {[dispositivo.marca, dispositivo.modelo].filter(Boolean).join(' ') || 'Produto/Peça'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="fotos" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fotos" className="text-xs sm:text-sm">
              <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
              Fotos
            </TabsTrigger>
            <TabsTrigger value="preco" className="text-xs sm:text-sm">
              <Tag className="w-3.5 h-3.5 mr-1.5" />
              Preço
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fotos" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label>Fotos do Item</Label>
              <span className="text-xs text-muted-foreground">
                {fotos.length}/{maxFotos} fotos
              </span>
            </div>
            
            {/* Grid de fotos existentes */}
            {fotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {fotos.map((url, index) => (
                  <div key={index} className="relative group aspect-square">
                    <img 
                      src={url} 
                      alt={`Foto ${index + 1}`} 
                      className="w-full h-full object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemove(url, index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    {index === 0 && (
                      <div className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[8px] px-1 py-0.5 rounded">
                        Principal
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Área de upload */}
            {fotos.length < maxFotos && (
              <div className="border-2 border-dashed rounded-lg p-3 text-center">
                <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground" />
                <div className="mt-2">
                  <Label htmlFor="fotos-edit-upload" className="cursor-pointer">
                    <div className="flex items-center justify-center gap-2 text-sm">
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          <span>Adicionar fotos</span>
                        </>
                      )}
                    </div>
                  </Label>
                  <Input
                    id="fotos-edit-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preco" className="space-y-4 mt-4">
            {/* Preço de venda */}
            <div className="space-y-2">
              <Label htmlFor="preco">Preço de Venda</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Tipo de desconto */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Aplicar Desconto (opcional)</Label>
                {valorDesconto && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={limparDesconto}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
              
              {/* Seletor de tipo */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={tipoDesconto === "percentual" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTipoDesconto("percentual")}
                >
                  % Porcentagem
                </Button>
                <Button
                  type="button"
                  variant={tipoDesconto === "fixo" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTipoDesconto("fixo")}
                >
                  R$ Valor Fixo
                </Button>
              </div>

              {/* Input do desconto */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  {tipoDesconto === "percentual" ? "%" : "R$"}
                </span>
                <Input
                  type="number"
                  step={tipoDesconto === "percentual" ? "1" : "0.01"}
                  min="0"
                  max={tipoDesconto === "percentual" ? "100" : undefined}
                  placeholder={tipoDesconto === "percentual" ? "Ex: 15" : "Ex: 100,00"}
                  value={valorDesconto}
                  onChange={(e) => setValorDesconto(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {tipoDesconto === "percentual" 
                  ? "Informe a porcentagem de desconto (ex: 15 para 15% off)"
                  : "Informe o valor em reais a descontar do preço"}
              </p>
            </div>

            {/* Preview do preço */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Preview no catálogo:</p>
              
              <div className="flex items-baseline gap-2 flex-wrap">
                {precoPromocionalCalculado && precoPromocionalCalculado < precoNumerico ? (
                  <>
                    <span className="text-xs text-muted-foreground line-through">
                      <ValorMonetario valor={precoNumerico} tipo="preco" />
                    </span>
                    <span className="text-lg font-bold text-green-600">
                      <ValorMonetario valor={precoPromocionalCalculado} tipo="preco" />
                    </span>
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                      -{descontoPercentualExibicao}%
                    </span>
                  </>
                ) : (
                  <span className="text-lg font-bold text-primary">
                    {precoNumerico > 0 ? <ValorMonetario valor={precoNumerico} tipo="preco" /> : "Consulte"}
                  </span>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
