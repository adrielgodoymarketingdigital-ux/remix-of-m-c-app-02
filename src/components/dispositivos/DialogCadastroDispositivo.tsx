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
import { ExternalLink, Shield, Lock, ChevronDown, ChevronRight } from "lucide-react";
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

interface CamposUnidade {
  cor: string;
  capacidade_gb: string;
  subtipo_computador: string;
  condicao: 'novo' | 'semi_novo' | 'usado';
  imei: string;
  numero_serie: string;
  saude_bateria: string;
  codigo_barras: string;
  custo: string;
  preco: string;
  fotos: string[];
  foto_url: string;
  checklist: { entrada?: Record<string, boolean>; saida?: Record<string, boolean> };
  fornecedor_id: string;
}

const unidadeVazia = (): CamposUnidade => ({
  cor: "",
  capacidade_gb: "",
  subtipo_computador: "",
  condicao: "novo",
  imei: "",
  numero_serie: "",
  saude_bateria: "",
  codigo_barras: "",
  custo: "",
  preco: "",
  fotos: [],
  foto_url: "",
  checklist: { entrada: {}, saida: {} },
  fornecedor_id: "none",
});

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

  // Unidades individuais (para quantidade > 1)
  const [unidades, setUnidades] = useState<CamposUnidade[]>([unidadeVazia()]);
  const [unidadeAberta, setUnidadeAberta] = useState<number>(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: "",
      marca: "",
      modelo: "",
      garantia: false,
      tempo_garantia: undefined,
      subtipo_computador: "",
      quantidade: 1,
      fornecedor_id: "none",
      foto_url: "",
      fotos: [],
      checklist: { entrada: {}, saida: {} },
      // campos herdados para compatibilidade (usados só quando quantidade=1)
      cor: "",
      capacidade_gb: undefined,
      imei: "",
      numero_serie: "",
      saude_bateria: undefined,
      condicao: "novo",
      custo: undefined,
      preco: undefined,
      codigo_barras: "",
    },
  });

  const garantiaAtiva = form.watch("garantia");
  const tipoSelecionado = form.watch("tipo");
  const quantidadeAtual = form.watch("quantidade") || 1;
  const modoMultiplo = quantidadeAtual > 1;

  // Lucro só no modo simples (quantidade=1)
  const custoSimples = Number(form.watch("custo")) || 0;
  const precoSimples = Number(form.watch("preco")) || 0;
  const lucroSimples = precoSimples - custoSimples;

  // Sincroniza lista de unidades com a quantidade
  useEffect(() => {
    const qtd = Math.max(1, quantidadeAtual || 1);
    setUnidades((prev) => {
      if (prev.length === qtd) return prev;
      if (qtd > prev.length) {
        return [...prev, ...Array.from({ length: qtd - prev.length }, unidadeVazia)];
      }
      return prev.slice(0, qtd);
    });
  }, [quantidadeAtual]);

  useEffect(() => {
    if (dispositivoParaEditar) {
      form.reset({
        tipo: dispositivoParaEditar.tipo,
        marca: dispositivoParaEditar.marca,
        modelo: dispositivoParaEditar.modelo,
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
        cor: dispositivoParaEditar.cor || "",
        capacidade_gb: dispositivoParaEditar.capacidade_gb,
        imei: dispositivoParaEditar.imei || "",
        numero_serie: dispositivoParaEditar.numero_serie || "",
        saude_bateria: dispositivoParaEditar.saude_bateria,
        codigo_barras: dispositivoParaEditar.codigo_barras || "",
      });
      setUnidades([{
        cor: dispositivoParaEditar.cor || "",
        capacidade_gb: dispositivoParaEditar.capacidade_gb?.toString() || "",
        subtipo_computador: dispositivoParaEditar.subtipo_computador || "",
        condicao: dispositivoParaEditar.condicao,
        imei: dispositivoParaEditar.imei || "",
        numero_serie: dispositivoParaEditar.numero_serie || "",
        saude_bateria: dispositivoParaEditar.saude_bateria?.toString() || "",
        codigo_barras: dispositivoParaEditar.codigo_barras || "",
        custo: dispositivoParaEditar.custo?.toString() || "",
        preco: dispositivoParaEditar.preco?.toString() || "",
      }]);
    } else {
      form.reset({
        tipo: "",
        marca: "",
        modelo: "",
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
        cor: "",
        capacidade_gb: undefined,
        imei: "",
        numero_serie: "",
        saude_bateria: undefined,
        codigo_barras: "",
      });
      setUnidades([unidadeVazia()]);
      setUnidadeAberta(0);
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

  const atualizarUnidade = (idx: number, campo: keyof CamposUnidade, valor: string) => {
    setUnidades((prev) => prev.map((u, i) => i === idx ? { ...u, [campo]: valor } : u));
  };

  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (dados: FormValues) => {
    if (salvando) return;
    setSalvando(true);
    try {
      const base = {
        tipo: dados.tipo,
        marca: dados.marca,
        modelo: dados.modelo,
        garantia: dados.garantia,
        tempo_garantia: dados.tempo_garantia,
        fornecedor_id: dados.fornecedor_id === "none" ? null : (dados.fornecedor_id || null),
        fotos: (dados.fotos || []).filter(Boolean),
        foto_url: dados.foto_url || null,
        checklist: dados.checklist,
        codigo_barras: null as string | null,
      };

      if (!modoMultiplo) {
        // Modo simples — 1 unidade, todos os campos do form principal
        await onSubmit({
          ...base,
          cor: dados.cor,
          capacidade_gb: dados.capacidade_gb,
          subtipo_computador: dados.subtipo_computador,
          condicao: dados.condicao,
          imei: dados.imei || "",
          numero_serie: dados.numero_serie,
          saude_bateria: dados.saude_bateria,
          codigo_barras: dados.codigo_barras || null,
          custo: dados.custo,
          preco: dados.preco,
          quantidade: 1,
          imeis: dados.imei ? [dados.imei] : [],
        } as FormularioDispositivo);
      } else {
        // Modo múltiplo — uma chamada por unidade com todos os campos individuais
        for (const unidade of unidades) {
          await onSubmit({
            tipo: dados.tipo,
            marca: dados.marca,
            modelo: dados.modelo,
            garantia: dados.garantia,
            tempo_garantia: dados.tempo_garantia,
            fornecedor_id: unidade.fornecedor_id === "none" ? null : (unidade.fornecedor_id || null),
            fotos: unidade.fotos.filter(Boolean),
            foto_url: unidade.fotos[0] || null,
            checklist: unidade.checklist,
            cor: unidade.cor || undefined,
            capacidade_gb: unidade.capacidade_gb ? Number(unidade.capacidade_gb) : undefined,
            subtipo_computador: unidade.subtipo_computador || undefined,
            condicao: unidade.condicao,
            imei: unidade.imei || "",
            numero_serie: unidade.numero_serie || undefined,
            saude_bateria: unidade.saude_bateria ? Number(unidade.saude_bateria) : undefined,
            codigo_barras: unidade.codigo_barras || null,
            custo: unidade.custo ? Number(unidade.custo) : undefined,
            preco: unidade.preco ? Number(unidade.preco) : undefined,
            quantidade: 1,
            imeis: unidade.imei ? [unidade.imei] : [],
          } as FormularioDispositivo);
        }
      }

      form.reset();
      setUnidades([unidadeVazia()]);
      setUnidadeAberta(0);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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

            {/* ── Campos compartilhados ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Informações Básicas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Quantidade — primeiro campo */}
                <FormField
                  control={form.control}
                  name="quantidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade *</FormLabel>
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
                            <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
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
              </div>
            </div>

            {/* ── Modo múltiplo: accordion de unidades ── */}
            {modoMultiplo ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Unidades ({unidades.length})</h3>
                {unidades.map((unidade, idx) => (
                  <div key={idx} className="border rounded-lg overflow-hidden">
                    {/* Cabeçalho collapsible */}
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                      onClick={() => setUnidadeAberta(unidadeAberta === idx ? -1 : idx)}
                    >
                      <span className="flex items-center gap-2">
                        <span>Unidade {idx + 1}</span>
                        {unidade.imei && (
                          <span className="text-xs text-muted-foreground font-normal">
                            IMEI: {unidade.imei}
                          </span>
                        )}
                        {unidade.cor && (
                          <span className="text-xs text-muted-foreground font-normal">
                            · {unidade.cor}
                          </span>
                        )}
                      </span>
                      {unidadeAberta === idx
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      }
                    </button>

                    {/* Conteúdo expandido */}
                    {unidadeAberta === idx && (
                      <div className="px-4 pb-4 pt-2 space-y-4 border-t bg-muted/20">

                        {/* Identificação */}
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identificação</p>
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                            <div className="flex-1 space-y-1">
                              <label className="text-sm font-medium">IMEI</label>
                              <Input
                                placeholder="Ex: 123456789012345"
                                value={unidade.imei}
                                onChange={(e) => atualizarUnidade(idx, "imei", e.target.value)}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="whitespace-nowrap"
                              onClick={() => window.open("https://www.gov.br/anatel/pt-br/assuntos/celular-legal/consulte-sua-situacao", "_blank")}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Verificar IMEI
                            </Button>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                            <div className="flex-1 space-y-1">
                              <label className="text-sm font-medium">Número de Série</label>
                              <Input
                                placeholder="Ex: ABC123XYZ"
                                value={unidade.numero_serie}
                                onChange={(e) => atualizarUnidade(idx, "numero_serie", e.target.value)}
                              />
                            </div>
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

                          <div className="space-y-1">
                            <label className="text-sm font-medium">Código de Barras</label>
                            <LeitorCodigoBarras
                              valor={unidade.codigo_barras}
                              onChange={(v) => atualizarUnidade(idx, "codigo_barras", v)}
                              onCodigoLido={(v) => atualizarUnidade(idx, "codigo_barras", v)}
                              placeholder="Escaneie ou digite o código"
                            />
                          </div>
                        </div>

                        {/* Características físicas */}
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Características</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-sm font-medium">Cor</label>
                              <Input
                                placeholder="Ex: Preto"
                                value={unidade.cor}
                                onChange={(e) => atualizarUnidade(idx, "cor", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-sm font-medium">Capacidade (GB)</label>
                              <Input
                                type="number"
                                placeholder="Ex: 256"
                                value={unidade.capacidade_gb}
                                onChange={(e) => atualizarUnidade(idx, "capacidade_gb", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-sm font-medium">Saúde da Bateria (%)</label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="Ex: 85"
                                value={unidade.saude_bateria}
                                onChange={(e) => atualizarUnidade(idx, "saude_bateria", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-sm font-medium">Condição</label>
                              <Select
                                value={unidade.condicao}
                                onValueChange={(v) => atualizarUnidade(idx, "condicao", v as CamposUnidade["condicao"])}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CONDICOES_DISPOSITIVO.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {tipoSelecionado === "Notebook/Computador" && (
                              <div className="space-y-1 sm:col-span-2">
                                <label className="text-sm font-medium">Tipo de Computador</label>
                                <Select
                                  value={unidade.subtipo_computador}
                                  onValueChange={(v) => atualizarUnidade(idx, "subtipo_computador", v)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SUBTIPOS_COMPUTADOR.map((s) => (
                                      <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Valores */}
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valores</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {podeVerCustos ? (
                              <div className="space-y-1">
                                <label className="text-sm font-medium">Custo</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={unidade.custo}
                                  onChange={(e) => atualizarUnidade(idx, "custo", e.target.value)}
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-muted-foreground pt-6">
                                <Lock className="h-4 w-4" />
                                <span className="text-sm">Custo oculto</span>
                              </div>
                            )}
                            <div className="space-y-1">
                              <label className="text-sm font-medium">Preço de Venda</label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={unidade.preco}
                                onChange={(e) => atualizarUnidade(idx, "preco", e.target.value)}
                              />
                            </div>
                          </div>
                          {podeVerLucros && unidade.custo && unidade.preco && (
                            <div className="rounded-lg border p-3 bg-muted text-sm flex justify-between">
                              <span className="font-medium">Lucro:</span>
                              <span className={`font-bold ${
                                Number(unidade.preco) - Number(unidade.custo) > 0
                                  ? "text-green-600"
                                  : Number(unidade.preco) - Number(unidade.custo) < 0
                                  ? "text-red-600"
                                  : "text-muted-foreground"
                              }`}>
                                R$ {(Number(unidade.preco) - Number(unidade.custo)).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Fotos */}
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fotos</p>
                          <UploadFotosDispositivo
                            fotos={unidade.fotos}
                            onFotosChange={(urls) => {
                              setUnidades((prev) => prev.map((u, i) =>
                                i === idx ? { ...u, fotos: urls, foto_url: urls[0] || "" } : u
                              ));
                            }}
                            maxFotos={10}
                          />
                        </div>

                        {/* Checklist */}
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Checklist</p>
                          <ChecklistDispositivo
                            tipoDispositivo={tipoSelecionado}
                            fabricante={unidade.subtipo_computador?.toLowerCase()}
                            value={unidade.checklist}
                            onChange={(checklist) => {
                              setUnidades((prev) => prev.map((u, i) =>
                                i === idx ? { ...u, checklist } : u
                              ));
                            }}
                          />
                        </div>

                        {/* Fornecedor */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fornecedor</p>
                          <Select
                            value={unidade.fornecedor_id}
                            onValueChange={(v) => atualizarUnidade(idx, "fornecedor_id", v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o fornecedor" />
                            </SelectTrigger>
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
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* ── Modo simples: campos individuais inline ── */
              <>
                {/* Características */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Características</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cor</FormLabel>
                          <FormControl><Input placeholder="Ex: Preto" {...field} /></FormControl>
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
                            <Input type="number" placeholder="Ex: 256" {...field} value={field.value || ""} />
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
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {SUBTIPOS_COMPUTADOR.map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
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
                            <SelectTrigger><SelectValue placeholder="Selecione a condição" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CONDICOES_DISPOSITIVO.map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
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
                              onChange={(v) => form.setValue("codigo_barras", v, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
                              onCodigoLido={(v) => form.setValue("codigo_barras", v, { shouldDirty: true, shouldTouch: true, shouldValidate: true })}
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
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
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
                            <Input type="number" min="1" placeholder="Ex: 12" {...field} value={field.value || ""} />
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
                            <SelectTrigger><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger>
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
                  <h3 className="text-sm font-semibold">Valores</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {podeVerCustos ? (
                      <FormField
                        control={form.control}
                        name="custo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custo</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value || ""} />
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
                            <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value || ""} />
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
                        <span className={`text-lg font-bold ${
                          lucroSimples > 0 ? "text-green-600" : lucroSimples < 0 ? "text-red-600" : "text-muted-foreground"
                        }`}>
                          R$ {lucroSimples.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Garantia — compartilhada em ambos os modos */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="garantia"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Garantia</FormLabel>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
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
                        <Input type="number" min="1" placeholder="Ex: 12" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                {salvando
                  ? "Salvando..."
                  : dispositivoParaEditar
                  ? "Atualizar"
                  : modoMultiplo
                  ? `Cadastrar ${unidades.length} unidades`
                  : "Cadastrar"
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
