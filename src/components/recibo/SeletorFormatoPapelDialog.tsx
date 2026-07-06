import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

export type FormatoPapel = "a4" | "80mm" | "58mm";

const CHAVE_STORAGE = "ultimo_formato_papel_impressao";

export function getUltimoFormatoPapel(): FormatoPapel {
  const salvo = localStorage.getItem(CHAVE_STORAGE);
  if (salvo === "a4" || salvo === "80mm" || salvo === "58mm") return salvo;
  return "a4";
}

export function salvarUltimoFormatoPapel(formato: FormatoPapel) {
  localStorage.setItem(CHAVE_STORAGE, formato);
}

const OPCOES: { value: FormatoPapel; label: string; descricao: string; icon: typeof FileText }[] = [
  { value: "a4", label: "A4", descricao: "Folha padrão (impressora comum)", icon: FileText },
  { value: "80mm", label: "80mm", descricao: "Cupom térmico", icon: Receipt },
  { value: "58mm", label: "58mm", descricao: "Cupom térmico pequeno", icon: Receipt },
];

interface SeletorFormatoPapelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formato: FormatoPapel;
  onFormatoChange: (formato: FormatoPapel) => void;
  onConfirmar: () => void;
}

export function SeletorFormatoPapelDialog({
  open,
  onOpenChange,
  formato,
  onFormatoChange,
  onConfirmar,
}: SeletorFormatoPapelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Formato de impressão
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {OPCOES.map((opcao) => {
            const Icon = opcao.icon;
            const selecionado = formato === opcao.value;
            return (
              <button
                key={opcao.value}
                type="button"
                onClick={() => onFormatoChange(opcao.value)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  selecionado
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", selecionado ? "text-primary" : "text-muted-foreground")} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{opcao.label}</p>
                  <p className="text-xs text-muted-foreground">{opcao.descricao}</p>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirmar}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
