import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCRMWhatsApp, FiltroWhatsApp, CRM_STAGES, CrmStage } from "@/hooks/useCRMWhatsApp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, Search, Users, MessageCircleOff, ShoppingCart, MessageCircle, LayoutList, Columns3 } from "lucide-react";
import { formatPhone, formatDateTime } from "@/lib/formatters";
import { CRMKanbanView } from "@/components/admin/crm/CRMKanbanView";

const FILTROS: { value: FiltroWhatsApp; label: string; icon: React.ReactNode }[] = [
  { value: "todos", label: "Todos", icon: <Users className="h-4 w-4" /> },
  { value: "nao_compraram", label: "Não compraram", icon: <ShoppingCart className="h-4 w-4" /> },
  { value: "nunca_receberam", label: "Nunca receberam msg", icon: <MessageCircleOff className="h-4 w-4" /> },
  { value: "receberam_nao_compraram", label: "Receberam, não compraram", icon: <MessageCircle className="h-4 w-4" /> },
  ...CRM_STAGES.map((s) => ({ value: s.value as FiltroWhatsApp, label: s.label, icon: <Users className="h-4 w-4" /> })),
];

function BadgePlano({ plano }: { plano: string | null }) {
  if (!plano) return <Badge variant="outline">Sem plano</Badge>;
  const cores: Record<string, string> = {
    free: "bg-gray-100 text-gray-700",
    demonstracao: "bg-yellow-100 text-yellow-700",
    trial: "bg-blue-100 text-blue-700",
    basico_mensal: "bg-green-100 text-green-700",
    basico_anual: "bg-green-100 text-green-700",
    intermediario_mensal: "bg-emerald-100 text-emerald-700",
    intermediario_anual: "bg-emerald-100 text-emerald-700",
    profissional_mensal: "bg-purple-100 text-purple-700",
    profissional_anual: "bg-purple-100 text-purple-700",
  };
  return (
    <Badge className={cores[plano] || "bg-muted text-muted-foreground"} variant="secondary">
      {plano.replace(/_/g, " ")}
    </Badge>
  );
}

function BadgeCrmStage({ stage }: { stage: string }) {
  const cores: Record<string, string> = {
    novo: "bg-gray-100 text-gray-700",
    boas_vindas_enviada: "bg-blue-100 text-blue-700",
    falta_1_hora_enviada: "bg-yellow-100 text-yellow-700",
    "2_dias_enviada": "bg-red-100 text-red-700",
    cliente: "bg-green-100 text-green-700",
  };
  const label = CRM_STAGES.find((s) => s.value === stage)?.label || stage;
  return (
    <Badge className={cores[stage] || "bg-muted text-muted-foreground"} variant="secondary">
      {label}
    </Badge>
  );
}

type ModoVisualizacao = "tabela" | "kanban";

export default function AdminCRM() {
  const [modo, setModo] = useState<ModoVisualizacao>("tabela");
  const {
    profiles, allProfiles, totalProfiles, isLoading,
    filtro, setFiltro, busca, setBusca, recarregar, moverEstagio,
  } = useCRMWhatsApp();

  if (isLoading) {
    return (
      <AppLayout>
        <main className="flex-1 p-4 sm:p-6 overflow-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
          <Skeleton className="h-[400px]" />
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">📱 CRM WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Funil de follow-up para automações via n8n</p>
          </div>
          <div className="flex gap-2">
            <Button variant={modo === "tabela" ? "default" : "outline"} size="sm" onClick={() => setModo("tabela")}>
              <LayoutList className="h-4 w-4 mr-1" /> Tabela
            </Button>
            <Button variant={modo === "kanban" ? "default" : "outline"} size="sm" onClick={() => setModo("kanban")}>
              <Columns3 className="h-4 w-4 mr-1" /> Kanban
            </Button>
            <Button variant="outline" size="sm" onClick={recarregar}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone..." className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <Button key={f.value} variant={filtro === f.value ? "default" : "outline"} size="sm" onClick={() => setFiltro(f.value)} className="gap-1.5">
                {f.icon} {f.label}
              </Button>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Mostrando <strong>{profiles.length}</strong> de {totalProfiles} perfis
        </p>

        {modo === "kanban" ? (
          <CRMKanbanView profiles={allProfiles} onMoverEstagio={moverEstagio} />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Estágio CRM</TableHead>
                      <TableHead>WhatsApp Enviado</TableHead>
                      <TableHead>Última Msg</TableHead>
                      <TableHead>Cadastro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          Nenhum perfil encontrado com os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      profiles.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.nome}</TableCell>
                          <TableCell>{p.celular ? formatPhone(p.celular) : "—"}</TableCell>
                          <TableCell><BadgePlano plano={p.plano_tipo} /></TableCell>
                          <TableCell><BadgeCrmStage stage={p.crm_stage} /></TableCell>
                          <TableCell>{p.whatsapp_enviado ? "✅" : "—"}</TableCell>
                          <TableCell className="text-sm">
                            {p.whatsapp_ultima_mensagem ? formatDateTime(p.whatsapp_ultima_mensagem) : "—"}
                          </TableCell>
                          <TableCell className="text-sm">{formatDateTime(p.created_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </AppLayout>
  );
}
