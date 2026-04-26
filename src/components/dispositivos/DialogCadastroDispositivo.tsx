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
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Switch } from "@/components/ui/switch";
import { Dispositivo, FormularioDispositivo } from "@/types/dispositivo";
import { UploadFotosDispositivo } from "./UploadFotosDispositivo";
import { ChecklistDispositivo } from "../ordens/ChecklistDispositivo";
import { useFornecedores } from "@/hooks/useFornecedores";
import { LeitorCodigoBarras } from "@/components/scanner/LeitorCodigoBarras";
import { ExternalLink, Shield, Lock } from "lucide-react";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";

const optionalNumber = z.preprocess(
  (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
  z.number().optional()
);

const optionalNumberMin0 = z.preprocess(
  (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
  z.number().min(0).optional()
);

const formSchema = z.object({
  tipo: z.string().min(1, "Tipo é obrigatório"),
  marca: z.string().min(1, "Marca é obrigatória"),
  modelo: z.string().min(1, "Modelo é obrigatório"),
  cor: z.string().optional(),
  capacidade_gb: optionalNumber,
  imei: z.string().optional(),
  numero_serie: z.string().optional(),
  saude_bateria: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(0).max(100).optional()
  ),
  garantia: z.boolean().default(false),
  tempo_garantia: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(1, "Tempo mínimo: 1 mês").optional()
  ),
  subtipo_computador: z.string().optional(),
  condicao: z.enum(['novo', 'semi_novo', 'usado']).default('novo'),
  quantidade: z.coerce.number().min(1, "Quantidade deve ser pelo menos 1").default(1),
  fornecedor_id: z.string().optional(),
  custo: optionalNumberMin0,
  preco: optionalNumberMin0,
  foto_url: z.string().optional(),
  fotos: z.array(z.string()).optional(),
  checklist: z.object({
    entrada: z.record(z.boolean()).optional(),
    saida: z.record(z.boolean()).optional(),
  }).optional(),
  codigo_barras: z.string().optional(),
}).refine((data) => {
  if (data.custo && data.preco) {
    return data.preco >= data.custo;
  }
  return true;
}, {
  message: "Preço de venda deve ser maior ou igual ao custo",
  path: ["preco"],
}).refine((data) => {
  if (data.garantia && !data.tempo_garantia) {
    return false;
  }
  return true;
}, {
  message: "Informe o tempo de garantia",
  path: ["tempo_garantia"],
});

type FormValues = z.infer<typeof formSchema>;

interface DialogCadastroDispositivoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dados: FormularioDispositivo) => void | Promise<void>;
  dispositivoParaEditar: Dispositivo | null;
}

const TIPOS_DISPOSITIVO = [
  "Celular",
  "Tablet",
  "Notebook/Computador",
  "Relógio Smart",
];

const SUBTIPOS_COMPUTADOR = [
  "MacBook",
  "iMac",
  "Outro",
];

const CONDICOES_DISPOSITIVO = [
  { value: 'novo', label: 'Novo' },
  { value: 'semi_novo', label: 'Semi Novo' },
  { value: 'usado', label: 'Usado' },
];

