import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatPhone, formatDateTime } from "@/lib/formatters";
import { CRMWhatsAppProfile, CrmStage, CRM_STAGES } from "@/hooks/useCRMWhatsApp";
import { toast } from "sonner";
import { MessageCircle, Users, CalendarIcon, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
interface CRMKanbanViewProps {
  profiles: CRMWhatsAppProfile[];
  onMoverEstagio: (userId: string, novoEstagio: CrmStage) => Promise<boolean>;
}

type VisualizacaoKanban = "whatsapp" | "plano";

interface KanbanColumn {
  id: string;
  label: string;
  color: string;
  filterFn: (p: CRMWhatsAppProfile) => boolean;
}

const COLUNAS_WHATSAPP: KanbanColumn[] = [
  {
    id: "novo",
    label: "Novo",
    color: "#6b7280",
    filterFn: (p) => p.crm_stage === "novo",
  },
  {
    id: "boas_vindas_enviada",
    label: "Boas-vindas enviada",
    color: "#3b82f6",
    filterFn: (p) => p.crm_stage === "boas_vindas_enviada",
  },
  {
    id: "falta_1_hora_enviada",
    label: "Falta 1 hora",
    color: "#f59e0b",
    filterFn: (p) => p.crm_stage === "falta_1_hora_enviada",
  },
  {
    id: "2_dias_enviada",
    label: "2 dias enviada",
    color: "#ef4444",
    filterFn: (p) => p.crm_stage === "2_dias_enviada",
  },
  {
    id: "cliente",
    label: "Cliente",
    color: "#22c55e",
    filterFn: (p) => p.crm_stage === "cliente",
  },
];

const PLANOS_FREE = ["free", null, undefined];
const PLANOS_TRIAL = ["demonstracao", "trial"];
const PLANOS_PAGOS = [
  "basico_mensal", "basico_anual",
  "intermediario_mensal", "intermediario_anual",
  "profissional_mensal", "profissional_anual",
];

const COLUNAS_PLANO: KanbanColumn[] = [
  {
    id: "free",
    label: "Plano Free",
    color: "#6b7280",
    filterFn: (p) => !p.plano_tipo || p.plano_tipo === "free",
  },
  {
    id: "trial",
    label: "Plano Trial",
    color: "#f59e0b",
    filterFn: (p) => PLANOS_TRIAL.includes(p.plano_tipo || ""),
  },
  {
    id: "assinante",
    label: "Assinante",
    color: "#22c55e",
    filterFn: (p) => PLANOS_PAGOS.includes(p.plano_tipo || ""),
  },
];

function BadgePlano({ plano }: { plano: string | null }) {
  if (!plano) return <Badge variant="outline" className="text-xs">Sem plano</Badge>;
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
    <Badge className={`text-xs ${cores[plano] || "bg-muted text-muted-foreground"}`} variant="secondary">
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
    <Badge className={`text-xs ${cores[stage] || "bg-muted text-muted-foreground"}`} variant="secondary">
      {label}
    </Badge>
  );
}

