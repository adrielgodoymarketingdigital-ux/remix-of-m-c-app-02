import { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Undo2 } from "lucide-react";
import { LiberacaoTemporaria } from "@/hooks/useLiberacoesTemporarias";

interface Props {
  liberacoes: LiberacaoTemporaria[];
  isLoading: boolean;
  modoHistorico?: boolean;
  onRevogar?: (id: string) => Promise<boolean>;
}

const formatarPlano = (p?: string | null) =>
  p ? p.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "—";

function restante(expiraEm: string): { texto: string; vencido: boolean } {
  const ms = new Date(expiraEm).getTime() - Date.now();
  if (ms <= 0) return { texto: "expirando…", vencido: true };
  const min = Math.floor(ms / 60000);
  if (min < 60) return { texto: `em ${min} min`, vencido: false };
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return { texto: `em ${h}h${m > 0 ? ` ${m}min` : ""}`, vencido: false };
  const d = Math.floor(h / 24);
  return { texto: `em ${d}d ${h % 24}h`, vencido: false };
}

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  revertida: { label: "Revertida", className: "bg-slate-500" },
  revogada_manual: { label: "Revogada", className: "bg-amber-500" },
  conflito_sem_reverter: { label: "Conflito", className: "bg-red-500" },
};

export function TabelaLiberacoesAtivas({ liberacoes, isLoading, modoHistorico, onRevogar }: Props) {
  const [, setTick] = useState(0);
  const [revogandoId, setRevogandoId] = useState<string | null>(null);

  useEffect(() => {
    if (modoHistorico) return;
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [modoHistorico]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (liberacoes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {modoHistorico ? "Nenhuma liberação no histórico." : "Nenhuma liberação ativa no momento."}
      </p>
    );
  }

  const handleRevogar = async (id: string) => {
    if (!onRevogar) return;
    setRevogandoId(id);
    await onRevogar(id);
    setRevogandoId(null);
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Plano liberado</TableHead>
            <TableHead>Concedido em</TableHead>
            <TableHead>{modoHistorico ? "Revertido em" : "Expira"}</TableHead>
            <TableHead>Motivo</TableHead>
            {modoHistorico ? <TableHead>Estado</TableHead> : <TableHead className="text-right">Ação</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {liberacoes.map((lib) => {
            const r = restante(lib.expira_em);
            return (
              <TableRow key={lib.id}>
                <TableCell className="font-medium">{lib.email || lib.user_id}</TableCell>
                <TableCell>
                  <Badge variant="outline">{formatarPlano(lib.plano_concedido)}</Badge>
                  {lib.era_pagante_real && (
                    <span className="ml-1 text-[10px] text-amber-600">pagante</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(lib.concedido_em), "dd/MM/yy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell className="text-xs">
                  {modoHistorico ? (
                    lib.revertido_em ? (
                      format(new Date(lib.revertido_em), "dd/MM/yy HH:mm", { locale: ptBR })
                    ) : (
                      "—"
                    )
                  ) : (
                    <span className={r.vencido ? "text-red-600 font-medium" : "text-foreground"}>
                      {r.texto}
                      <span className="block text-[10px] text-muted-foreground">
                        {format(new Date(lib.expira_em), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                  {lib.motivo || "—"}
                </TableCell>
                {modoHistorico ? (
                  <TableCell>
                    <Badge className={ESTADO_BADGE[lib.estado]?.className}>
                      {ESTADO_BADGE[lib.estado]?.label || lib.estado}
                    </Badge>
                  </TableCell>
                ) : (
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={revogandoId === lib.id}
                        >
                          <Undo2 className="h-3.5 w-3.5 mr-1" />
                          Revogar agora
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revogar liberação?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O acesso de <strong>{lib.email || lib.user_id}</strong> volta imediatamente
                            ao estado anterior (ou para Free, se não havia plano ativo).
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRevogar(lib.id)}>
                            Revogar agora
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
