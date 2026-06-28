import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Download, CheckCircle2, FileText, Shield, Files } from "lucide-react";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { ConfiguracaoLoja, MensagensWhatsAppOS } from "@/types/configuracao-loja";
import { gerarOrdemServicoPDF, TipoPDFOS } from "@/lib/gerarOrdemServicoPDF";
import { toast } from "sonner";
import { aplicarMascaraTelefone } from "@/lib/mascaras";
import { useOSStatusConfigContext as useOSStatusConfig } from "@/contexts/OSStatusConfigContext";

interface DialogEnviarWhatsAppProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico | null;
  loja?: ConfiguracaoLoja;
}

const MENSAGEM_FALLBACK = `Olá{{cliente}}! 👋

Segue em anexo a Ordem de Serviço *#{{numero_os}}* referente ao seu *{{dispositivo}}*.

Qualquer dúvida, estamos à disposição!

*{{loja}}* 📱`;

const gerarMensagemPadrao = (ordem: OrdemServico, loja?: ConfiguracaoLoja, nomeStatus?: string): string => {
  const nomeLoja = loja?.nome_loja || "Nossa Loja";
  const dispositivo = `${ordem.dispositivo_marca} ${ordem.dispositivo_modelo}`;
  const nomeCliente = ordem.cliente?.nome?.split(" ")[0] || "";
  const status = ordem.status || "pendente";

  // Buscar template personalizado baseado no status
  const templates = loja?.mensagens_whatsapp_os as MensagensWhatsAppOS | undefined;
  let template = templates?.[status as keyof MensagensWhatsAppOS];
  
  // Se não tiver template personalizado, usar fallback
  if (!template) {
    template = MENSAGEM_FALLBACK;
  }
  
  // Substituir variáveis
  return template
    .replace(/{{cliente}}/g, nomeCliente ? `, ${nomeCliente}` : "")
    .replace(/{{numero_os}}/g, ordem.numero_os)
    .replace(/{{dispositivo}}/g, dispositivo)
    .replace(/{{loja}}/g, nomeLoja)
    .replace(/{{total}}/g, ordem.total ? `R$ ${ordem.total.toFixed(2).replace('.', ',')}` : "")
    .replace(/{{status}}/g, nomeStatus ?? status);
};

