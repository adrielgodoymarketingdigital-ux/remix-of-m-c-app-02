import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Receipt, Printer, FileText, ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { toast } from "sonner";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { detectarContextoImpressaoMobile, printViaIframe, printViaPrintRoot, urlParaBase64 } from "@/lib/printMobile";
import {
  buscarContasReceberOS,
  calcularRecebimentoOS,
  type RecebimentoOS,
} from "@/lib/ordemServico/calcularRecebimentoOS";
import {
  gerarReciboOSPDF,
  montarBodyReciboOS,
  montarCssReciboOS,
  montarDadosReciboOS,
  montarDocumentoReciboOS,
  nomeArquivoReciboOS,
  type FormatoReciboOS,
} from "@/lib/ordemServico/reciboOS";

interface DialogEmitirReciboOSProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico | null;
}

const STATUS_SEM_RECIBO: Record<string, string> = {
  estornado: "Esta OS foi estornada — não é possível emitir recibo.",
  cancelada: "Esta OS foi cancelada — não é possível emitir recibo.",
};

const podeCompartilharArquivo = (file: File): boolean =>
  typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

// Mesmo padrão visual do popup de compartilhamento do acompanhamento
// (DialogCompartilharClienteLink) — aqui com 2 opções: WhatsApp e Imprimir.
export function DialogEmitirReciboOS({ open, onOpenChange, ordem }: DialogEmitirReciboOSProps) {
  const { config: configLoja } = useConfiguracaoLoja(ordem?.empresa_id);
  const [recebimento, setRecebimento] = useState<RecebimentoOS | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const [escolhendoFormato, setEscolhendoFormato] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !ordem) return;
    let cancelado = false;
    setRecebimento(null);
    setErro(false);
    setEscolhendoFormato(false);
    setCarregando(true);
    buscarContasReceberOS(ordem.id, ordem.numero_os)
      .then((contas) => {
        if (!cancelado) setRecebimento(calcularRecebimentoOS(ordem, contas));
      })
      .catch((e) => {
        console.error("Erro ao buscar contas da OS para recibo:", e);
        if (!cancelado) setErro(true);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => { cancelado = true; };
  }, [open, ordem]);

  // Logo pré-codificado ao abrir: o caminho iOS não pode ter nenhum await
  // entre o clique e o print() (ver DialogReimprimirReciboVenda).
  useEffect(() => {
    if (!open || !configLoja?.logo_url) {
      setLogoBase64(null);
      return;
    }
    let cancelado = false;
    urlParaBase64(configLoja.logo_url).then((b64) => {
      if (!cancelado) setLogoBase64(b64);
    });
    return () => { cancelado = true; };
  }, [open, configLoja?.logo_url]);

  if (!ordem) return null;

  const motivoStatus = ordem.status ? STATUS_SEM_RECIBO[ordem.status] : undefined;
  const semRecebimento = recebimento !== null && recebimento.recebido <= 0;
  const bloqueado = Boolean(motivoStatus) || semRecebimento || erro || !recebimento;

  const dadosRecibo = () =>
    montarDadosReciboOS(ordem, recebimento!, {
      nome_loja: configLoja?.nome_loja,
      cnpj: configLoja?.cnpj,
      telefone: configLoja?.telefone,
      endereco: configLoja?.endereco,
    });

  const compartilharPDF = async (formato: FormatoReciboOS, comMensagem: boolean) => {
    const dados = dadosRecibo();
    const pdfBlob = gerarReciboOSPDF(dados, formato, logoBase64);
    const nomeArquivo = nomeArquivoReciboOS(ordem.numero_os);
    const pdfFile = new File([pdfBlob], nomeArquivo, { type: "application/pdf" });
    const nomeCliente = ordem.cliente?.nome?.split(" ")[0];
    const mensagem = `Olá${nomeCliente ? `, ${nomeCliente}` : ""}! Segue o recibo da OS #${ordem.numero_os}.`;

    if (podeCompartilharArquivo(pdfFile)) {
      await navigator.share({
        files: [pdfFile],
        title: `Recibo OS #${ordem.numero_os}`,
        ...(comMensagem ? { text: mensagem } : {}),
      });
      return;
    }

    // Sem suporte a compartilhar arquivo (desktop, maioria): baixa o PDF e,
    // no caso do WhatsApp, abre a conversa pra o usuário anexar.
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);

    if (comMensagem) {
      const celular = (ordem.cliente?.telefone ?? "").replace(/\D/g, "");
      const numero = celular.startsWith("55") ? celular : `55${celular}`;
      const destino = celular ? `https://wa.me/${numero}` : "https://wa.me/";
      toast.info("PDF baixado — anexe o arquivo na conversa do WhatsApp.");
      window.open(`${destino}?text=${encodeURIComponent(mensagem)}`, "_blank");
    }
  };

  const handleWhatsApp = async () => {
    if (bloqueado) return;
    setCompartilhando(true);
    try {
      // WhatsApp sempre em A4: é o formato que abre legível no celular do cliente.
      await compartilharPDF("a4", true);
      onOpenChange(false);
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        console.error("Erro ao compartilhar recibo:", error);
        toast.error("Não foi possível gerar o recibo. Tente novamente.");
      }
    } finally {
      setCompartilhando(false);
    }
  };

  // Mesmos caminhos de impressão do recibo de venda (DialogReimprimirReciboVenda):
  // iOS standalone → PDF via share; iOS Safari → #print-root; Android/PWA →
  // iframe; desktop → window.open síncrono no tick do clique.
  const handleImprimir = (formato: FormatoReciboOS) => {
    if (bloqueado) return;
    const { isMobile, isStandalone, isIOS } = detectarContextoImpressaoMobile();

    if (isIOS && isStandalone) {
      compartilharPDF(formato, false).catch((error) => {
        if ((error as Error)?.name !== "AbortError") {
          console.error("Erro ao gerar PDF do recibo:", error);
          toast.error("Não foi possível gerar o PDF. Tente novamente.");
        }
      });
      return;
    }

    const usarMecanismoMobile = isMobile || isStandalone;
    const dados = dadosRecibo();

    if (usarMecanismoMobile && isIOS) {
      printViaPrintRoot(montarBodyReciboOS(dados, logoBase64 ?? configLoja?.logo_url ?? null), montarCssReciboOS(formato));
      return;
    }

    if (usarMecanismoMobile) {
      printViaIframe(montarDocumentoReciboOS(dados, formato, logoBase64 ?? configLoja?.logo_url ?? null), isIOS);
      return;
    }

    const janela = window.open("", "_blank");
    if (!janela) {
      toast.error("Permita pop-ups para imprimir o recibo.");
      return;
    }
    janela.document.write(montarDocumentoReciboOS(dados, formato, configLoja?.logo_url ?? null));
    janela.document.close();
  };

  const renderConteudo = () => {
    if (carregando) {
      return (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calculando valores recebidos...
        </div>
      );
    }

    const aviso = motivoStatus
      ?? (erro ? "Não foi possível carregar os pagamentos desta OS. Tente novamente." : null)
      ?? (semRecebimento ? "Nenhum valor recebido ainda" : null);

    if (aviso) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </div>
      );
    }

    if (!recebimento) return null;

    return (
      <div className="rounded-lg border bg-muted p-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor recebido</span>
          <span className="font-bold text-green-700 dark:text-green-500">{formatCurrency(recebimento.recebido)}</span>
        </div>
        {recebimento.aReceber > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              A receber ({recebimento.vencimentoSaldo ? formatDate(recebimento.vencimentoSaldo) : "sem prazo"})
            </span>
            <span className="font-medium text-orange-600">{formatCurrency(recebimento.aReceber)}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-green-600" />
            Emitir Recibo
          </DialogTitle>
          <DialogDescription className="truncate max-w-full">
            OS #{ordem.numero_os}{ordem.cliente?.nome ? ` — ${ordem.cliente.nome}` : ""}
          </DialogDescription>
        </DialogHeader>

        {renderConteudo()}

        {!escolhendoFormato ? (
          <div className="grid grid-cols-1 gap-3 mt-2">
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={handleWhatsApp}
              disabled={bloqueado || compartilhando}
            >
              {compartilhando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FaWhatsapp className="h-4 w-4 mr-2" />}
              Enviar pelo WhatsApp
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setEscolhendoFormato(true)}
              disabled={bloqueado}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            <p className="text-xs font-medium text-muted-foreground">Formato do papel</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-auto flex-col gap-1 py-3" onClick={() => handleImprimir("80mm")}>
                <Receipt className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">80mm</span>
                <span className="text-[10px] text-muted-foreground">Térmica</span>
              </Button>
              <Button variant="outline" className="h-auto flex-col gap-1 py-3" onClick={() => handleImprimir("a4")}>
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">A4</span>
                <span className="text-[10px] text-muted-foreground">Folha comum</span>
              </Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => setEscolhendoFormato(false)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
