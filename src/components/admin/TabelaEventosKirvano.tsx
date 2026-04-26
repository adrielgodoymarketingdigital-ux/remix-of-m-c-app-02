import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EventoKirvano, useEventosKirvano } from "@/hooks/useEventosKirvano";
import { DialogDetalhesEvento } from "./DialogDetalhesEvento";
import { Skeleton } from "@/components/ui/skeleton";

interface TabelaEventosKirvanoProps {
  eventos: EventoKirvano[];
  isLoading: boolean;
}

export function TabelaEventosKirvano({ eventos, isLoading }: TabelaEventosKirvanoProps) {
  const [eventoSelecionado, setEventoSelecionado] = useState<EventoKirvano | null>(null);
  const { reprocessarEvento, isReprocessing } = useEventosKirvano();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (eventos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum evento registrado
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventos.map((evento) => (
              <TableRow key={evento.id}>
                <TableCell className="font-mono text-xs">
                  {format(new Date(evento.created_at), "dd/MM/yyyy HH:mm:ss", {
                    locale: ptBR,
                  })}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{evento.tipo}</Badge>
                </TableCell>
                <TableCell>{evento.email_usuario || "-"}</TableCell>
                <TableCell>{evento.plano_tipo || "-"}</TableCell>
                <TableCell>
                  {evento.processado ? (
                    <Badge variant="default" className="bg-green-500">
                      Processado
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pendente</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEventoSelecionado(evento)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => reprocessarEvento(evento.id)}
                    disabled={isReprocessing}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DialogDetalhesEvento
        evento={eventoSelecionado}
        open={!!eventoSelecionado}
        onOpenChange={(open) => !open && setEventoSelecionado(null)}
      />
    </>
  );
}
