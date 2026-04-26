import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DialogPopupStatusContaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusNome: string;
  onConfirmar: (dataVencimento: Date | null, semPrazo: boolean) => void;
}

export function DialogPopupStatusConta({
  open,
  onOpenChange,
  statusNome,
  onConfirmar,
}: DialogPopupStatusContaProps) {
  const [semPrazo, setSemPrazo] = useState(false);
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(undefined);

  const handleConfirmar = () => {
    onConfirmar(semPrazo ? null : dataVencimento || null, semPrazo);
    // Reset
    setSemPrazo(false);
    setDataVencimento(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Lançamento Financeiro</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          O status <strong>"{statusNome}"</strong> gera uma conta a receber. Defina a data de vencimento:
        </p>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="sem-prazo"
              checked={semPrazo}
              onCheckedChange={(checked) => {
                setSemPrazo(checked === true);
                if (checked) setDataVencimento(undefined);
              }}
            />
            <Label htmlFor="sem-prazo" className="cursor-pointer text-sm">
              Sem data definida
            </Label>
          </div>

          {!semPrazo && (
            <div className="space-y-2">
              <Label className="text-sm">Data de Vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataVencimento && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataVencimento
                      ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataVencimento}
                    onSelect={setDataVencimento}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
