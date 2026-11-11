// Painel "Textos" do Catálogo (capa, garantia, preço, contato e rodapé).
// Extraído de ConfiguracaoTemplates.tsx SEM mudar o JSX: o celular renderiza o mesmo HTML.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { TEXTOS_PADRAO } from "@/types/catalogo";
import type { PainelCatalogoProps } from "./PainelVisualCatalogo";

export function PainelTextosCatalogo({ config, onConfigChange }: PainelCatalogoProps) {
  const handleTextosChange = (campo: keyof typeof config.textos, valor: string) => {
    onConfigChange({
      ...config,
      textos: {
        ...config.textos,
        [campo]: valor,
      },
    });
  };

  const resetTextos = () => {
    onConfigChange({
      ...config,
      textos: TEXTOS_PADRAO,
    });
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Personalize os textos do catálogo
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetTextos}
          className="text-xs"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Restaurar
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tituloCapa">Título da Capa</Label>
          <Input
            id="tituloCapa"
            value={config.textos.tituloCapa}
            onChange={(e) => handleTextosChange("tituloCapa", e.target.value)}
            placeholder="Catálogo de Dispositivos"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subtituloCapa">Subtítulo da Capa</Label>
          <Input
            id="subtituloCapa"
            value={config.textos.subtituloCapa}
            onChange={(e) => handleTextosChange("subtituloCapa", e.target.value)}
            placeholder="Celulares, Tablets e Eletrônicos"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="textoGarantia">
            Texto de Garantia
            <span className="text-xs text-muted-foreground ml-2">
              Use {"{tempo}"} para o período
            </span>
          </Label>
          <Input
            id="textoGarantia"
            value={config.textos.textoGarantia}
            onChange={(e) => handleTextosChange("textoGarantia", e.target.value)}
            placeholder="Garantia de {tempo}"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="textoPreco">Texto Antes do Preço</Label>
          <Input
            id="textoPreco"
            value={config.textos.textoPreco}
            onChange={(e) => handleTextosChange("textoPreco", e.target.value)}
            placeholder="A partir de"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="textoContato">Texto de Contato</Label>
          <Textarea
            id="textoContato"
            value={config.textos.textoContato}
            onChange={(e) => handleTextosChange("textoContato", e.target.value)}
            placeholder="Entre em contato para mais informações"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rodape">
            Texto do Rodapé
            <span className="text-xs text-muted-foreground ml-2">
              Use {"{data}"} para a data atual
            </span>
          </Label>
          <Input
            id="rodape"
            value={config.textos.rodape}
            onChange={(e) => handleTextosChange("rodape", e.target.value)}
            placeholder="Atualizado em {data}"
          />
        </div>
      </div>
    </>
  );
}