export function DialogCadastroDispositivo({
  open,
  onOpenChange,
  onSubmit,
  dispositivoParaEditar,
}: DialogCadastroDispositivoProps) {
  const { fornecedores } = useFornecedores();
  const { podeVerCustos, podeVerLucros } = useFuncionarioPermissoes();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: "",
      marca: "",
      modelo: "",
      cor: "",
      capacidade_gb: undefined,
      imei: "",
      numero_serie: "",
      saude_bateria: undefined,
      garantia: false,
      tempo_garantia: undefined,
      subtipo_computador: "",
      condicao: "novo",
      quantidade: 1,
      fornecedor_id: "none",
      custo: undefined,
      preco: undefined,
      foto_url: "",
      fotos: [],
      checklist: { entrada: {}, saida: {} },
      codigo_barras: "",
    },
  });

  const custo = form.watch("custo") || 0;
  const preco = form.watch("preco") || 0;
  const lucro = preco - custo;
  const garantiaAtiva = form.watch("garantia");
  const tipoSelecionado = form.watch("tipo");

  useEffect(() => {
    if (dispositivoParaEditar) {
      form.reset({
        tipo: dispositivoParaEditar.tipo,
        marca: dispositivoParaEditar.marca,
        modelo: dispositivoParaEditar.modelo,
        cor: dispositivoParaEditar.cor || "",
        capacidade_gb: dispositivoParaEditar.capacidade_gb,
        imei: dispositivoParaEditar.imei || "",
        numero_serie: dispositivoParaEditar.numero_serie || "",
        saude_bateria: dispositivoParaEditar.saude_bateria,
        garantia: dispositivoParaEditar.garantia,
        tempo_garantia: dispositivoParaEditar.tempo_garantia,
        subtipo_computador: dispositivoParaEditar.subtipo_computador || "",
        condicao: dispositivoParaEditar.condicao,
        quantidade: dispositivoParaEditar.quantidade,
        fornecedor_id: dispositivoParaEditar.fornecedor_id || "none",
        custo: dispositivoParaEditar.custo,
        preco: dispositivoParaEditar.preco,
        foto_url: dispositivoParaEditar.foto_url || "",
        fotos: dispositivoParaEditar.fotos || (dispositivoParaEditar.foto_url ? [dispositivoParaEditar.foto_url] : []),
        checklist: dispositivoParaEditar.checklist || { entrada: {}, saida: {} },
        codigo_barras: dispositivoParaEditar.codigo_barras || "",
      });
    } else {
      form.reset({
        tipo: "",
        marca: "",
        modelo: "",
        cor: "",
        capacidade_gb: undefined,
        imei: "",
        numero_serie: "",
        saude_bateria: undefined,
        garantia: false,
        tempo_garantia: undefined,
        subtipo_computador: "",
        condicao: "novo",
        quantidade: 1,
        fornecedor_id: "none",
        custo: undefined,
        preco: undefined,
        foto_url: "",
        fotos: [],
        checklist: { entrada: {}, saida: {} },
        codigo_barras: "",
      });
    }
  }, [dispositivoParaEditar, form]);

  useEffect(() => {
    if (!garantiaAtiva) {
      form.setValue("tempo_garantia", undefined);
    }
  }, [garantiaAtiva, form]);

  useEffect(() => {
    if (tipoSelecionado !== "Notebook/Computador") {
      form.setValue("subtipo_computador", "");
    }
  }, [tipoSelecionado, form]);

  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (dados: FormValues) => {
    if (salvando) return;
    setSalvando(true);
    try {
      const dadosDispositivo = {
        ...dados,
        fornecedor_id: dados.fornecedor_id === "none" ? null : dados.fornecedor_id,
        fotos: (dados.fotos || []).filter(Boolean),
        codigo_barras: dados.codigo_barras || null,
      } as FormularioDispositivo;

      await onSubmit(dadosDispositivo);
      form.reset();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {dispositivoParaEditar ? "Editar Dispositivo" : "Cadastrar Novo Dispositivo"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit, (errors) => {
            console.error("Erros de validação do formulário:", errors);
            const firstError = Object.values(errors)[0];
            const message = firstError?.message || "Verifique os campos obrigatórios";
            toast.error(`Erro no formulário: ${message}`);
          })} className="space-y-6">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Informações Básicas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIPOS_DISPOSITIVO.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {tipo}
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
                  name="marca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Apple" {...field} />
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
                      <FormLabel>Modelo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: iPhone 14 Pro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Preto" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="capacidade_gb"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacidade (GB)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Ex: 256"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {tipoSelecionado === "Notebook/Computador" && (
                  <FormField
                    control={form.control}
                    name="subtipo_computador"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Computador</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SUBTIPOS_COMPUTADOR.map((subtipo) => (
                              <SelectItem key={subtipo} value={subtipo}>
                                {subtipo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* Condição */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Condição</h3>
              <FormField
                control={form.control}
                name="condicao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado do Dispositivo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a condição" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONDICOES_DISPOSITIVO.map((condicao) => (
                          <SelectItem key={condicao.value} value={condicao.value}>
                            {condicao.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

              {/* Fotos */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Fotos</h3>
                <UploadFotosDispositivo
                  fotos={form.watch("fotos") || []}
                  onFotosChange={(urls) => {
                    form.setValue("fotos", urls);
                    form.setValue("foto_url", urls[0] || "");
                  }}
                  maxFotos={10}
                />
              </div>

            {/* Identificação */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Identificação</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <FormField
                    control={form.control}
                    name="imei"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>IMEI</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 123456789012345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    className="whitespace-nowrap"
                    onClick={() => window.open("https://www.gov.br/anatel/pt-br/assuntos/celular-legal/consulte-sua-situacao", "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Verificar IMEI
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <FormField
                    control={form.control}
                    name="numero_serie"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Número de Série</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: ABC123XYZ" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap w-full sm:w-auto"
                    onClick={() => window.open("https://checkcoverage.apple.com/", "_blank")}
                  >
                    <Shield className="h-3 w-3 mr-1.5" />
                    Verificar Garantia Apple
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="saude_bateria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Saúde da Bateria (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Ex: 85"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="codigo_barras"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código de Barras</FormLabel>
                      <FormControl>
                        <LeitorCodigoBarras
                          valor={field.value || ""}
                          onChange={(v) => {
                            // Garante que o valor fique “commitado” no react-hook-form
                            form.setValue("codigo_barras", v, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                          }}
                          onCodigoLido={(codigo) => {
                            // No mobile, alguns flows do scanner não disparam blur/change do input;
                            // então forçamos o setValue para o submit pegar o valor correto.
                            form.setValue("codigo_barras", codigo, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                          }}
                          placeholder="Escaneie ou digite o código"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="garantia"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Garantia</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {garantiaAtiva && (
                <FormField
                  control={form.control}
                  name="tempo_garantia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tempo de Garantia (meses) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Ex: 12"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Checklist */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Checklist de Verificação</h3>
              <ChecklistDispositivo
                tipoDispositivo={form.watch("tipo")}
                fabricante={form.watch("subtipo_computador")?.toLowerCase()}
                value={{
                  entrada: form.watch("checklist")?.entrada || {},
                  saida: form.watch("checklist")?.saida || {}
                }}
                onChange={(checklist) => form.setValue("checklist", checklist)}
              />
            </div>

            {/* Fornecedor */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Fornecedor</h3>
              <FormField
                control={form.control}
                name="fornecedor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o fornecedor" />
                        </SelectTrigger>
                      </FormControl>
                       <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {fornecedores
                          .filter(f => f.ativo)
                          .map((fornecedor) => (
                            <SelectItem key={fornecedor.id} value={fornecedor.id}>
                              {fornecedor.nome}
                              {fornecedor.nome_fantasia && ` (${fornecedor.nome_fantasia})`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Valores */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Estoque e Valores</h3>
              
              <FormField
                control={form.control}
                name="quantidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade em Estoque *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1" 
                        placeholder="Ex: 5" 
                        {...field}
                        value={field.value !== undefined && field.value !== null ? field.value : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === "" ? undefined : Number(val));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {podeVerCustos ? (
                  <FormField
                    control={form.control}
                    name="custo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custo</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground pt-6">
                    <Lock className="h-4 w-4" />
                    <span className="text-sm">Custo oculto</span>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="preco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço de Venda</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {podeVerLucros && (
                <div className="rounded-lg border p-4 bg-muted">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Lucro:</span>
                    <span
                      className={`text-lg font-bold ${
                        lucro > 0
                          ? "text-green-600"
                          : lucro < 0
                          ? "text-red-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      R$ {lucro.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
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
              <Button type="submit" className="w-full sm:w-auto" disabled={salvando}>
                {salvando ? "Salvando..." : (dispositivoParaEditar ? "Atualizar" : "Cadastrar")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

    </Dialog>
  );
}
