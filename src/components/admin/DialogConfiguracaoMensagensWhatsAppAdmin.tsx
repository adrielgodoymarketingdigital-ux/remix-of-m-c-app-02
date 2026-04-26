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
import { RotateCcw, Save, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import {
  StatusUsuarioWhatsApp,
  MensagensWhatsAppAdmin,
  MENSAGENS_PADRAO_ADMIN,
  useAdminWhatsAppTemplates,
} from "@/hooks/useAdminWhatsAppTemplates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StatusConfig {
  key: StatusUsuarioWhatsApp;
  label: string;
  descricao: string;
  cor: string;
}

const STATUS_CONFIG: StatusConfig[] = [
  { key: "bloqueado", label: "Bloqueado", descricao: "Usuário bloqueado pelo admin", cor: "bg-red-500" },
  { key: "trial_expirado", label: "Trial Expirado", descricao: "Período de teste encerrado", cor: "bg-orange-500" },
  { key: "assinatura_inativa", label: "Assinatura Inativa", descricao: "Cancelado, atrasado ou não pago", cor: "bg-yellow-500" },
  { key: "pagante_ativo", label: "Pagante Ativo", descricao: "Assinante com pagamento em dia", cor: "bg-green-500" },
  { key: "trial_ativo", label: "Trial Ativo", descricao: "Em período de teste gratuito", cor: "bg-blue-500" },
  { key: "free", label: "Free", descricao: "Usuário no plano gratuito (inativo)", cor: "bg-slate-500" },
  { key: "free_ativo", label: "Free Ativo", descricao: "Usuário ativo no plano gratuito", cor: "bg-cyan-500" },
];

const VARIAVEIS_DISPONIVEIS = [
  { variavel: "{{nome}}", descricao: "Nome do usuário" },
];

export function DialogConfiguracaoMensagensWhatsAppAdmin({ open, onOpenChange }: Props) {
  const { mensagens: mensagensSalvas, salvarTemplates } = useAdminWhatsAppTemplates();
  const [mensagens, setMensagens] = useState<MensagensWhatsAppAdmin>(MENSAGENS_PADRAO_ADMIN);
  const [salvando, setSalvando] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusUsuarioWhatsApp>("bloqueado");

  useEffect(() => {
    if (open) {
      setMensagens({ ...MENSAGENS_PADRAO_ADMIN, ...mensagensSalvas });
    }
  }, [open, mensagensSalvas]);

  const handleMensagemChange = (status: StatusUsuarioWhatsApp, valor: string) => {
    setMensagens((prev) => ({ ...prev, [status]: valor }));
  };

  const handleRestaurarPadrao = (status: StatusUsuarioWhatsApp) => {
    setMensagens((prev) => ({ ...prev, [status]: MENSAGENS_PADRAO_ADMIN[status] }));
    toast.info(`Mensagem de "${STATUS_CONFIG.find((s) => s.key === status)?.label}" restaurada`);
  };

  const handleRestaurarTodos = () => {
    setMensagens(MENSAGENS_PADRAO_ADMIN);
    toast.info("Todas as mensagens restauradas para o padrão");
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await salvarTemplates(mensagens);
      toast.success("Mensagens do WhatsApp salvas com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar mensagens:", error);
      toast.error("Erro ao salvar mensagens. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const gerarPreview = (template: string): string => {
    return template.replace(/\{\{nome\}\}/g, "João da Silva");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Mensagens do WhatsApp por Status</DialogTitle>
          <DialogDescription>
            Personalize as mensagens enviadas aos usuários pelo WhatsApp de acordo com o status
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusUsuarioWhatsApp)} className="h-full flex flex-col">
            <TabsList className="w-full justify-start mb-4 h-auto flex-wrap gap-1 p-1">
              {STATUS_CONFIG.map((status) => (
                <TabsTrigger key={status.key} value={status.key} className="text-xs sm:text-sm whitespace-nowrap">
                  <span className={`w-2 h-2 rounded-full ${status.cor} mr-1.5`} />
                  {status.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 overflow-auto">
              {STATUS_CONFIG.map((status) => (
                <TabsContent key={status.key} value={status.key} className="mt-0 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge className={`${status.cor} text-white`}>{status.label}</Badge>
                      <p className="text-sm text-muted-foreground mt-1">{status.descricao}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRestaurarPadrao(status.key)} className="flex-shrink-0">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restaurar
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <Textarea
                      value={mensagens[status.key] || ""}
                      onChange={(e) => handleMensagemChange(status.key, e.target.value)}
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
                      {gerarPreview(mensagens[status.key] || "")}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>

        {/* Variáveis disponíveis */}
        <div className="border-t pt-4">
          <Label className="text-xs text-muted-foreground mb-2 block">Variáveis disponíveis:</Label>
          <div className="flex flex-wrap gap-1.5">
            {VARIAVEIS_DISPONIVEIS.map((v) => (
              <Badge key={v.variavel} variant="outline" className="text-xs cursor-help" title={v.descricao}>
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
}
