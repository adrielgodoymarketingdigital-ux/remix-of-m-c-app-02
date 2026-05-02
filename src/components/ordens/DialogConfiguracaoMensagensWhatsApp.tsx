import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RotateCcw, Save, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useOSStatusConfig } from "@/hooks/useOSStatusConfig";

interface DialogConfiguracaoMensagensWhatsAppProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

const MENSAGEM_PADRAO_TEMPLATE = "Olá {{cliente}}! Atualização da sua OS #{{numero_os}} - {{dispositivo}}: status alterado para {{status}}. {{loja}}";

const MENSAGENS_PADRAO_FIXAS: Record<string, string> = {
  aguardando_aprovacao: "Olá {{cliente}}! Precisamos da sua aprovação para prosseguir com o serviço do {{dispositivo}}. OS #{{numero_os}}. {{loja}}",
  em_andamento: "Olá {{cliente}}! Sua OS #{{numero_os}} está em andamento. Estamos trabalhando no seu {{dispositivo}}. {{loja}}",
  finalizado: "Olá {{cliente}}! O serviço no seu {{dispositivo}} foi finalizado. OS #{{numero_os}}. {{loja}}",
  aguardando_retirada: "Olá {{cliente}}! Seu {{dispositivo}} está pronto! Pode retirar quando quiser. OS #{{numero_os}}. {{loja}}",
  entregue: "Olá {{cliente}}! Obrigado por escolher a {{loja}}! Seu {{dispositivo}} foi entregue. OS #{{numero_os}}. Conte sempre conosco!",
  cancelada: "Olá {{cliente}}! A OS #{{numero_os}} do seu {{dispositivo}} foi cancelada. Qualquer dúvida, estamos à disposição. {{loja}}",
  garantia: "Olá {{cliente}}! Sua OS #{{numero_os}} do {{dispositivo}} está em garantia. Estamos cuidando disso. {{loja}}",
  estornado: "Olá {{cliente}}! A OS #{{numero_os}} do seu {{dispositivo}} foi estornada. Qualquer dúvida, estamos à disposição. {{loja}}",
  pendente: "Olá {{cliente}}! Sua OS #{{numero_os}} foi registrada. Seu {{dispositivo}} está aguardando atendimento. {{loja}}",
};

const VARIAVEIS_DISPONIVEIS = [
  { variavel: "{{cliente}}", descricao: "Nome do cliente" },
  { variavel: "{{numero_os}}", descricao: "Número da OS" },
  { variavel: "{{dispositivo}}", descricao: "Marca e modelo do dispositivo" },
  { variavel: "{{loja}}", descricao: "Nome da sua loja" },
  { variavel: "{{total}}", descricao: "Valor total da OS" },
  { variavel: "{{status}}", descricao: "Status atual da OS" },
];

const VARIAVEIS_TRACKING = [
  { variavel: "{{cliente_nome}}", descricao: "Nome do cliente" },
  { variavel: "{{numero_os}}", descricao: "Número da OS" },
  { variavel: "{{status}}", descricao: "Status atual da OS" },
  { variavel: "{{link}}", descricao: "Link de acompanhamento" },
];

const MENSAGEM_TRACKING_PADRAO = "Olá {{cliente_nome}}! Acompanhe sua OS #{{numero_os}} em tempo real:\n{{link}}";

