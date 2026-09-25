import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioTower, MessageCircle, Share, Copy, Eye } from "lucide-react";
import { toast } from "sonner";

interface DialogCompartilharClienteLinkProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: string;
  nomeCliente: string;
  telefoneCliente?: string | null;
}

// Mesmo padrão visual/UX do dialog de compartilhamento de OS individual
// (OrdemServico.tsx) — só adiciona a opção de compartilhamento nativo do
// dispositivo (Web Share API), que aquele não tem.
export function DialogCompartilharClienteLink({
  open,
  onOpenChange,
  link,
  nomeCliente,
  telefoneCliente,
}: DialogCompartilharClienteLinkProps) {
  const mensagem = `Olá ${nomeCliente}! Acompanhe todas as suas ordens de serviço em tempo real:\n${link}`;
  const suportaCompartilhamentoNativo = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleWhatsApp = () => {
    const celular = (telefoneCliente ?? "").replace(/\D/g, "");
    if (!celular) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    window.open(`https://wa.me/55${celular}?text=${encodeURIComponent(mensagem)}`, "_blank");
  };

  const handleCompartilharNativo = async () => {
    try {
      await navigator.share({
        title: `Acompanhamento — ${nomeCliente}`,
        text: `Olá ${nomeCliente}! Acompanhe todas as suas ordens de serviço em tempo real:`,
        url: link,
      });
    } catch (error) {
      // AbortError = usuário cancelou o compartilhamento nativo — não é erro
      if ((error as Error)?.name !== "AbortError") {
        toast.error("Não foi possível compartilhar");
      }
    }
  };

  const handleCopiar = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
    onOpenChange(false);
  };

  const handleVisualizar = () => {
    window.open(link, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RadioTower className="h-5 w-5 text-blue-500" />
            Compartilhar Acompanhamento
          </DialogTitle>
          <DialogDescription className="truncate max-w-full">
            {nomeCliente}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border overflow-hidden">
          <p className="text-xs text-muted-foreground flex-1 break-all min-w-0">{link}</p>
          <Button size="sm" variant="ghost" className="shrink-0 h-7 px-2" onClick={handleCopiar}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 mt-2">
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={handleWhatsApp}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Enviar pelo WhatsApp
          </Button>

          {suportaCompartilhamentoNativo && (
            <Button variant="outline" className="w-full" onClick={handleCompartilharNativo}>
              <Share className="h-4 w-4 mr-2" />
              Compartilhar
            </Button>
          )}

          <Button variant="outline" className="w-full" onClick={handleVisualizar}>
            <Eye className="h-4 w-4 mr-2" />
            Visualizar Página
          </Button>

          <Button variant="ghost" className="w-full" onClick={handleCopiar}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