const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const DialogEnviarWhatsApp = ({
  open,
  onOpenChange,
  ordem,
  loja,
}: DialogEnviarWhatsAppProps) => {
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [gerando, setGerando] = useState(false);
  const [pdfBaixado, setPdfBaixado] = useState(false);
  const [tipoPDF, setTipoPDF] = useState<TipoPDFOS>('completo');
  const mobile = isMobile();
  const { statusList } = useOSStatusConfig();

  const opcoesPDF: { valor: TipoPDFOS; label: string; descricao: string; icone: React.ReactNode }[] = [
    {
      valor: 'primeira_parte',
      label: 'Primeira parte',
      descricao: 'Dados, checklist e serviços (sem o termo)',
      icone: <FileText className="h-4 w-4" />,
    },
    {
      valor: 'termo_garantia',
      label: 'Termo de Garantia',
      descricao: 'Apenas o termo de garantia do serviço',
      icone: <Shield className="h-4 w-4" />,
    },
    {
      valor: 'completo',
      label: 'OS Completa',
      descricao: 'Documento completo com tudo',
      icone: <Files className="h-4 w-4" />,
    },
  ];

  // Preencher telefone e mensagem quando abrir
  useEffect(() => {
    if (open && ordem) {
      if (ordem.cliente?.telefone) {
        setTelefone(aplicarMascaraTelefone(ordem.cliente.telefone));
      } else {
        setTelefone("");
      }
      const nomeStatus = statusList.find(s => s.slug === ordem.status)?.nome;
      setMensagem(gerarMensagemPadrao(ordem, loja, nomeStatus));
      setPdfBaixado(false);
      setTipoPDF('completo');
    }
  }, [open, ordem, loja, statusList]);

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(aplicarMascaraTelefone(e.target.value));
  };

  const nomePDF = () => {
    if (tipoPDF === 'primeira_parte') return `OS-${ordem?.numero_os}-parte1.pdf`;
    if (tipoPDF === 'termo_garantia') return `OS-${ordem?.numero_os}-termo-garantia.pdf`;
    return `OS-${ordem?.numero_os}.pdf`;
  };

  const handleBaixarPDF = async () => {
    if (!ordem) return;

    setGerando(true);

    try {
      const pdfBlob = await gerarOrdemServicoPDF(ordem, loja, tipoPDF);
      const urlPDF = URL.createObjectURL(pdfBlob);

      // Tentar download
      const linkPDF = document.createElement("a");
      linkPDF.href = urlPDF;
      linkPDF.download = nomePDF();
      linkPDF.style.display = "none";
      document.body.appendChild(linkPDF);
      linkPDF.click();
      
      setTimeout(() => {
        document.body.removeChild(linkPDF);
        URL.revokeObjectURL(urlPDF);
      }, 200);

      setPdfBaixado(true);
      toast.success("PDF baixado! Agora clique em 'Abrir WhatsApp' e anexe o PDF.");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setGerando(false);
    }
  };

  const handleAbrirWhatsApp = () => {
    const telefoneNumeros = telefone.replace(/\D/g, "");

    if (!telefoneNumeros || telefoneNumeros.length < 10) {
      toast.error("Informe um número de telefone válido");
      return;
    }

    const numeroFormatado = telefoneNumeros.startsWith("55")
      ? telefoneNumeros
      : `55${telefoneNumeros}`;

    const mensagemCodificada = encodeURIComponent(mensagem);
    const urlWhatsApp = `https://wa.me/${numeroFormatado}?text=${mensagemCodificada}`;

    window.open(urlWhatsApp, "_blank");

    toast.success("WhatsApp aberto! Anexe o PDF baixado na conversa.", {
      duration: 6000,
    });

    onOpenChange(false);
  };

  // Apenas abre o WhatsApp com a mensagem, sem gerar/baixar PDF
  const handleEnviarSoMensagem = () => {
    const telefoneNumeros = telefone.replace(/\D/g, "");

    if (!telefoneNumeros || telefoneNumeros.length < 10) {
      toast.error("Informe um número de telefone válido");
      return;
    }

    const numeroFormatado = telefoneNumeros.startsWith("55")
      ? telefoneNumeros
      : `55${telefoneNumeros}`;

    const mensagemCodificada = encodeURIComponent(mensagem);
    const urlWhatsApp = `https://wa.me/${numeroFormatado}?text=${mensagemCodificada}`;

    window.open(urlWhatsApp, "_blank");

    onOpenChange(false);
  };

  const handleEnviarDesktop = async () => {
    if (!ordem) return;

    const telefoneNumeros = telefone.replace(/\D/g, "");
    
    if (!telefoneNumeros || telefoneNumeros.length < 10) {
      toast.error("Informe um número de telefone válido");
      return;
    }

    const numeroFormatado = telefoneNumeros.startsWith("55") 
      ? telefoneNumeros 
      : `55${telefoneNumeros}`;

    // Abrir WhatsApp PRIMEIRO (síncrono para evitar bloqueio de popup)
    const mensagemCodificada = encodeURIComponent(mensagem);
    const urlWhatsApp = `https://wa.me/${numeroFormatado}?text=${mensagemCodificada}`;
    const janelaWhatsApp = window.open(urlWhatsApp, "_blank");

    if (!janelaWhatsApp) {
      toast.error("Não foi possível abrir o WhatsApp. Permita popups para este site.");
      return;
    }

    setGerando(true);

    try {
      const pdfBlob = await gerarOrdemServicoPDF(ordem, loja, tipoPDF);
      const urlPDF = URL.createObjectURL(pdfBlob);

      const linkPDF = document.createElement("a");
      linkPDF.href = urlPDF;
      linkPDF.download = nomePDF();
      linkPDF.style.display = "none";
      document.body.appendChild(linkPDF);
      linkPDF.click();
      
      setTimeout(() => {
        document.body.removeChild(linkPDF);
        URL.revokeObjectURL(urlPDF);
      }, 200);
      
      toast.success("PDF baixado! Anexe na conversa do WhatsApp.", {
        duration: 6000,
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setGerando(false);
    }
  };

  if (!ordem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Enviar OS via WhatsApp</DialogTitle>
          <DialogDescription>
            Mande só a mensagem ou anexe o PDF da OS #{ordem.numero_os}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Seletor de tipo de PDF — só relevante se for enviar o PDF junto */}
          <div className="space-y-2">
            <Label>Anexar PDF? (opcional)</Label>
            <div className="grid grid-cols-1 gap-2">
              {opcoesPDF.map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => { setTipoPDF(opcao.valor); setPdfBaixado(false); }}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    tipoPDF === opcao.valor
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <span className={tipoPDF === opcao.valor ? 'text-primary' : 'text-muted-foreground'}>
                    {opcao.icone}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{opcao.label}</span>
                    <span className="block text-xs text-muted-foreground">{opcao.descricao}</span>
                  </span>
                  {tipoPDF === opcao.valor && (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Número do WhatsApp</Label>
            <Input
              id="telefone"
              placeholder="(00) 00000-0000"
              value={telefone}
              onChange={handleTelefoneChange}
              maxLength={15}
            />
            {ordem.cliente?.nome && (
              <p className="text-sm text-muted-foreground">
                Cliente: {ordem.cliente.nome}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensagem">Mensagem</Label>
            <Textarea
              id="mensagem"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          {mobile && (
            <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground space-y-2">
              <p className="font-medium">📱 Como enviar no celular:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Só chamar no WhatsApp:</strong> abre a conversa direto com a mensagem, sem PDF.</li>
                <li><strong>Enviar com PDF:</strong> baixe o PDF, depois abra o WhatsApp e anexe o arquivo na conversa.</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-col">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>

          <Button
            variant="secondary"
            onClick={handleEnviarSoMensagem}
            disabled={gerando}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Só chamar no WhatsApp
          </Button>

          {mobile ? (
            <>
              <Button
                variant={pdfBaixado ? "outline" : "default"}
                onClick={handleBaixarPDF}
                disabled={gerando}
                className="gap-2"
              >
                {gerando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : pdfBaixado ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    PDF Baixado
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    1. Baixar PDF
                  </>
                )}
              </Button>
              <Button
                onClick={handleAbrirWhatsApp}
                disabled={!pdfBaixado}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                2. Abrir WhatsApp
              </Button>
            </>
          ) : (
            <Button onClick={handleEnviarDesktop} disabled={gerando} className="gap-2">
              {gerando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar com PDF
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
