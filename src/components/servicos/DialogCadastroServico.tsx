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
import { Check, Plus, X } from "lucide-react";
import { Servico } from "@/types/servico";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTiposServico } from "@/hooks/useTiposServico";

const NENHUM_TIPO = "__nenhum__";

const formSchema = z.object({
  codigo: z.string().optional(),
  nome: z.string().min(1, "Nome é obrigatório"),
  custo: z.coerce.number().min(0, "Custo deve ser maior ou igual a zero"),
  preco: z.coerce.number().min(0, "Preço deve ser maior ou igual a zero"),
  peca_id: z.string().optional(),
  tipo_servico_id: z.string().optional(),
  tempo_medio_estimado: z.string().optional(),
}).refine((data) => data.preco >= data.custo, {
  message: "Preço de venda deve ser maior ou igual ao custo",
  path: ["preco"],
});

type FormValues = z.infer<typeof formSchema>;

export interface DadosSubmitServico extends Omit<FormValues, "tempo_medio_estimado"> {
  tempo_medio_estimado_horas: number | null;
}

interface DialogCadastroServicoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dados: DadosSubmitServico) => Promise<void>;
  servicoParaEditar: Servico | null;
}

export function DialogCadastroServico({
  open,
  onOpenChange,
  onSubmit,
  servicoParaEditar,
}: DialogCadastroServicoProps) {
  const [pecas, setPecas] = useState<Array<{ id: string; nome: string }>>([]);
  const { tiposServico, criar: criarTipoServico } = useTiposServico();
  const [criandoTipo, setCriandoTipo] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState("");

  // Tempo médio estimado é sempre persistido em horas decimais
  // (tempo_medio_estimado_horas), mas o usuário pode digitar em minutos ou
  // horas — mesmo padrão de seletor de unidade do campo "Tempo gasto" da OS.
  const [unidadeTempo, setUnidadeTempo] = useState<"minutos" | "horas">("horas");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      codigo: "",
      nome: "",
      custo: 0,
      preco: 0,
      peca_id: undefined,
      tipo_servico_id: undefined,
      tempo_medio_estimado: "",
    },
  });

  const custo = form.watch("custo");
  const preco = form.watch("preco");
  const lucro = preco - custo;

  const definirUnidadeEValor = (tempoHoras: number | null | undefined) => {
    if (tempoHoras == null) {
      setUnidadeTempo("horas");
      return "";
    }
    const unidade = tempoHoras > 0 && tempoHoras < 1 ? "minutos" : "horas";
    setUnidadeTempo(unidade);
    return unidade === "minutos" ? String(Math.round(tempoHoras * 60)) : String(tempoHoras);
  };

  const handleTrocarUnidade = (novaUnidade: "minutos" | "horas") => {
    if (novaUnidade === unidadeTempo) return;

    const valorAtual = form.getValues("tempo_medio_estimado");
    const numerico = valorAtual ? Number(valorAtual.replace(",", ".")) : null;
    if (numerico != null && !Number.isNaN(numerico)) {
      const valorEmHoras = unidadeTempo === "minutos" ? numerico / 60 : numerico;
      const novoValor =
        novaUnidade === "minutos" ? String(Math.round(valorEmHoras * 60)) : String(valorEmHoras);
      form.setValue("tempo_medio_estimado", novoValor);
    }
    setUnidadeTempo(novaUnidade);
  };

  useEffect(() => {
    setCriandoTipo(false);
    setNovoTipoNome("");
    if (servicoParaEditar) {
      form.reset({
        codigo: servicoParaEditar.codigo || "",
        nome: servicoParaEditar.nome,
        custo: servicoParaEditar.custo,
        preco: servicoParaEditar.preco,
        peca_id: servicoParaEditar.peca_id || undefined,
        tipo_servico_id: servicoParaEditar.tipo_servico_id || undefined,
        tempo_medio_estimado: definirUnidadeEValor(servicoParaEditar.tempo_medio_estimado_horas),
      });
    } else {
      setUnidadeTempo("horas");
      form.reset({
        codigo: "",
        nome: "",
        custo: 0,
        preco: 0,
        peca_id: undefined,
        tipo_servico_id: undefined,
        tempo_medio_estimado: "",
      });
    }
  }, [servicoParaEditar, form]);

  const handleCriarTipo = async () => {
    const nome = novoTipoNome.trim();
    if (!nome) return;
    const novo = await criarTipoServico(nome);
    if (novo) {
      form.setValue("tipo_servico_id", novo.id);
      setCriandoTipo(false);
      setNovoTipoNome("");
    }
  };

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
    const tempoDigitado = data.tempo_medio_estimado
      ? Number(data.tempo_medio_estimado.replace(",", "."))
      : null;
    const tempoValido = tempoDigitado != null && !Number.isNaN(tempoDigitado);
    const tempoMedioEstimadoHoras = tempoValido
      ? unidadeTempo === "minutos"
        ? tempoDigitado / 60
        : tempoDigitado
      : null;

    const { tempo_medio_estimado, ...resto } = data;
    await onSubmit({
      ...resto,
      tipo_servico_id:
        resto.tipo_servico_id && resto.tipo_servico_id !== NENHUM_TIPO
          ? resto.tipo_servico_id
          : undefined,
      tempo_medio_estimado_horas: tempoMedioEstimadoHoras,
    });
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

            <FormField
              control={form.control}
              name="tipo_servico_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Serviço (para comissão) — Opcional</FormLabel>
                  {criandoTipo ? (
                    <div className="flex gap-2">
                      <Input
                        autoFocus
                        placeholder="Nome do novo tipo de serviço"
                        value={novoTipoNome}
                        onChange={(e) => setNovoTipoNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); handleCriarTipo(); }
                        }}
                      />
                      <Button type="button" size="icon" className="shrink-0" onClick={handleCriarTipo} disabled={!novoTipoNome.trim()}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="shrink-0"
                        onClick={() => { setCriandoTipo(false); setNovoTipoNome(""); }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <Select
                        onValueChange={(value) => field.onChange(value === NENHUM_TIPO ? undefined : value)}
                        value={field.value || NENHUM_TIPO}
                      >
                        <FormControl>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione um tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NENHUM_TIPO}>— Nenhum —</SelectItem>
                          {tiposServico.map((tipo) => (
                            <SelectItem key={tipo.id} value={tipo.id}>
                              {tipo.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="shrink-0"
                        title="Criar novo tipo de serviço"
                        onClick={() => setCriandoTipo(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Quando vinculado, a comissão do técnico para este serviço usa o percentual deste
                    Tipo direto, sem depender do nome. Sem vínculo, o cálculo cai na correspondência por nome.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tempo_medio_estimado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tempo Médio Estimado (Opcional)</FormLabel>
                  <div className="flex items-center gap-1.5">
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder={unidadeTempo === "minutos" ? "Ex: 90" : "Ex: 1.5"}
                        {...field}
                        className="w-28"
                      />
                    </FormControl>
                    <div className="flex items-center rounded-md border overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTrocarUnidade("minutos")}
                        className={`px-2 h-9 text-xs transition-colors ${
                          unidadeTempo === "minutos"
                            ? "bg-primary text-primary-foreground"
                            : "bg-transparent text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        min
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTrocarUnidade("horas")}
                        className={`px-2 h-9 text-xs transition-colors border-l ${
                          unidadeTempo === "horas"
                            ? "bg-primary text-primary-foreground"
                            : "bg-transparent text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        h
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usado como estimativa de referência até que OS reais desse serviço tenham tempo registrado.
                  </p>
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
