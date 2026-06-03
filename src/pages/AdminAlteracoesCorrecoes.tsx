import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  useAlteracoesCorrecoes,
  type AlteracaoCorrecao,
  type AlteracaoCorrecaoInsert,
  type Prioridade,
} from "@/hooks/useAlteracoesCorrecoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClipboardList, Plus, Pencil, Trash2 } from "lucide-react";

const PRIORIDADE_CONFIG: Record<
  Prioridade,
  { label: string; color: string; bgCard: string; order: number }
> = {
  muito_urgente: {
    label: "Muito Urgente",
    color: "bg-red-600 text-white",
    bgCard: "border-l-4 border-l-red-500",
    order: 1,
  },
  urgente: {
    label: "Urgente",
    color: "bg-orange-500 text-white",
    bgCard: "border-l-4 border-l-orange-400",
    order: 2,
  },
  melhoria: {
    label: "Melhoria",
    color: "bg-blue-500 text-white",
    bgCard: "border-l-4 border-l-blue-400",
    order: 3,
  },
  nao_urgente: {
    label: "Não Urgente",
    color: "bg-slate-500 text-white",
    bgCard: "border-l-4 border-l-slate-400",
    order: 4,
  },
};

const PRIORIDADES_ORDEM: Prioridade[] = [
  "muito_urgente",
  "urgente",
  "melhoria",
  "nao_urgente",
];

const FORM_VAZIO: AlteracaoCorrecaoInsert = {
  titulo: "",
  descricao: "",
  prioridade: "urgente",
  concluido: false,
};

export default function AdminAlteracoesCorrecoes() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setIsAdmin(false); return; }
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle()
        .then(({ data }) => setIsAdmin(!!data));
    });
  }, []);

  const { itens, isLoading, criar, atualizar, excluir, toggleConcluido } =
    useAlteracoesCorrecoes();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [editando, setEditando] = useState<AlteracaoCorrecao | null>(null);
  const [form, setForm] = useState<AlteracaoCorrecaoInsert>(FORM_VAZIO);
  const [filtroPrioridade, setFiltroPrioridade] = useState<Prioridade | "todos">("todos");
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false);

  if (isAdmin === false) return <Navigate to="/dashboard" replace />;

  const itensFiltrados = itens
    .filter((i) => {
      if (!mostrarConcluidos && i.concluido) return false;
      if (filtroPrioridade !== "todos" && i.prioridade !== filtroPrioridade)
        return false;
      return true;
    });

  const itensPorPrioridade = PRIORIDADES_ORDEM.map((p) => ({
    prioridade: p,
    config: PRIORIDADE_CONFIG[p],
    itens: itensFiltrados.filter((i) => i.prioridade === p),
  })).filter((grupo) => grupo.itens.length > 0);

  const totais = PRIORIDADES_ORDEM.reduce(
    (acc, p) => ({
      ...acc,
      [p]: itens.filter((i) => i.prioridade === p && !i.concluido).length,
    }),
    {} as Record<Prioridade, number>
  );

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setDialogOpen(true);
  }

  function abrirEditar(item: AlteracaoCorrecao) {
    setEditando(item);
    setForm({
      titulo: item.titulo,
      descricao: item.descricao ?? "",
      prioridade: item.prioridade,
      concluido: item.concluido,
    });
    setDialogOpen(true);
  }

  function salvar() {
    if (!form.titulo.trim()) return;
    if (editando) {
      atualizar.mutate({ id: editando.id, ...form });
    } else {
      criar.mutate(form);
    }
    setDialogOpen(false);
  }

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-600">
              <ClipboardList className="h-5 sm:h-6 w-5 sm:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">
                Alterações & Correções
              </h1>
              <p className="text-sm text-muted-foreground">
                Anote o que precisa ser feito e priorize
              </p>
            </div>
          </div>
          <Button onClick={abrirNovo} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Nova Anotação
          </Button>
        </div>

        {/* Contadores por prioridade */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRIORIDADES_ORDEM.map((p) => (
            <button
              key={p}
              onClick={() =>
                setFiltroPrioridade(filtroPrioridade === p ? "todos" : p)
              }
              className={`rounded-lg p-3 text-left transition-all border ${
                filtroPrioridade === p
                  ? "ring-2 ring-offset-1 ring-offset-background ring-violet-500"
                  : "hover:bg-muted/50"
              } bg-card`}
            >
              <p className="text-xs text-muted-foreground mb-1">
                {PRIORIDADE_CONFIG[p].label}
              </p>
              <p className="text-2xl font-bold">{totais[p]}</p>
              <p className="text-xs text-muted-foreground">pendentes</p>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox
              checked={mostrarConcluidos}
              onCheckedChange={(v) => setMostrarConcluidos(!!v)}
            />
            Mostrar concluídos
          </label>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {/* Itens agrupados por prioridade */}
        {!isLoading && (
          <div className="space-y-6">
            {itensPorPrioridade.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma anotação encontrada. Clique em "Nova Anotação" para começar.
              </div>
            )}
            {itensPorPrioridade.map(({ prioridade, config, itens: grupo }) => (
              <div key={prioridade}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={config.color}>{config.label}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {grupo.length} {grupo.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <div className="space-y-2">
                  {grupo.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 bg-card rounded-lg p-4 ${config.bgCard} ${
                        item.concluido ? "opacity-50" : ""
                      }`}
                    >
                      <Checkbox
                        checked={item.concluido}
                        onCheckedChange={(v) =>
                          toggleConcluido.mutate({
                            id: item.id,
                            concluido: !!v,
                          })
                        }
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium leading-snug ${
                            item.concluido ? "line-through" : ""
                          }`}
                        >
                          {item.titulo}
                        </p>
                        {item.descricao && (
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                            {item.descricao}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(item.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => abrirEditar(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setExcluirId(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar Anotação" : "Nova Anotação"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Título *</label>
              <Input
                value={form.titulo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, titulo: e.target.value }))
                }
                placeholder="Descreva o que precisa ser feito"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Detalhes</label>
              <Textarea
                value={form.descricao ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descricao: e.target.value }))
                }
                placeholder="Detalhes adicionais (opcional)"
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Prioridade</label>
              <Select
                value={form.prioridade}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, prioridade: v as Prioridade }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES_ORDEM.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORIDADE_CONFIG[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={salvar}
              disabled={!form.titulo.trim() || criar.isPending || atualizar.isPending}
            >
              {editando ? "Salvar alterações" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm excluir */}
      <AlertDialog open={!!excluirId} onOpenChange={() => setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anotação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (excluirId) excluir.mutate(excluirId);
                setExcluirId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
