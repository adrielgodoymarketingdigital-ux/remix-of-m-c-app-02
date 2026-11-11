import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Palette, 
  Type, 
  Settings2, 
  Check, 
  Smartphone,
  Paintbrush
} from "lucide-react";
import { 
  ConfiguracaoCatalogo, 
  TEMPLATES_PADRAO, 
  TemplatesCatalogo 
} from "@/types/catalogo";
import { PainelVisualCatalogo } from "./PainelVisualCatalogo";
import { PainelTextosCatalogo } from "./PainelTextosCatalogo";
import { PainelOpcoesCatalogo } from "./PainelOpcoesCatalogo";

interface ConfiguracaoTemplatesProps {
  config: ConfiguracaoCatalogo;
  onConfigChange: (config: ConfiguracaoCatalogo) => void;
}

export function ConfiguracaoTemplates({ config, onConfigChange }: ConfiguracaoTemplatesProps) {
  const [templatePersonalizado, setTemplatePersonalizado] = useState<TemplatesCatalogo | null>(null);

  const templateAtual = TEMPLATES_PADRAO.find(t => t.id === config.templateId) || TEMPLATES_PADRAO[0];

  const handleTemplateSelect = (templateId: string) => {
    onConfigChange({
      ...config,
      templateId,
    });
    setTemplatePersonalizado(null);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="templates" className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="visual" className="flex items-center gap-1.5">
            <Paintbrush className="w-3.5 h-3.5" />
            Visual
          </TabsTrigger>
          <TabsTrigger value="textos" className="flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5" />
            Textos
          </TabsTrigger>
          <TabsTrigger value="opcoes" className="flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />
            Opções
          </TabsTrigger>
        </TabsList>

        {/* Templates */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Escolha um estilo visual para seu catálogo
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES_PADRAO.map((template) => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  config.templateId === template.id
                    ? "ring-2 ring-primary border-primary"
                    : "hover:border-primary/50"
                }`}
                onClick={() => handleTemplateSelect(template.id)}
              >
                <CardContent className="p-3">
                  {/* Preview de cores */}
                  <div className="flex gap-1 mb-2">
                    <div
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: template.cores.primaria }}
                    />
                    <div
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: template.cores.secundaria }}
                    />
                    <div
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: template.cores.destaque }}
                    />
                  </div>

                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-sm">{template.nome}</h4>
                      <p className="text-xs text-muted-foreground">
                        {template.descricao}
                      </p>
                    </div>
                    {config.templateId === template.id && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Preview do template selecionado */}
          <Card className="overflow-hidden">
            <div 
              className="h-24 flex items-center justify-center"
              style={{ backgroundColor: templateAtual.cores.primaria }}
            >
              <div 
                className="text-center"
                style={{ color: templateAtual.cores.fundo }}
              >
                <Smartphone className="w-8 h-8 mx-auto mb-1" />
                <span className="text-xs font-medium">Preview</span>
              </div>
            </div>
            <CardContent className="p-3" style={{ backgroundColor: templateAtual.cores.fundo }}>
              <p 
                className="text-sm font-semibold"
                style={{ color: templateAtual.cores.texto }}
              >
                {templateAtual.nome}
              </p>
              <p 
                className="text-xs"
                style={{ color: templateAtual.cores.secundaria }}
              >
                {templateAtual.descricao}
              </p>
              <Badge
                className="mt-2"
                style={{ 
                  backgroundColor: templateAtual.cores.destaque,
                  color: templateAtual.cores.fundo,
                }}
              >
                R$ 1.999,00
              </Badge>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visual - Nova aba */}
        <TabsContent value="visual" className="mt-4 space-y-6">
          <PainelVisualCatalogo config={config} onConfigChange={onConfigChange} />
        </TabsContent>

        {/* Textos */}
        <TabsContent value="textos" className="mt-4 space-y-4">
          <PainelTextosCatalogo config={config} onConfigChange={onConfigChange} />
        </TabsContent>

        {/* Opções */}
        <TabsContent value="opcoes" className="mt-4 space-y-4">
          <PainelOpcoesCatalogo config={config} onConfigChange={onConfigChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
