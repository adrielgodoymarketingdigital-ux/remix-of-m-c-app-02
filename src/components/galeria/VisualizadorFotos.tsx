import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface VisualizadorFotosProps {
  fotos: string[];
  nome: string;
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

/**
 * Foto ampliada em tela cheia, com setas (botões e teclado), bolinhas e Esc.
 * Usado no catálogo (CardCatalogo) e no acompanhamento da OS (CardStatusOS).
 */
export function VisualizadorFotos({ fotos, nome, initialIndex, open, onClose }: VisualizadorFotosProps) {
  const [current, setCurrent] = useState(initialIndex);

  useEffect(() => {
    setCurrent(initialIndex);
  }, [initialIndex, open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setCurrent((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setCurrent((i) => Math.min(fotos.length - 1, i + 1));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, fotos.length, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-fit h-fit p-0 bg-black/95 border-0 flex items-center justify-center overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-50 text-white/80 hover:text-white bg-black/40 rounded-full p-1.5"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {fotos.length > 1 && current > 0 && (
          <button
            onClick={() => setCurrent((i) => i - 1)}
            className="absolute left-2 z-50 text-white/80 hover:text-white bg-black/40 rounded-full p-1.5"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {fotos.length > 1 && current < fotos.length - 1 && (
          <button
            onClick={() => setCurrent((i) => i + 1)}
            className="absolute right-2 z-50 text-white/80 hover:text-white bg-black/40 rounded-full p-1.5"
            aria-label="Próxima"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <img
          src={fotos[current]}
          alt={`${nome} - Foto ${current + 1}`}
          className="max-w-[90vw] max-h-[90vh] object-contain select-none"
        />

        {fotos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {fotos.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === current ? "bg-white" : "bg-white/40 hover:bg-white/60"
                }`}
                aria-label={`Foto ${i + 1}`}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