export const DialogConfiguracaoMensagensWhatsApp = ({
  open,
  onOpenChange,
  onSave,
}: DialogConfiguracaoMensagensWhatsAppProps) => {
  const { config, atualizarConfiguracao } = useConfiguracaoLoja();
  const { statusList } = useOSStatusConfig();
  const [mensagens, setMensagens] = useState<Record<string, string>>({});
  const [mensagemTracking, setMensagemTracking] = useState(MENSAGEM_TRACKING_PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("");

  // Set default active tab when statusList loads
  useEffect(() => {
    if (statusList.length > 0 && !activeTab) {
      setActiveTab(statusList[0].slug);
    }
  }, [statusList, activeTab]);

  // Load saved messages when dialog opens
  useEffect(() => {
    if (open && config) {
      const mensagensSalvas = (config.mensagens_whatsapp_os as Record<string, string>) || {};
      const fullMap: Record<string, string> = {};
      statusList.forEach(s => {
        fullMap[s.slug] = mensagensSalvas[s.slug] || MENSAGENS_PADRAO_FIXAS[s.slug] || MENSAGEM_PADRAO_TEMPLATE;
      });
      setMensagens(fullMap);
      const tracking = (config.mensagens_whatsapp as Record<string, string>)?.os_tracking;
      setMensagemTracking(tracking || MENSAGEM_TRACKING_PADRAO);
      if (statusList.length > 0) {
        setActiveTab(statusList[0].slug);
      }
    }
  }, [open, config, statusList]);

  const getMensagemPadrao = (slug: string) => {
    return MENSAGENS_PADRAO_FIXAS[slug] || MENSAGEM_PADRAO_TEMPLATE;
  };

  const handleMensagemChange = (slug: string, valor: string) => {
    setMensagens((prev) => ({ ...prev, [slug]: valor }));
  };

  const handleRestaurarPadrao = (slug: string) => {
    const statusConfig = statusList.find(s => s.slug === slug);
    setMensagens((prev) => ({ ...prev, [slug]: getMensagemPadrao(slug) }));
    toast.info(`Mensagem de "${statusConfig?.nome || slug}" restaurada para o padrão`);
  };

  const handleRestaurarTodos = () => {
    const fullMap: Record<string, string> = {};
    statusList.forEach(s => {
      fullMap[s.slug] = getMensagemPadrao(s.slug);
    });
    setMensagens(fullMap);
    toast.info("Todas as mensagens foram restauradas para o padrão");
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const mensagensWhatsappAtual = (config?.mensagens_whatsapp as Record<string, string>) || {};
      await atualizarConfiguracao({
        mensagens_whatsapp_os: mensagens,
        mensagens_whatsapp: { ...mensagensWhatsappAtual, os_tracking: mensagemTracking },
      });
      toast.success("Mensagens do WhatsApp salvas com sucesso!");
      onSave?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar mensagens:", error);
      toast.error("Erro ao salvar mensagens. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const gerarPreview = (template: string): string => {
    const activeStatus = statusList.find(s => s.slug === activeTab);
    return template
      .replace(/{{cliente}}/g, "João")
      .replace(/{{numero_os}}/g, "000125")
      .replace(/{{dispositivo}}/g, "iPhone 13 Pro")
      .replace(/{{loja}}/g, config?.nome_loja || "Minha Loja")
      .replace(/{{total}}/g, "R$ 150,00")
      .replace(/{{status}}/g, activeStatus?.nome || "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Mensagens do WhatsApp por Status</DialogTitle>
          <DialogDescription>
            Personalize as mensagens enviadas para cada status da Ordem de Serviço
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <ScrollArea className="w-full">
              <TabsList className="w-full justify-start mb-4 h-auto flex-wrap gap-1 p-1">
                {statusList.map((status) => (
                  <TabsTrigger
                    key={status.slug}
                    value={status.slug}
                    className="text-xs sm:text-sm whitespace-nowrap"
                  >
                    <span
                      className="w-2 h-2 rounded-full mr-1.5 shrink-0"
                      style={{ backgroundColor: status.cor }}
                    />
                    {status.nome}
                  </TabsTrigger>
                ))}
                <TabsTrigger value="os_tracking" className="text-xs sm:text-sm whitespace-nowrap">
                  🔗 Acompanhamento
                </TabsTrigger>
              </TabsList>
            </ScrollArea>

            <div className="flex-1 overflow-auto">
              {statusList.map((status) => (
                <TabsContent key={status.slug} value={status.slug} className="mt-0 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge style={{ backgroundColor: status.cor }} className="text-white">
                        {status.nome}
                      </Badge>
                      {!status.ativo && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">Oculto</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestaurarPadrao(status.slug)}
                      className="flex-shrink-0"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restaurar
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <Textarea
                      value={mensagens[status.slug] || ""}
                      onChange={(e) => handleMensagemChange(status.slug, e.target.value)}
                      rows={4}
                      className="resize-none"
                      placeholder="Digite a mensagem..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Info className="h-3.5 w-3.5" />
                      Preview
                    </Label>
                    <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">
                      {gerarPreview(mensagens[status.slug] || "")}
                    </div>
                  </div>
                </TabsContent>
              ))}

              <TabsContent value="os_tracking" className="mt-0 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge className="bg-blue-600 text-white">Acompanhamento de OS</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enviada quando o link de acompanhamento é compartilhado via WhatsApp
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMensagemTracking(MENSAGEM_TRACKING_PADRAO)}
                    className="flex-shrink-0"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Restaurar
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea
                    value={mensagemTracking}
                    onChange={(e) => setMensagemTracking(e.target.value)}
                    rows={4}
                    className="resize-none"
                    placeholder="Digite a mensagem..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" />
                    Variáveis disponíveis
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIAVEIS_TRACKING.map((v) => (
                      <Badge
                        key={v.variavel}
                        variant="outline"
                        className="text-xs cursor-help"
                        title={v.descricao}
                      >
                        {v.variavel}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" />
                    Preview
                  </Label>
                  <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">
                    {mensagemTracking
                      .replace(/{{cliente_nome}}/g, "João Silva")
                      .replace(/{{numero_os}}/g, "000125")
                      .replace(/{{status}}/g, "Em Andamento")
                      .replace(/{{link}}/g, `${window.location.origin}/acompanhar/abc123`)}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Variáveis disponíveis */}
        <div className="border-t pt-4">
          <Label className="text-xs text-muted-foreground mb-2 block">Variáveis disponíveis:</Label>
          <div className="flex flex-wrap gap-1.5">
            {VARIAVEIS_DISPONIVEIS.map((v) => (
              <Badge
                key={v.variavel}
                variant="outline"
                className="text-xs cursor-help"
                title={v.descricao}
              >
                {v.variavel}
              </Badge>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="ghost" onClick={handleRestaurarTodos} className="w-full sm:w-auto">
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar Todos
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando} className="flex-1 sm:flex-none">
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
