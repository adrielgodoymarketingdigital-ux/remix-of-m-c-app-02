import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Servico } from "@/types/servico";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const formSchema = z.object({
  codigo: z.string().optional(),
  nome: z.string().min(1, "Nome é obrigatório"),
  custo: z.coerce.number().min(0, "Custo deve ser maior ou igual a zero"),
  preco: z.coerce.number().min(0, "Preço deve ser maior ou igual a zero"),
  peca_id: z.string().optional(),
}).refine((data) => data.preco >= data.custo, {
  message: "Preço de venda deve ser maior ou igual ao custo",
  path: ["preco"],
});

type FormValues = z.infer<typeof formSchema>;

interface DialogCadastroServicoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dados: FormValues) => Promise<void>;
  servicoParaEditar: Servico | null;
}

export function DialogCadastroServico({
  open,
  onOpenChange,
  onSubmit,
  servicoParaEditar,
}: DialogCadastroServicoProps) {
  const [pecas, setPecas] = useState<Array<{ id: string; nome: string }>>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      codigo: "",
      nome: "",
      custo: 0,
      preco: 0,
      peca_id: undefined,
    },
  });

  const custo = form.watch("custo");
  const preco = form.watch("preco");
  const lucro = preco - custo;

  useEffect(() => {
    if (servicoParaEditar) {
      form.reset({
        codigo: servicoParaEditar.codigo || "",
        nome: servicoParaEditar.nome,
        custo: servicoParaEditar.custo,
        preco: servicoParaEditar.preco,
        peca_id: servicoParaEditar.peca_id || undefined,
      });
    } else {
      form.reset({
        codigo: "",
        nome: "",
        custo: 0,
        preco: 0,
        peca_id: undefined,
      });
    }
  }, [servicoParaEditar, form]);

  useEffect(() => {
    const carregarPecas = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
          .from("pecas")
          .select("id, nome")
          .eq("user_id", user.id)
          .order("nome", { ascending: true });

        if (error) throw error;

        setPecas(data || []);
      } catch (error) {
        console.error("Erro ao carregar peças:", error);
        toast.error("Erro ao carregar peças");
      }
    };

    if (open) {
      carregarPecas();
    }
  }, [open]);

  const handleSubmit = async (data: FormValues) => {
    await onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {servicoParaEditar ? "Editar Serviço" : "Cadastrar Novo Serviço"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="codigo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: SERV-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do serviço" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="peca_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Peça Vinculada (Opcional)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma peça" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma peça</SelectItem>
                      {pecas.map((peca) => (
                        <SelectItem key={peca.id} value={peca.id}>
                          {peca.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="custo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço de Custo *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço de Venda *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Lucro:</span>
                <span
                  className={`text-lg font-bold ${
                    lucro >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  R$ {lucro.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                {servicoParaEditar ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
