import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Download, CheckCircle2, FileText, Shield, Files, Contact, Paperclip, Info, X, Share2, Link2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { ConfiguracaoLoja, MensagensWhatsAppOS } from "@/types/configuracao-loja";
import { gerarOrdemServicoPDF, TipoPDFOS } from "@/lib/gerarOrdemServicoPDF";
import { toast } from "sonner";
import { aplicarMascaraTelefone } from "@/lib/mascaras";
import { useOSStatusConfigContext as useOSStatusConfig } from "@/contexts/OSStatusConfigContext";
import { useOSTracking } from "@/hooks/useOSTracking";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { cn } from "@/lib/utils";

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

const podeCompartilharArquivo = (file: File): boolean => {
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
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
  const [compartilhando, setCompartilhando] = useState(false);
  const [enviandoLink, setEnviandoLink] = useState(false);
  const mobile = isMobile();
  const { statusList } = useOSStatusConfig();
  const { gerarLink } = useOSTracking();
  const { lojaUserId, podeCompartilharLink } = useFuncionarioPermissoes();

  // Detecta suporte a compartilhamento de arquivos (Web Share API nível 2)
  const suportaCompartilharArquivo = podeCompartilharArquivo(
    new File(["teste"], "teste.pdf", { type: "application/pdf" })
  );

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
      toast.success("PDF baixado! Agora é só anexar na conversa do WhatsApp.");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setGerando(false);
    }
  };

  const handleCompartilharDireto = async () => {
    if (!ordem) return;

    setCompartilhando(true);
    let precisaFallback = false;

    try {
      const pdfBlob = await gerarOrdemServicoPDF(ordem, loja, tipoPDF);
      const pdfFile = new File([pdfBlob], nomePDF(), { type: "application/pdf" });

      if (!podeCompartilharArquivo(pdfFile)) {
        // Suporte mudou entre a checagem inicial e agora (raro) — cai no fluxo manual
        precisaFallback = true;
      } else {
        await navigator.share({
          files: [pdfFile],
          title: `OS #${ordem.numero_os}`,
          text: mensagem,
        });
        onOpenChange(false);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Usuário cancelou o compartilhamento — comportamento esperado, não é erro
      } else {
        console.error("Erro ao compartilhar PDF:", error);
        toast.error("Não foi possível compartilhar direto. Baixando o PDF...");
        precisaFallback = true;
      }
    } finally {
      setCompartilhando(false);
    }

    if (precisaFallback) {
      await handleBaixarPDF();
    }
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

  // Monta a mensagem com o link público de acompanhamento e abre o WhatsApp —
  // o cliente decide, pelo link, se quer ver os detalhes ou baixar o PDF.
  const handleEnviarLinkAcompanhamento = async () => {
    if (!ordem) return;

    const telefoneNumeros = telefone.replace(/\D/g, "");

    if (!telefoneNumeros || telefoneNumeros.length < 10) {
      toast.error("Informe um número de telefone válido");
      return;
    }

    if (!podeCompartilharLink) {
      toast.error("Você não tem permissão para compartilhar o link de acompanhamento");
      return;
    }

    // Abrir a janela PRIMEIRO, de forma síncrona, para não perder o "user
    // gesture" do clique — se abrirmos depois do await gerarLink(), o
    // navegador (Safari em especial) bloqueia o popup silenciosamente,
    // sem lançar erro nenhum (mesmo padrão já usado em handleEnviarDesktop).
    const janelaWhatsApp = window.open("", "_blank");

    if (!janelaWhatsApp) {
      toast.error("Não foi possível abrir o WhatsApp. Permita popups para este site.");
      return;
    }

    setEnviandoLink(true);
    try {
      // gerarLink já mostra toast.error em todos os cenários de falha
      // (limite de plano, sessão expirada, erro de geração)
      const link = await gerarLink(ordem.id, lojaUserId ?? undefined);
      if (!link) {
        janelaWhatsApp.close();
        return;
      }

      const numeroFormatado = telefoneNumeros.startsWith("55")
        ? telefoneNumeros
        : `55${telefoneNumeros}`;

      const mensagemComLink = `${mensagem}\n\nAcompanhe sua OS em tempo real:\n${link}`;
      const mensagemCodificada = encodeURIComponent(mensagemComLink);
      const urlWhatsApp = `https://wa.me/${numeroFormatado}?text=${mensagemCodificada}`;

      janelaWhatsApp.location.href = urlWhatsApp;
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao enviar link de acompanhamento:", error);
      toast.error("Não foi possível gerar o link. Tente novamente.");
      janelaWhatsApp.close();
    } finally {
      setEnviandoLink(false);
    }
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
      <DialogContent
        className="!inset-auto !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-[calc(100vw-1rem)] !h-[92dvh] !max-w-lg !rounded-2xl sm:!w-[calc(100vw-2rem)] sm:!h-auto sm:!max-h-[90dvh] sm:!max-w-lg sm:!rounded-2xl p-0 gap-0 overflow-hidden flex flex-col bg-background [&>.absolute.right-4.top-4]:hidden"
      >
        <DialogTitle className="sr-only">Enviar OS via WhatsApp</DialogTitle>

        {/* Alça de arrastar */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="h-1.5 w-10 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 px-4 sm:px-5 pt-1 pb-4 shrink-0">
          <div className="h-11 w-11 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
            <FaWhatsapp className="h-5 w-5 text-[#25D366]" />
          </div>
          <div className="min-w-0 flex-1 pr-8">
            <h2 className="text-base font-bold leading-tight">Enviar OS via WhatsApp</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mande só a mensagem ou anexe o PDF da OS <span className="font-semibold text-foreground">#{ordem.numero_os}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 sm:right-4 sm:top-4 h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </button>
        </div>

        <div className="space-y-4 px-4 sm:px-5 pb-4 overflow-y-auto flex-1 min-h-0">
          {/* Seletor de tipo de PDF — só relevante se for enviar o PDF junto */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Anexar PDF? (opcional)</p>
            <div className="grid grid-cols-1 gap-2">
              {opcoesPDF.map((opcao) => {
                const selecionado = tipoPDF === opcao.valor;
                return (
                  <button
                    key={opcao.valor}
                    type="button"
                    onClick={() => { setTipoPDF(opcao.valor); setPdfBaixado(false); }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      selecionado
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                      opcao.valor === "termo_garantia" ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary"
                    )}>
                      {opcao.icone}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={cn("block text-sm font-medium", selecionado && "text-primary")}>{opcao.label}</span>
                      <span className="block text-xs text-muted-foreground">{opcao.descricao}</span>
                    </span>
                    {selecionado ? (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0 fill-primary/15" />
                    ) : (
                      <span className="h-5 w-5 rounded-full border-2 border-muted-foreground/25 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Número do WhatsApp</p>
            <div className="relative">
              <FaWhatsapp className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#25D366] pointer-events-none" />
              <Input
                id="telefone"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={handleTelefoneChange}
                maxLength={15}
                className="pl-9 pr-10"
              />
              <Contact className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
            </div>
            {ordem.cliente?.nome && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Contact className="h-3.5 w-3.5" />
                Cliente: <span className="font-medium text-foreground">{ordem.cliente.nome}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Mensagem</p>
            <div className="relative">
              <Textarea
                id="mensagem"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={6}
                maxLength={500}
                className="resize-none pb-6"
              />
              <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/60 font-mono">
                {mensagem.length}/500
              </span>
            </div>
          </div>

          {mobile && (
            <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Info className="h-3 w-3" />
                </span>
                Como enviar no celular:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li><strong className="text-foreground">Só chamar no WhatsApp:</strong> abre a conversa direto com a mensagem, sem PDF.</li>
                {suportaCompartilharArquivo ? (
                  <li><strong className="text-foreground">Compartilhar direto:</strong> abre o menu nativo de compartilhamento com o PDF já anexado — escolha o WhatsApp na lista.</li>
                ) : (
                  <li><strong className="text-foreground">Baixar PDF:</strong> baixe o arquivo e anexe manualmente na conversa do WhatsApp.</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-border/40 bg-muted/10 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-2">
          {mobile && suportaCompartilharArquivo && (
            <Button
              onClick={handleCompartilharDireto}
              disabled={compartilhando}
              className="w-full gap-2"
            >
              {compartilhando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparando...
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  Compartilhar direto (com PDF)
                </>
              )}
            </Button>
          )}

          {mobile ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleEnviarSoMensagem}
                disabled={gerando || compartilhando}
                className="gap-2"
              >
                <FaWhatsapp className="h-4 w-4 text-[#25D366]" />
                Só chamar no WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={handleBaixarPDF}
                disabled={gerando || compartilhando}
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
                    Baixar PDF
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleEnviarSoMensagem}
                disabled={gerando}
                className="gap-2"
              >
                <FaWhatsapp className="h-4 w-4 text-[#25D366]" />
                Só chamar no WhatsApp
              </Button>
              <Button onClick={handleEnviarDesktop} disabled={gerando} className="gap-2">
                {gerando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparando...
                  </>
                ) : (
                  <>
                    <Paperclip className="h-4 w-4" />
                    Enviar com PDF
                  </>
                )}
              </Button>
            </div>
          )}

          {podeCompartilharLink && (
            <Button
              variant="outline"
              onClick={handleEnviarLinkAcompanhamento}
              disabled={enviandoLink}
              className="w-full gap-2"
            >
              {enviandoLink ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando link...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  Enviar link de acompanhamento
                </>
              )}
            </Button>
          )}

          {mobile && !suportaCompartilharArquivo && (
            <p className="text-[11px] text-muted-foreground text-center px-2">
              Para enviar o PDF manualmente: baixe o arquivo e anexe na conversa do WhatsApp.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
