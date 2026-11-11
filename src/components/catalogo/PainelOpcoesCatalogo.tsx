// Painel "Opções" do Catálogo (campos a mostrar e o botão WhatsApp, que é o botão de compra).
// Extraído de ConfiguracaoTemplates.tsx SEM mudar o JSX: o celular renderiza o mesmo HTML.
// `esconderSemEfeito` (só o computador): esconde "Tamanho da fonte" e "Itens por página no PDF",
// que não são lidos em lugar nenhum (nem pelo catálogo online nem pelo PDF).
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { ConfiguracaoCatalogo } from "@/types/catalogo";
import type { PainelCatalogoProps } from "./PainelVisualCatalogo";

export function PainelOpcoesCatalogo({
  config,
  onConfigChange,
  esconderSemEfeito = false,
}: PainelCatalogoProps & { esconderSemEfeito?: boolean }) {
  const handleOpcoesChange = (campo: keyof ConfiguracaoCatalogo, valor: boolean | number | string) => {
    onConfigChange({
      ...config,
      [campo]: valor,
    });
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Configure quais informações exibir
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-between py-2">
          <div>
            <Label htmlFor="mostrarPrecos" className="cursor-pointer">Mostrar preços</Label>
            <p className="text-xs text-muted-foreground">Exibir valores dos dispositivos</p>
          </div>
          <Switch id="mostrarPrecos" checked={config.mostrarPrecos} onCheckedChange={(v) => handleOpcoesChange("mostrarPrecos", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label htmlFor="mostrarGarantia" className="cursor-pointer">Mostrar garantia</Label>
            <p className="text-xs text-muted-foreground">Exibir informações de garantia</p>
          </div>
          <Switch id="mostrarGarantia" checked={config.mostrarGarantia} onCheckedChange={(v) => handleOpcoesChange("mostrarGarantia", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label htmlFor="mostrarBateria" className="cursor-pointer">Mostrar saúde da bateria</Label>
            <p className="text-xs text-muted-foreground">Exibir porcentagem de bateria</p>
          </div>
          <Switch id="mostrarBateria" checked={config.mostrarBateria} onCheckedChange={(v) => handleOpcoesChange("mostrarBateria", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label htmlFor="mostrarQuantidade" className="cursor-pointer">Mostrar quantidade disponível</Label>
            <p className="text-xs text-muted-foreground">Exibir número de unidades</p>
          </div>
          <Switch id="mostrarQuantidade" checked={config.mostrarQuantidade} onCheckedChange={(v) => handleOpcoesChange("mostrarQuantidade", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label htmlFor="mostrarCondicao" className="cursor-pointer">Mostrar condição</Label>
            <p className="text-xs text-muted-foreground">Novo, semi-novo ou usado</p>
          </div>
          <Switch id="mostrarCondicao" checked={config.mostrarCondicao ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarCondicao", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label htmlFor="mostrarCapacidade" className="cursor-pointer">Mostrar capacidade</Label>
            <p className="text-xs text-muted-foreground">Armazenamento em GB</p>
          </div>
          <Switch id="mostrarCapacidade" checked={config.mostrarCapacidade ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarCapacidade", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label htmlFor="mostrarCor" className="cursor-pointer">Mostrar cor</Label>
            <p className="text-xs text-muted-foreground">Cor do dispositivo</p>
          </div>
          <Switch id="mostrarCor" checked={config.mostrarCor ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarCor", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label htmlFor="mostrarLogo" className="cursor-pointer">Mostrar logo da loja</Label>
            <p className="text-xs text-muted-foreground">Exibir logotipo no catálogo</p>
          </div>
          <Switch id="mostrarLogo" checked={config.mostrarLogo ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarLogo", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label htmlFor="mostrarContato" className="cursor-pointer">Mostrar informações de contato</Label>
            <p className="text-xs text-muted-foreground">Telefone, WhatsApp e email</p>
          </div>
          <Switch id="mostrarContato" checked={config.mostrarContato ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarContato", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label htmlFor="mostrarSubtitulo" className="cursor-pointer">Mostrar subtítulo</Label>
            <p className="text-xs text-muted-foreground">Subtítulo abaixo do título</p>
          </div>
          <Switch id="mostrarSubtitulo" checked={config.mostrarSubtitulo ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarSubtitulo", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label htmlFor="mostrarBotaoWhatsApp" className="cursor-pointer">Botão WhatsApp flutuante</Label>
            <p className="text-xs text-muted-foreground">Exibir botão de contato rápido</p>
          </div>
          <Switch id="mostrarBotaoWhatsApp" checked={config.mostrarBotaoWhatsApp ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarBotaoWhatsApp", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label htmlFor="mostrarMarca" className="cursor-pointer">Mostrar marca separada</Label>
            <p className="text-xs text-muted-foreground">Exibir marca acima do modelo</p>
          </div>
          <Switch id="mostrarMarca" checked={config.mostrarMarca ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarMarca", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label htmlFor="mostrarDesconto" className="cursor-pointer">Mostrar badge de desconto</Label>
            <p className="text-xs text-muted-foreground">Exibir percentual de desconto</p>
          </div>
          <Switch id="mostrarDesconto" checked={config.mostrarDesconto ?? true} onCheckedChange={(v) => handleOpcoesChange("mostrarDesconto", v)} />
        </div>

        {!esconderSemEfeito && (
        <div className="space-y-3 pt-4 border-t">
          <Label>Tamanho da fonte</Label>
          <Select 
            value={config.tamanhoFonte || 'medio'} 
            onValueChange={(v) => handleOpcoesChange('tamanhoFonte', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pequeno">Pequeno</SelectItem>
              <SelectItem value="medio">Médio</SelectItem>
              <SelectItem value="grande">Grande</SelectItem>
            </SelectContent>
          </Select>
        </div>
        )}

        <div className="space-y-3 pt-4 border-t">
          <Label>Texto do botão WhatsApp</Label>
          <Input
            value={config.textoBotaoWhatsApp || 'WhatsApp'}
            onChange={(e) => handleOpcoesChange('textoBotaoWhatsApp', e.target.value)}
            placeholder="WhatsApp"
          />
        </div>

        <div className="space-y-3 pt-4 border-t">
          <Label>Cor do botão WhatsApp</Label>
          <div className="flex gap-2">
            <input
              type="color"
              value={config.corBotaoWhatsApp || '#22c55e'}
              onChange={(e) => handleOpcoesChange('corBotaoWhatsApp', e.target.value)}
              className="w-10 h-10 rounded border cursor-pointer"
            />
            {config.corBotaoWhatsApp && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleOpcoesChange('corBotaoWhatsApp', '')}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {!esconderSemEfeito && (
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <Label>Itens por página no PDF</Label>
            <span className="text-sm font-medium">{config.itensPerPage}</span>
          </div>
          <Slider
            value={[config.itensPerPage]}
            onValueChange={([v]) => handleOpcoesChange("itensPerPage", v)}
            min={4}
            max={8}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            {config.itensPerPage <= 4 ? "Cartões maiores" : config.itensPerPage >= 8 ? "Cartões menores" : "Tamanho médio"}
          </p>
        </div>
        )}
      </div>
    </>
  );
}