function ProfileCard({
  profile,
  visualizacao,
}: {
  profile: CRMWhatsAppProfile;
  visualizacao: VisualizacaoKanban;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("userId", profile.user_id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="bg-background border rounded-lg p-3 space-y-2 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <p className="font-medium text-sm truncate">{profile.nome}</p>
      {profile.celular && (
        <p className="text-xs text-muted-foreground">{formatPhone(profile.celular)}</p>
      )}
      <div className="flex flex-wrap gap-1">
        <BadgePlano plano={profile.plano_tipo} />
        {visualizacao === "plano" && <BadgeCrmStage stage={profile.crm_stage} />}
      </div>
      <p className="text-xs text-muted-foreground">
        Cadastro: {formatDateTime(profile.created_at)}
      </p>
    </div>
  );
}

export function CRMKanbanView({ profiles, onMoverEstagio }: CRMKanbanViewProps) {
  const [visualizacao, setVisualizacao] = useState<VisualizacaoKanban>("whatsapp");
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [buscasPorColuna, setBuscasPorColuna] = useState<Record<string, string>>({});

  const colunas = visualizacao === "whatsapp" ? COLUNAS_WHATSAPP : COLUNAS_PLANO;

  // Filtrar profiles por data de cadastro
  const profilesFiltrados = profiles.filter((p) => {
    if (!dataInicio && !dataFim) return true;
    const dataCadastro = new Date(p.created_at);
    if (dataInicio) {
      const inicio = new Date(dataInicio);
      inicio.setHours(0, 0, 0, 0);
      if (dataCadastro < inicio) return false;
    }
    if (dataFim) {
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      if (dataCadastro > fim) return false;
    }
    return true;
  });

  const handleDrop = async (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const userId = e.dataTransfer.getData("userId");
    if (!userId) return;

    if (visualizacao === "whatsapp") {
      const ok = await onMoverEstagio(userId, colId as CrmStage);
      if (ok) {
        toast.success(`Movido para "${colunas.find((c) => c.id === colId)?.label}"`);
      } else {
        toast.error("Erro ao mover estágio");
      }
    } else {
      toast.info("Não é possível alterar o plano arrastando. Use o painel de assinaturas.");
    }
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = visualizacao === "whatsapp" ? "move" : "none";
    setDragOverCol(colId);
  };

  const profilesPorColuna = colunas.map((col) => {
    const buscaColuna = (buscasPorColuna[col.id] || "").toLowerCase();
    return {
      ...col,
      profiles: profilesFiltrados
        .filter(col.filterFn)
        .filter((p) => !buscaColuna || p.nome?.toLowerCase().includes(buscaColuna))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    };
  });

  const limparDatas = () => {
    setDataInicio(undefined);
    setDataFim(undefined);
  };

  return (
    <div className="space-y-4">
      {/* Toggle de visualização + Filtro de data */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Visualização:</span>
          <ToggleGroup
            type="single"
            value={visualizacao}
            onValueChange={(v) => v && setVisualizacao(v as VisualizacaoKanban)}
            className="border rounded-lg p-1"
          >
            <ToggleGroupItem value="whatsapp" className="gap-1.5 text-xs px-3">
              <MessageCircle className="h-3.5 w-3.5" />
              Mensagens WhatsApp
            </ToggleGroupItem>
            <ToggleGroupItem value="plano" className="gap-1.5 text-xs px-3">
              <Users className="h-3.5 w-3.5" />
              Status / Plano
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Cadastro:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("text-xs gap-1.5", !dataInicio && "text-muted-foreground")}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Data início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataInicio}
                onSelect={setDataInicio}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <span className="text-xs text-muted-foreground">até</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("text-xs gap-1.5", !dataFim && "text-muted-foreground")}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {dataFim ? format(dataFim, "dd/MM/yyyy") : "Data fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataFim}
                onSelect={setDataFim}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {(dataInicio || dataFim) && (
            <Button variant="ghost" size="sm" onClick={limparDatas} className="text-xs gap-1 h-8 px-2">
              <X className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {profilesPorColuna.map((col) => (
          <div
            key={col.id}
            className="min-w-[280px] max-w-[300px] flex-shrink-0"
            onDrop={(e) => handleDrop(e, col.id)}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={() => setDragOverCol(null)}
          >
            <Card className={`h-full transition-colors ${dragOverCol === col.id ? "ring-2 ring-primary/50 bg-accent/30" : ""}`}>
              <CardHeader className="pb-2 space-y-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="truncate flex-1">{col.label}</span>
                  <Badge variant="outline" className="text-xs">{col.profiles.length}</Badge>
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={buscasPorColuna[col.id] || ""}
                    onChange={(e) => setBuscasPorColuna((prev) => ({ ...prev, [col.id]: e.target.value }))}
                    placeholder="Buscar por nome..."
                    className="h-7 text-xs pl-7"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
                {col.profiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhum perfil neste estágio
                  </p>
                ) : (
                  col.profiles.map((p) => (
                    <ProfileCard key={p.id} profile={p} visualizacao={visualizacao} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
