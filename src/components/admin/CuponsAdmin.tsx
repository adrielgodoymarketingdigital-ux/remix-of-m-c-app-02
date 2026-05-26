import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tag,
  Plus,
  Trash2,
  Loader2,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Cupom {
  id: string;
  codigo: string;
  tipo: "percent" | "flat";
  valor: number;
  ativo: boolean;
  usos_maximos: number | null;
  usos_atuais: number;
  expira_em: string | null;
  created_at: string;
}

interface FormState {
  codigo: string;
  tipo: "percent" | "flat";
  valor: string;
  usos_maximos: string;
  expira_em: string;
}

const FORM_INICIAL: FormState = {
  codigo: "",
  tipo: "percent",
  valor: "",
  usos_maximos: "",
  expira_em: "",
};

const formatarValor = (cupom: Cupom) => {
  if (cupom.tipo === "percent") return `${cupom.valor}%`;
  return `R$ ${(cupom.valor / 100).toFixed(2).replace(".", ",")}`;
};

export function CuponsAdmin() {
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [cupomParaDeletar, setCupomParaDeletar] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);

  // ── Buscar cupons ─────────────────────────────────────────────────
  const { data: cupons = [], isLoading } = useQuery({
    queryKey: ["admin-cupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Cupom[];
    },
  });

  // ── Toggle ativo ──────────────────────────────────────────────────
  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("cupons")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cupons"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar cupom: ${err.message}`);
    },
  });

  // ── Deletar ───────────────────────────────────────────────────────
  const deletar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cupons"] });
      toast.success("Cupom excluído.");
      setCupomParaDeletar(null);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao excluir cupom: ${err.message}`);
    },
  });

  // ── Salvar novo cupom ─────────────────────────────────────────────
  const handleSalvar = async () => {
    const codigoTrimado = form.codigo.trim().toUpperCase();
    if (!codigoTrimado) return toast.error("Informe o código do cupom.");

    const valorNum = parseInt(form.valor, 10);
    if (isNaN(valorNum) || valorNum <= 0) return toast.error("Informe um valor válido.");
    if (form.tipo === "percent" && valorNum > 100)
      return toast.error("Desconto percentual não pode ser maior que 100%.");

    setSalvando(true);
    try {
      const payload: Record<string, unknown> = {
        codigo: codigoTrimado,
        tipo: form.tipo,
        valor: form.tipo === "flat" ? Math.round(valorNum * 100) : valorNum, // flat em centavos
        ativo: true,
        usos_maximos: form.usos_maximos ? parseInt(form.usos_maximos, 10) : null,
        expira_em: form.expira_em ? new Date(form.expira_em).toISOString() : null,
      };

      const { error } = await supabase.from("cupons").insert(payload);
      if (error) {
        if (error.code === "23505") throw new Error("Já existe um cupom com esse código.");
        throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["admin-cupons"] });
      toast.success(`Cupom ${codigoTrimado} criado com sucesso!`);
      setDialogAberto(false);
      setForm(FORM_INICIAL);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar cupom.";
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  };

  const handleAbrirDialog = () => {
    setForm(FORM_INICIAL);
    setDialogAberto(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-600">
            <Ticket className="h-5 sm:h-6 w-5 sm:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Cupons</h1>
            <p className="text-sm text-muted-foreground">
              Crie e gerencie cupons de desconto para o checkout
            </p>
          </div>
        </div>
        <Button onClick={handleAbrirDialog} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Novo Cupom
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando cupons...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && cupons.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center border rounded-lg bg-muted/20">
          <div className="p-4 rounded-full bg-muted">
            <Tag className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Nenhum cupom cadastrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Clique em "Novo Cupom" para criar o primeiro cupom de desconto.
            </p>
          </div>
          <Button onClick={handleAbrirDialog} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Criar primeiro cupom
          </Button>
        </div>
      )}

      {/* Tabela */}
      {!isLoading && cupons.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Ativo</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]">Excluir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cupons.map((cupom) => {
                const expirado =
                  !!cupom.expira_em && new Date(cupom.expira_em) < new Date();
                const esgotado =
                  cupom.usos_maximos !== null &&
                  cupom.usos_atuais >= cupom.usos_maximos;

                return (
                  <TableRow key={cupom.id}>
                    {/* Toggle ativo */}
                    <TableCell>
                      <Switch
                        checked={cupom.ativo}
                        onCheckedChange={(checked) =>
                          toggleAtivo.mutate({ id: cupom.id, ativo: checked })
                        }
                      />
                    </TableCell>

                    {/* Código */}
                    <TableCell>
                      <span className="font-mono font-semibold tracking-widest text-sm">
                        {cupom.codigo}
                      </span>
                    </TableCell>

                    {/* Tipo */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          cupom.tipo === "percent"
                            ? "border-blue-300 text-blue-700 dark:text-blue-400"
                            : "border-emerald-300 text-emerald-700 dark:text-emerald-400"
                        )}
                      >
                        {cupom.tipo === "percent" ? "Percentual" : "Valor fixo"}
                      </Badge>
                    </TableCell>

                    {/* Valor */}
                    <TableCell className="font-semibold">
                      {formatarValor(cupom)}
                    </TableCell>

                    {/* Usos */}
                    <TableCell className="text-sm text-muted-foreground">
                      {cupom.usos_atuais}
                      {cupom.usos_maximos !== null
                        ? ` / ${cupom.usos_maximos}`
                        : " / ∞"}
                    </TableCell>

                    {/* Expira em */}
                    <TableCell className="text-sm text-muted-foreground">
                      {cupom.expira_em
                        ? format(new Date(cupom.expira_em), "dd/MM/yyyy", {
                            locale: ptBR,
                          })
                        : "—"}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {!cupom.ativo ? (
                        <Badge variant="secondary">Inativo</Badge>
                      ) : expirado ? (
                        <Badge variant="outline" className="text-gray-500">
                          Expirado
                        </Badge>
                      ) : esgotado ? (
                        <Badge
                          variant="outline"
                          className="text-amber-600 border-amber-300"
                        >
                          Esgotado
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
                          Ativo
                        </Badge>
                      )}
                    </TableCell>

                    {/* Excluir */}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setCupomParaDeletar(cupom.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog: Novo Cupom */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-violet-600" />
              Novo Cupom
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Código */}
            <div className="space-y-2">
              <Label htmlFor="cupom-codigo" className="text-xs font-semibold">
                Código
              </Label>
              <Input
                id="cupom-codigo"
                placeholder="EX: DESCONTO20"
                value={form.codigo}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    codigo: e.target.value.toUpperCase(),
                  }))
                }
                className="font-mono tracking-widest uppercase"
                maxLength={30}
              />
            </div>

            {/* Tipo + Valor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cupom-tipo" className="text-xs font-semibold">
                  Tipo de desconto
                </Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      tipo: v as "percent" | "flat",
                      valor: "",
                    }))
                  }
                >
                  <SelectTrigger id="cupom-tipo" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentual (%)</SelectItem>
                    <SelectItem value="flat">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cupom-valor" className="text-xs font-semibold">
                  Valor {form.tipo === "percent" ? "(%)" : "(R$)"}
                </Label>
                <div className="relative">
                  <Input
                    id="cupom-valor"
                    type="number"
                    inputMode="numeric"
                    placeholder={form.tipo === "percent" ? "20" : "10.00"}
                    value={form.valor}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, valor: e.target.value }))
                    }
                    min={1}
                    max={form.tipo === "percent" ? 100 : undefined}
                    className="h-11 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    {form.tipo === "percent" ? "%" : "R$"}
                  </span>
                </div>
              </div>
            </div>

            {/* Usos máximos */}
            <div className="space-y-2">
              <Label htmlFor="cupom-usos" className="text-xs font-semibold">
                Usos máximos{" "}
                <span className="text-muted-foreground font-normal">
                  (deixe vazio para ilimitado)
                </span>
              </Label>
              <Input
                id="cupom-usos"
                type="number"
                inputMode="numeric"
                placeholder="100"
                value={form.usos_maximos}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, usos_maximos: e.target.value }))
                }
                min={1}
                className="h-11"
              />
            </div>

            {/* Expira em */}
            <div className="space-y-2">
              <Label htmlFor="cupom-expira" className="text-xs font-semibold">
                Expira em{" "}
                <span className="text-muted-foreground font-normal">
                  (opcional)
                </span>
              </Label>
              <Input
                id="cupom-expira"
                type="date"
                value={form.expira_em}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, expira_em: e.target.value }))
                }
                min={new Date().toISOString().split("T")[0]}
                className="h-11"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar cupom
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirmar exclusão */}
      <AlertDialog
        open={!!cupomParaDeletar}
        onOpenChange={() => setCupomParaDeletar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cupom? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                cupomParaDeletar && deletar.mutate(cupomParaDeletar)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
