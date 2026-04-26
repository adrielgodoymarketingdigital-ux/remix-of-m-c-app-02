import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { 
  History, 
  ShieldX, 
  ShieldCheck, 
  Lock, 
  CreditCard,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  UserCog
} from "lucide-react";
import { toast } from "sonner";

interface HistoricoBloqueio {
  id: string;
  user_id: string;
  admin_id: string;
  acao: string;
  tipo_bloqueio: string | null;
  motivo: string | null;
  user_nome: string | null;
  user_email: string | null;
  admin_nome: string | null;
  admin_email: string | null;
  created_at: string;
}

export function HistoricoBloqueios() {
  const [historico, setHistorico] = useState<HistoricoBloqueio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 15;

  const carregarHistorico = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("historico_bloqueios")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("Erro ao carregar histórico:", error);
        toast.error("Erro ao carregar histórico de bloqueios");
        return;
      }

      setHistorico(data || []);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarHistorico();
  }, []);

  const totalPaginas = Math.ceil(historico.length / itensPorPagina);
  const historicoPaginado = historico.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  );

  const irParaPagina = (pagina: number) => {
    if (pagina >= 1 && pagina <= totalPaginas) {
      setPaginaAtual(pagina);
    }
  };

  const formatarData = (data: string) => {
    const dataUTC = parseISO(data);
    const dataBrasil = toZonedTime(dataUTC, "America/Sao_Paulo");
    return format(dataBrasil, "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Bloqueios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Bloqueios/Desbloqueios
        </CardTitle>
        <Button variant="outline" size="sm" onClick={carregarHistorico}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {historico.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum registro de bloqueio/desbloqueio encontrado.
          </div>
        ) : (
          <>
            <ScrollArea className="w-full">
              <div className="min-w-[800px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Usuário Afetado</TableHead>
                      <TableHead>Admin Responsável</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoPaginado.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatarData(item.created_at)}
                        </TableCell>
                        <TableCell>
                          {item.acao === "bloqueio" ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <ShieldX className="h-3 w-3" />
                              Bloqueio
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                              <ShieldCheck className="h-3 w-3" />
                              Desbloqueio
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.acao === "bloqueio" && item.tipo_bloqueio ? (
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              {item.tipo_bloqueio === "indeterminado" ? (
                                <>
                                  <Lock className="h-3 w-3" />
                                  Indeterminado
                                </>
                              ) : (
                                <>
                                  <CreditCard className="h-3 w-3" />
                                  Até Assinar
                                </>
                              )}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <User className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{item.user_nome || "Desconhecido"}</p>
                              <p className="text-xs text-muted-foreground">{item.user_email || "-"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <UserCog className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{item.admin_nome || "Admin"}</p>
                              <p className="text-xs text-muted-foreground">{item.admin_email || "-"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground max-w-[200px] truncate" title={item.motivo || ""}>
                            {item.motivo || "-"}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>

            {/* Paginação */}
            {totalPaginas > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-4">
                <p className="text-sm text-muted-foreground">
                  Exibindo {(paginaAtual - 1) * itensPorPagina + 1}-{Math.min(paginaAtual * itensPorPagina, historico.length)} de {historico.length} registros
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => irParaPagina(paginaAtual - 1)}
                    disabled={paginaAtual === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                      let pageNum: number;
                      if (totalPaginas <= 5) {
                        pageNum = i + 1;
                      } else if (paginaAtual <= 3) {
                        pageNum = i + 1;
                      } else if (paginaAtual >= totalPaginas - 2) {
                        pageNum = totalPaginas - 4 + i;
                      } else {
                        pageNum = paginaAtual - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={paginaAtual === pageNum ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => irParaPagina(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => irParaPagina(paginaAtual + 1)}
                    disabled={paginaAtual === totalPaginas}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}