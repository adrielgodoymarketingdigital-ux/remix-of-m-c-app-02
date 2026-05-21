import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";

const formSchema = z.object({
  marca: z.string().trim().min(1, "Marca é obrigatória"),
  modelo: z.string().trim().min(1, "Modelo é obrigatório"),
  total: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).replace(",", "."))),
    z.number({ required_error: "Preço de venda é obrigatório" }).min(0, "Deve ser maior ou igual a 0")
  ),
  custo_unitario: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? 0 : Number(String(val).replace(",", "."))),
    z.number().min(0, "Deve ser maior ou igual a 0").default(0)
  ),
  forma_pagamento: z.string().min(1, "Forma de pagamento é obrigatória"),
});

type FormValues = z.infer<typeof formSchema>;

export interface VendaDispositivoParaEditar {
  id: string;
  dispositivo_id: string;
  grupo_venda?: string | null;
  total: number;
  custo_unitario?: number;
  forma_pagamento: string;
  dispositivo_marca?: string;
  dispositivo_modelo?: string;
}

interface DialogEditarVendaDispositivoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda: VendaDispositivoParaEditar | null;
  onSalvo: () => void;
}

const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "credito_parcelado", label: "Crédito Parcelado" },
  { value: "a_prazo", label: "A Prazo" },
  { value: "a_receber", label: "A Receber" },
];

export function DialogEditarVendaDispositivo({
  open,
  onOpenChange,
  venda,
  onSalvo,
}: DialogEditarVendaDispositivoProps) {
  const [salvando, setSalvando] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      marca: "",
      modelo: "",
      total: 0,
      custo_unitario: 0,
      forma_pagamento: "dinheiro",
    },
  });

  const totalWatch = form.watch("total") || 0;
  const custoWatch = form.watch("custo_unitario") || 0;
  const lucro = totalWatch - custoWatch;

  useEffect(() => {
    if (venda && open) {
      form.reset({
        marca: venda.dispositivo_marca ?? "",
        modelo: venda.dispositivo_modelo ?? "",
        total: venda.total,
        custo_unitario: venda.custo_unitario ?? 0,
        forma_pagamento: venda.forma_pagamento || "dinheiro",
      });
    }
  }, [venda, open, form]);

  const onSubmit = async (values: FormValues) => {
    if (!venda) return;
    setSalvando(true);

    try {
      const novoNome = `${values.marca} ${values.modelo}`.trim();

      // 1. Atualizar o registro principal da venda (total, custo e fallback de nome em observacoes)
      const observacoesAtuais = await supabase
        .from("vendas")
        .select("observacoes")
        .eq("id", venda.id)
        .single();

      // Só sobrescreve observacoes se não for uma flag de sistema
      const obsAtual = observacoesAtuais.data?.observacoes ?? null;
      const deveAtualizarObs =
        obsAtual === null ||
        obsAtual === venda.dispositivo_marca ||
        obsAtual === `${venda.dispositivo_marca} ${venda.dispositivo_modelo}` ||
        (!obsAtual.includes("pagamento_duplo"));

      const { error: vendaError } = await supabase
        .from("vendas")
        .update({
          total: values.total,
          custo_unitario: values.custo_unitario,
          forma_pagamento: values.forma_pagamento,
          ...(deveAtualizarObs ? { observacoes: novoNome } : {}),
        })
        .eq("id", venda.id);

      if (vendaError) throw vendaError;

      // 2. Se há grupo_venda, atualizar forma de pagamento no registro secundário
      if (venda.grupo_venda) {
        await supabase
          .from("vendas")
          .update({ forma_pagamento: values.forma_pagamento })
          .eq("grupo_venda", venda.grupo_venda)
          .eq("observacoes", "pagamento_duplo_secundario");
      }

      // 3. Atualizar o dispositivo: marca, modelo, preco e custo
      //    Isso propaga o novo nome para TabelaVendas, Relatórios, OS, etc.
      if (venda.dispositivo_id) {
        const { error: dispError } = await supabase
          .from("dispositivos")
          .update({
            marca: values.marca,
            modelo: values.modelo,
            preco: values.total,
            custo: values.custo_unitario,
          })
          .eq("id", venda.dispositivo_id);

        if (dispError) throw dispError;
      }

      toast.success("Venda atualizada com sucesso!", {
        description: `"${novoNome}" — nome, preço e custo atualizados em todos os menus.`,
      });

      onSalvo();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Erro ao salvar edição da venda:", err);
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao salvar", { description: message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Venda</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Alterações refletem no dashboard, relatórios e lista de vendas.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* ── Nome do produto ── */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome do produto</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="marca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Samsung" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="modelo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Galaxy A15" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* ── Valores ── */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valores</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço de Venda (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="custo_unitario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custo (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Lucro calculado */}
            <div className="rounded-md border p-3 bg-muted/40">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lucro calculado:</span>
                <div className="flex items-center gap-1">
                  {lucro >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <Badge
                    variant={lucro >= 0 ? "default" : "destructive"}
                    className={lucro >= 0 ? "bg-emerald-600" : ""}
                  >
                    {formatCurrency(lucro)}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Pagamento ── */}
            <FormField
              control={form.control}
              name="forma_pagamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forma de Pagamento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FORMAS_PAGAMENTO.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
