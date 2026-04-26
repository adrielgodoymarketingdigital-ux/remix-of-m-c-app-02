import { useState, useEffect } from "react";
import { FileText, RotateCcw, Save, Eye, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { TermoGarantiaConfig } from "@/types/configuracao-loja";

interface DialogConfiguracaoTermoGarantiaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

const TERMOS_PADRAO: TermoGarantiaConfig = {
  termo_90_dias:
    "Este serviço possui garantia de {{dias}} ({{dias_extenso}}) dias contados a partir da data de entrega do equipamento, conforme previsto no Código de Defesa do Consumidor (CDC - Lei 8.078/90). A garantia cobre defeitos relacionados ao serviço executado. Não estão cobertos: danos causados por mau uso, queda, contato com líquidos, modificações não autorizadas, ou desgaste natural. Para acionamento da garantia, é obrigatória a apresentação desta ordem de serviço.",
  termo_outros_dias:
    "Este serviço possui garantia de {{dias}} ({{dias_extenso}}) dias contados a partir da data de entrega do equipamento. A garantia cobre defeitos relacionados ao serviço executado. Não estão cobertos: danos causados por mau uso, queda, contato com líquidos, modificações não autorizadas, ou desgaste natural. Para acionamento da garantia, é obrigatória a apresentação desta ordem de serviço.",
  termo_sem_garantia:
    "Este serviço não possui garantia. O cliente declara estar ciente das condições do equipamento conforme checklist e avarias registradas neste documento.",
};

const VARIAVEIS_DISPONIVEIS = [
  { variavel: "{{dias}}", descricao: "Número de dias (ex: 90)" },
  { variavel: "{{dias_extenso}}", descricao: "Dias por extenso (ex: noventa)" },
  { variavel: "{{loja}}", descricao: "Nome da loja" },
  { variavel: "{{cliente}}", descricao: "Nome do cliente" },
  { variavel: "{{dispositivo}}", descricao: "Dispositivo (marca + modelo)" },
];

export function DialogConfiguracaoTermoGarantia({
  open,
  onOpenChange,
  onSave,
}: DialogConfiguracaoTermoGarantiaProps) {
  const { config, atualizarConfiguracao } = useConfiguracaoLoja();
  const [termos, setTermos] = useState<TermoGarantiaConfig>(TERMOS_PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [tabAtiva, setTabAtiva] = useState("90dias");

  useEffect(() => {
    if (config?.termo_garantia_config) {
      setTermos({
        termo_90_dias: config.termo_garantia_config.termo_90_dias || TERMOS_PADRAO.termo_90_dias,
        termo_outros_dias: config.termo_garantia_config.termo_outros_dias || TERMOS_PADRAO.termo_outros_dias,
        termo_sem_garantia: config.termo_garantia_config.termo_sem_garantia || TERMOS_PADRAO.termo_sem_garantia,
      });
    }
  }, [config]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const sucesso = await atualizarConfiguracao({
        termo_garantia_config: termos,
      });
      if (sucesso) {
        toast.success("Termos de garantia salvos com sucesso!");
        onSave?.();
        onOpenChange(false);
      } else {
        toast.error("Erro ao salvar termos de garantia");
      }
    } catch (error) {
      toast.error("Erro ao salvar termos de garantia");
    } finally {
      setSalvando(false);
    }
  };

  const handleRestaurarPadrao = (tipo: keyof TermoGarantiaConfig) => {
    setTermos((prev) => ({
      ...prev,
      [tipo]: TERMOS_PADRAO[tipo],
    }));
    toast.info("Texto restaurado para o padrão");
  };

  const gerarPreview = (texto: string) => {
    let previewTexto = texto;
    previewTexto = previewTexto.replace(/\{\{dias\}\}/g, "90");
    previewTexto = previewTexto.replace(/\{\{dias_extenso\}\}/g, "noventa");
    previewTexto = previewTexto.replace(/\{\{loja\}\}/g, config?.nome_loja || "Minha Loja");
    previewTexto = previewTexto.replace(/\{\{cliente\}\}/g, "João da Silva");
    previewTexto = previewTexto.replace(/\{\{dispositivo\}\}/g, "iPhone 14 Pro");
    setPreview(previewTexto);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Personalizar Termo de Garantia
          </DialogTitle>
          <DialogDescription>
            Personalize os textos de garantia que aparecem na impressão e no PDF da OS enviado via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Variáveis disponíveis:</strong>
            <div className="flex flex-wrap gap-2 mt-2">
              {VARIAVEIS_DISPONIVEIS.map((v) => (
                <code
                  key={v.variavel}
                  className="bg-muted px-2 py-1 rounded text-xs cursor-help"
                  title={v.descricao}
                >
                  {v.variavel}
                </code>
              ))}
            </div>
          </AlertDescription>
        </Alert>

        <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="90dias">90 Dias (CDC)</TabsTrigger>
            <TabsTrigger value="outros">Outros Períodos</TabsTrigger>
            <TabsTrigger value="sem">Sem Garantia</TabsTrigger>
          </TabsList>

          <TabsContent value="90dias" className="space-y-4">
            <div>
              <Label htmlFor="termo90" className="text-sm font-medium">
                Termo para garantia de 90 dias (inclui referência ao CDC)
              </Label>
              <Textarea
                id="termo90"
                value={termos.termo_90_dias || ""}
                onChange={(e) => setTermos({ ...termos, termo_90_dias: e.target.value })}
                rows={6}
                className="mt-2"
                placeholder="Digite o termo de garantia para 90 dias..."
              />
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestaurarPadrao("termo_90_dias")}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restaurar Padrão
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => gerarPreview(termos.termo_90_dias || "")}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="outros" className="space-y-4">
            <div>
              <Label htmlFor="termoOutros" className="text-sm font-medium">
                Termo para outros períodos de garantia (7, 15, 30, 60, 180, 365 dias)
              </Label>
              <Textarea
                id="termoOutros"
                value={termos.termo_outros_dias || ""}
                onChange={(e) => setTermos({ ...termos, termo_outros_dias: e.target.value })}
                rows={6}
                className="mt-2"
                placeholder="Digite o termo de garantia para outros períodos..."
              />
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestaurarPadrao("termo_outros_dias")}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restaurar Padrão
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => gerarPreview(termos.termo_outros_dias || "")}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sem" className="space-y-4">
            <div>
              <Label htmlFor="termoSem" className="text-sm font-medium">
                Termo para serviços sem garantia
              </Label>
              <Textarea
                id="termoSem"
                value={termos.termo_sem_garantia || ""}
                onChange={(e) => setTermos({ ...termos, termo_sem_garantia: e.target.value })}
                rows={6}
                className="mt-2"
                placeholder="Digite o termo para serviços sem garantia..."
              />
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestaurarPadrao("termo_sem_garantia")}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restaurar Padrão
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => gerarPreview(termos.termo_sem_garantia || "")}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {preview && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <Label className="text-sm font-medium mb-2 block">Preview:</Label>
            <p className="text-sm">{preview}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setPreview(null)}
            >
              Fechar Preview
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            <Save className="h-4 w-4 mr-2" />
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
