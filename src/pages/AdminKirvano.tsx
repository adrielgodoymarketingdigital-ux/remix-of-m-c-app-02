import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabelaEventosKirvano } from "@/components/admin/TabelaEventosKirvano";
import { useEventosKirvano } from "@/hooks/useEventosKirvano";
import { Activity, CheckCircle, Clock, AlertCircle, RefreshCw, Search, Filter } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

export default function AdminKirvano() {
  const { eventos, isLoading, estatisticas, recarregar } = useEventosKirvano();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [buscaEmail, setBuscaEmail] = useState("");

  const eventosFiltrados = eventos.filter(evento => {
    const matchStatus = filtroStatus === "todos" || (filtroStatus === "processado" && evento.processado) || (filtroStatus === "pendente" && !evento.processado);
    const matchTipo = filtroTipo === "todos" || evento.tipo === filtroTipo;
    const matchEmail = !buscaEmail || evento.email_usuario?.toLowerCase().includes(buscaEmail.toLowerCase());
    return matchStatus && matchTipo && matchEmail;
  });

  const tiposUnicos = Array.from(new Set(eventos.map(e => e.tipo)));

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Webhooks Kirvano</h2>
            <p className="text-sm text-muted-foreground">Monitore eventos de pagamento</p>
          </div>
          <Button onClick={recarregar} variant="outline" size="sm" className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />Atualizar
          </Button>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{estatisticas.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Processados</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{estatisticas.processados}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{estatisticas.pendentes}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Taxa Sucesso</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                {estatisticas.total > 0 ? Math.round((estatisticas.processados / estatisticas.total) * 100) : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Eventos por tipo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Eventos por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(estatisticas.porTipo).map(([tipo, count]) => (
                <Badge key={tipo} variant="secondary">{tipo}: {count}</Badge>
              ))}
              {Object.keys(estatisticas.porTipo).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum evento</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="email@exemplo.com" 
                    value={buscaEmail} 
                    onChange={(e) => setBuscaEmail(e.target.value)} 
                    className="pl-10" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="processado">Processados</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {tiposUnicos.map(tipo => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg">Histórico</CardTitle>
              <Badge variant="secondary">{eventosFiltrados.length} de {eventos.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <TabelaEventosKirvano eventos={eventosFiltrados} isLoading={isLoading} />
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
}
