import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EventoKirvano } from "@/hooks/useEventosKirvano";
import { Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface DialogDetalhesEventoProps {
  evento: EventoKirvano | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DialogDetalhesEvento({
  evento,
  open,
  onOpenChange,
}: DialogDetalhesEventoProps) {
  const [copiado, setCopiado] = useState(false);

  if (!evento) return null;

  const copiarPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(evento.dados, null, 2));
    setCopiado(true);
    toast({
      title: "Payload copiado!",
      description: "O JSON foi copiado para a área de transferência.",
    });
    setTimeout(() => setCopiado(false), 2000);
  };

  const camposImportantes = {
    email: evento.dados?.customer?.email || evento.dados?.email || evento.dados?.payer?.email,
    payment_link_id: evento.dados?.payment_link_id || evento.dados?.link_id || evento.dados?.product_id,
    transaction_id: evento.dados?.id || evento.dados?.transaction_id,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Evento Kirvano</DialogTitle>
          <DialogDescription>
            ID: {evento.kirvano_event_id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Data/Hora</p>
              <p className="text-sm">
                {format(new Date(evento.created_at), "dd/MM/yyyy 'às' HH:mm:ss", {
                  locale: ptBR,
                })}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Tipo</p>
              <Badge variant="outline">{evento.tipo}</Badge>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-sm">{evento.email_usuario || "-"}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Plano</p>
              <p className="text-sm">{evento.plano_tipo || "-"}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              {evento.processado ? (
                <Badge variant="default" className="bg-green-500">
                  Processado
                </Badge>
              ) : (
                <Badge variant="secondary">Pendente</Badge>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Campos Extraídos</p>
            </div>
            <div className="grid gap-2 rounded-md border p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-mono">{camposImportantes.email || "Não encontrado"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Link ID:</span>
                <span className="font-mono">{camposImportantes.payment_link_id || "Não encontrado"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction ID:</span>
                <span className="font-mono">{camposImportantes.transaction_id || "Não encontrado"}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Payload Completo (JSON)</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={copiarPayload}
              >
                {copiado ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
            <ScrollArea className="h-[300px] rounded-md border p-4">
              <pre className="text-xs">
                {JSON.stringify(evento.dados, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
