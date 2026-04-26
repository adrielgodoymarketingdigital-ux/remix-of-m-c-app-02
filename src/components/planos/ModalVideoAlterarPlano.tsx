import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";

const DELAY_BOTAO_SEGUNDOS = 5;

interface ModalVideoAlterarPlanoProps {
  open: boolean;
  onClose: () => void;
  onProsseguir: () => void;
}

export function ModalVideoAlterarPlano({ open, onClose, onProsseguir }: ModalVideoAlterarPlanoProps) {
  const [botaoVisivel, setBotaoVisivel] = useState(false);

  useEffect(() => {
    if (!open) {
      setBotaoVisivel(false);
      return;
    }
    const timer = setTimeout(() => setBotaoVisivel(true), DELAY_BOTAO_SEGUNDOS * 1000);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[640px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-lg">Como alterar seu plano</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Assista o vídeo abaixo para saber como alterar ou cancelar seu plano na página de gerenciamento.
          </DialogDescription>
        </DialogHeader>

        <div className="w-full aspect-video bg-black">
          <video
            src="/videos/tutorial-alterar-plano.mp4"
            className="w-full h-full object-contain"
            autoPlay
            loop
            muted
            playsInline
          />
        </div>

        <div className="p-4 pt-3 flex flex-col items-center gap-2">
          {botaoVisivel ? (
            <Button onClick={onProsseguir} className="w-full h-11 text-base">
              <ExternalLink className="mr-2 h-4 w-4" />
              Entendi, alterar meu plano
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground animate-pulse">
              O botão aparecerá em alguns segundos...
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
