import { useEffect, useId, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Check } from "lucide-react";
import { Cliente } from "@/types/cliente";
import { Servico } from "@/types/servico";
import { Checklist, AvariasOS } from "@/types/ordem-servico";
import { encryptSenhaDesbloqueio } from "@/lib/password-encryption";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useEmpresaInfo, useResolvedUserId } from "@/hooks/useResolvedUserId";
import { useTaxasCartao } from "@/hooks/useTaxasCartao";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useEventDispatcher } from "@/hooks/useEventDispatcher";
import { ChecklistDispositivo } from "./ChecklistDispositivo";
import { SelecionadorServico } from "./SelecionadorServico";
import { ResumoFinanceiro } from "./ResumoFinanceiro";
import { resolverIdentidadeOS } from "@/lib/ordemServico/resolverIdentidadeOS";
import { criarOuAtualizarCliente } from "@/lib/ordemServico/criarOuAtualizarCliente";
import { gerarNumeroOSComRetry } from "@/lib/ordemServico/gerarNumeroOSComRetry";
import { criarContaAReceberOS } from "@/lib/ordemServico/criarContaAReceberOS";

interface DialogOrdemServicoSimplificadaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormDataSimplificada {
  clienteNome: string;
  clienteTelefone: string;
  clienteCPF: string;
  origemCliente: string;
  tipoMidia: string;
  dispositivoTipo: string;
  dispositivoMarca: string;
  dispositivoModelo: string;
  dispositivoCor: string;
  dispositivoNumeroSerie: string;
  dispositivoIMEI: string;
  dispositivoSistema: string;
  dispositivoFabricante: string;
  dispositivoSubtipo: string;
  senhaDesbloqueio: string;
  senhaNaoInformada: boolean;
  defeitoRelatado: string;
  observacoesInternas: string;
  checklistEntrada: Record<string, boolean>;
  servicos: Servico[];
  formaPagamento: string;
  desconto: number;
  valorEntrada: number;
  mostrarEntrada: boolean;
}

const formDataInicial: FormDataSimplificada = {
  clienteNome: "",
  clienteTelefone: "",
  clienteCPF: "",
  origemCliente: "",
  tipoMidia: "",
  dispositivoTipo: "",
  dispositivoMarca: "",
  dispositivoModelo: "",
  dispositivoCor: "",
  dispositivoNumeroSerie: "",
  dispositivoIMEI: "",
  dispositivoSistema: "",
  dispositivoFabricante: "",
  dispositivoSubtipo: "",
  senhaDesbloqueio: "",
  senhaNaoInformada: false,
  defeitoRelatado: "",
  observacoesInternas: "",
  checklistEntrada: {},
  servicos: [],
  formaPagamento: "",
  desconto: 0,
  valorEntrada: 0,
  mostrarEntrada: false,
};

export const DialogOrdemServicoSimplificada = ({
  open,
  onOpenChange,
  onSuccess,
}: DialogOrdemServicoSimplificadaProps) => {
  // Sufixo único por montagem — evita que o navegador ofereça sugestões de
  // autofill de digitações antigas (autocomplete="off" sozinho é ignorado
  // por vários navegadores/Android para esse tipo de campo)
  const instanceId = useId();
  const { toast } = useToast();
  const { trackOSCriada } = useEventTracking();
  const { dispatchEvent } = useEventDispatcher();
  const { isFuncionario, lojaUserId, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const { empresaAtiva: empresaAtivaCtx, isProprietario } = useEmpresa();
  const { empresaId: empresaInfoId, isFilial: isFilialCtx } = useEmpresaInfo();
  const resolvedUserIdFromContext = useResolvedUserId();
  const { taxasAtivas, calcularTaxa } = useTaxasCartao();
  const [bandeiraSelecionada, setBandeiraSelecionada] = useState("");

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormDataSimplificada>(formDataInicial);

  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const buscaClienteSeqRef = useRef(0);
  const [mostrarSugestoesNome, setMostrarSugestoesNome] = useState(false);
  const [mostrarSugestoesCPF, setMostrarSugestoesCPF] = useState(false);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(null);
  const nomeInputRef = useRef<HTMLDivElement>(null);
  const cpfInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setFormData(formDataInicial);
    setClienteSelecionadoId(null);
    setBandeiraSelecionada("");
  }, [open]);

  // Buscar clientes por termo — consulta o banco diretamente a cada busca
  // (em vez de pré-carregar todos os clientes e filtrar em memória, o que
  // dependia de um array carregado uma única vez ao abrir o dialog)
  const buscarClientes = async (termo: string, campo: "nome" | "cpf") => {
    if (termo.length < 2) {
      setClientesFiltrados([]);
      setMostrarSugestoesNome(false);
      setMostrarSugestoesCPF(false);
      return;
    }

    // Ainda não sabemos se é funcionário/gerente de filial — evita buscar
    // com identidade provisória
    if (carregandoPermissoes) return;

    const minhaSeq = ++buscaClienteSeqRef.current;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const userId = resolvedUserIdFromContext
      ?? ((isFuncionario && lojaUserId) ? lojaUserId : user.id);

    let query = supabase
      .from("clientes")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (isFilialCtx && empresaInfoId) {
      query = query.eq("empresa_id", empresaInfoId);
    }

    if (campo === "nome") {
      query = query.ilike("nome", `%${termo}%`).order("nome").limit(8);
    } else {
      const digitos = termo.replace(/\D/g, "");
      if (!digitos) {
        setClientesFiltrados([]);
        setMostrarSugestoesCPF(false);
        return;
      }
      query = query.ilike("cpf", `%${digitos}%`).order("nome").limit(8);
    }

    const { data, error } = await query;

    // Ignora resultado se já veio uma busca mais recente
    if (minhaSeq !== buscaClienteSeqRef.current) return;

    if (error) {
      console.error("[OS Simplificada] Erro ao buscar clientes:", error, { userId, campo, termo, isFilialCtx, empresaInfoId });
      toast({
        title: "Não foi possível buscar clientes",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const termoLower = termo.toLowerCase();
    // Nomes que começam com o termo digitado vêm primeiro — evita que um
    // match no meio do nome fique acima de nomes mais relevantes
    const resultado = campo === "nome"
      ? [...(data || [])].sort((a, b) => {
          const aComeca = a.nome.toLowerCase().startsWith(termoLower);
          const bComeca = b.nome.toLowerCase().startsWith(termoLower);
          if (aComeca && !bComeca) return -1;
          if (!aComeca && bComeca) return 1;
          return 0;
        })
      : (data || []);

    setClientesFiltrados(resultado);
    if (campo === "nome") {
      setMostrarSugestoesNome(resultado.length > 0);
    } else {
      setMostrarSugestoesCPF(resultado.length > 0);
    }
  };

  const selecionarCliente = (cliente: Cliente) => {
    setFormData((prev) => ({
      ...prev,
      clienteNome: cliente.nome,
      clienteTelefone: cliente.telefone || "",
      clienteCPF: cliente.cpf || "",
    }));
    setClienteSelecionadoId(cliente.id);
    setMostrarSugestoesNome(false);
    setMostrarSugestoesCPF(false);
  };

  const handleClienteNomeChange = (valor: string) => {
    setFormData((prev) => ({ ...prev, clienteNome: valor }));
    setClienteSelecionadoId(null);
    buscarClientes(valor, "nome");
  };

  const handleClienteCPFChange = (valor: string) => {
    setFormData((prev) => ({ ...prev, clienteCPF: valor }));
    setClienteSelecionadoId(null);
    buscarClientes(valor, "cpf");
  };

  const totalServicos = formData.servicos.reduce((sum, s) => sum + s.preco, 0);
  const total = Math.max(0, totalServicos - formData.desconto);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { effectiveUserId, empresaId } = await resolverIdentidadeOS(
        user.id,
        isProprietario,
        empresaAtivaCtx
      );

      const clienteId = await criarOuAtualizarCliente(
        effectiveUserId,
        {
          nome: formData.clienteNome,
          telefone: formData.clienteTelefone,
          cpf: formData.clienteCPF,
          endereco: "",
          dataNascimento: "",
        },
        clienteSelecionadoId,
        null
      );

      const avariasData: AvariasOS = {
        checklist: { entrada: formData.checklistEntrada, saida: {} } as Checklist,
        senha_desbloqueio: encryptSenhaDesbloqueio(
          formData.senhaNaoInformada
            ? { tipo: "letra", valor: "", nao_informada: true }
            : formData.senhaDesbloqueio
            ? { tipo: "letra", valor: formData.senhaDesbloqueio }
            : undefined
        ),
        servicos_realizados: formData.servicos.map((s) => {
          const custo = Number(s.custo || 0);
          const preco = Number(s.preco || 0);
          return { id: s.id, nome: s.nome, preco, custo, lucro: preco - custo };
        }),
        observacoes_internas: formData.observacoesInternas || undefined,
      };

      if (totalServicos > 0 || formData.formaPagamento || formData.desconto > 0) {
        avariasData.dados_pagamento = {
          forma: (formData.formaPagamento as any) || undefined,
          desconto: formData.desconto,
          subtotal: totalServicos,
          total,
          entrada: formData.mostrarEntrada ? formData.valorEntrada : 0,
          saldo: formData.mostrarEntrada ? Math.max(0, total - formData.valorEntrada) : total,
        };
      }

      const primeiroServicoCatalogo = formData.servicos.find((s) => !s.id.startsWith("manual_"));
      const primeiroServicoId = primeiroServicoCatalogo?.id || null;

      const numeroOS = await gerarNumeroOSComRetry(effectiveUserId, (numero) =>
        supabase.from("ordens_servico").insert([{
          numero_os: numero,
          cliente_id: clienteId,
          user_id: effectiveUserId,
          tipo_os: "simplificada",
          dispositivo_tipo: formData.dispositivoTipo,
          dispositivo_marca: formData.dispositivoMarca,
          dispositivo_modelo: formData.dispositivoModelo,
          dispositivo_cor: formData.dispositivoCor,
          dispositivo_numero_serie: formData.dispositivoNumeroSerie,
          dispositivo_imei: formData.dispositivoIMEI,
          defeito_relatado: formData.defeitoRelatado,
          avarias: avariasData as any,
          total: total > 0 ? total : null,
          forma_pagamento: (formData.formaPagamento as any) || null,
          servico_id: primeiroServicoId,
          status: "aguardando_aprovacao",
          empresa_id: empresaId,
          origem_cliente: formData.origemCliente || null,
          tipo_midia: formData.tipoMidia || null,
        }])
      );

      if (total > 0) {
        const entradaPaga = formData.mostrarEntrada ? formData.valorEntrada : 0;
        await criarContaAReceberOS({
          numeroOS,
          clienteNome: formData.clienteNome,
          defeitoRelatado: formData.defeitoRelatado,
          total,
          entradaPaga,
          effectiveUserId,
        });
      }

      if (bandeiraSelecionada && bandeiraSelecionada !== "nenhuma" && total > 0) {
        const taxaSel = taxasAtivas.find((t) => t.id === bandeiraSelecionada);
        if (taxaSel) {
          const { percentual, valor: valorTaxa } = calcularTaxa(taxaSel, formData.formaPagamento, undefined, total);
          if (valorTaxa > 0) {
            await supabase.from("contas").insert({
              nome: `Taxa Cartão ${taxaSel.bandeira} - OS ${numeroOS}`,
              tipo: "pagar" as const,
              valor: valorTaxa,
              data: new Date().toISOString().split("T")[0],
              status: "pago" as const,
              recorrente: false,
              categoria: "Taxa de Cartão",
              descricao: `Taxa ${percentual}% da bandeira ${taxaSel.bandeira} sobre OS ${numeroOS}`,
              os_numero: numeroOS,
              user_id: effectiveUserId,
            });
          }
        }
      }

      trackOSCriada(numeroOS, !!clienteId, !!formData.dispositivoModelo);

      toast({
        title: "Ordem criada",
        description: `Ordem de serviço simplificada ${numeroOS} criada com sucesso.`,
      });

      window.dispatchEvent(new Event("os-salva"));
      dispatchEvent("SERVICE_ORDER_CREATED", {
        numero_os: numeroOS,
        clienteNome: formData.clienteNome,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar ordem simplificada:", error);

      let mensagemErro = "Não foi possível salvar a ordem de serviço.";
      if (error?.code === "23505") {
        mensagemErro = "Número da ordem de serviço já existe. Tente novamente.";
      } else if (error?.message?.includes("JWT")) {
        mensagemErro = "Sua sessão expirou. Por favor, faça login novamente.";
      } else if (error?.message) {
        mensagemErro = error.message;
      }

      toast({
        title: "Erro ao salvar ordem",
        description: mensagemErro,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl pb-20 sm:pb-6">
        <DialogHeader>
          <DialogTitle className="text-lg">Nova Ordem de Serviço Simplificada</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 overflow-x-hidden">
          {/* Origem do Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Origem do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="origemCliente">Canal de origem</Label>
                <Select
                  value={formData.origemCliente}
                  onValueChange={(v) => setFormData({ ...formData, origemCliente: v })}
                >
                  <SelectTrigger id="origemCliente">
                    <SelectValue placeholder="Selecionar canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tipoMidia">Tipo de mídia</Label>
                <Select
                  value={formData.tipoMidia}
                  onValueChange={(v) => setFormData({ ...formData, tipoMidia: v })}
                >
                  <SelectTrigger id="tipoMidia">
                    <SelectValue placeholder="Selecionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anuncio">Anúncio (pago)</SelectItem>
                    <SelectItem value="organico">Orgânico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Dados do Cliente */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Dados do Cliente</CardTitle>
              {clienteSelecionadoId && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Cliente existente
                </Badge>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2 relative" ref={nomeInputRef}>
                <Label htmlFor="clienteNome">Nome *</Label>
                <Input
                  id="clienteNome"
                  name={`clienteNome-${instanceId}`}
                  value={formData.clienteNome}
                  onChange={(e) => handleClienteNomeChange(e.target.value)}
                  onFocus={() => formData.clienteNome.length >= 2 && buscarClientes(formData.clienteNome, "nome")}
                  onBlur={() => setTimeout(() => setMostrarSugestoesNome(false), 200)}
                  autoComplete="off"
                  required
                />
                {mostrarSugestoesNome && clientesFiltrados.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
                    {clientesFiltrados.map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                        onClick={() => selecionarCliente(cliente)}
                      >
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{cliente.nome}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {cliente.cpf && `CPF: ${cliente.cpf}`}
                            {cliente.cpf && cliente.telefone && " • "}
                            {cliente.telefone && `Tel: ${cliente.telefone}`}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="clienteTelefone">Telefone</Label>
                <Input
                  id="clienteTelefone"
                  value={formData.clienteTelefone}
                  onChange={(e) => setFormData({ ...formData, clienteTelefone: e.target.value })}
                />
              </div>
              <div className="relative" ref={cpfInputRef}>
                <Label htmlFor="clienteCPF">CPF / CNPJ</Label>
                <Input
                  id="clienteCPF"
                  name={`clienteCPF-${instanceId}`}
                  value={formData.clienteCPF}
                  onChange={(e) => handleClienteCPFChange(e.target.value)}
                  onFocus={() => formData.clienteCPF.length >= 2 && buscarClientes(formData.clienteCPF, "cpf")}
                  onBlur={() => setTimeout(() => setMostrarSugestoesCPF(false), 200)}
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  maxLength={18}
                />
                {mostrarSugestoesCPF && clientesFiltrados.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
                    {clientesFiltrados.map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
                        onClick={() => selecionarCliente(cliente)}
                      >
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{cliente.nome}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {cliente.cpf && `${cliente.cpf.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"}: ${cliente.cpf}`}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dados do Dispositivo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados do Dispositivo</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dispositivoTipo">Tipo *</Label>
                <Select
                  value={formData.dispositivoTipo}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      dispositivoTipo: value,
                      dispositivoSistema: "",
                      dispositivoFabricante: "",
                      dispositivoSubtipo: "",
                      checklistEntrada: {},
                    })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Celular">Celular</SelectItem>
                    <SelectItem value="Tablet">Tablet</SelectItem>
                    <SelectItem value="Notebook">Notebook</SelectItem>
                    <SelectItem value="Computador">Computador</SelectItem>
                    <SelectItem value="Relogio_Smart">Relógio Smart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dispositivoMarca">Marca *</Label>
                <Input
                  id="dispositivoMarca"
                  value={formData.dispositivoMarca}
                  onChange={(e) => setFormData({ ...formData, dispositivoMarca: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dispositivoModelo">Modelo *</Label>
                <Input
                  id="dispositivoModelo"
                  value={formData.dispositivoModelo}
                  onChange={(e) => setFormData({ ...formData, dispositivoModelo: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dispositivoCor">Cor</Label>
                <Input
                  id="dispositivoCor"
                  value={formData.dispositivoCor}
                  onChange={(e) => setFormData({ ...formData, dispositivoCor: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dispositivoNumeroSerie">Número de Série</Label>
                <Input
                  id="dispositivoNumeroSerie"
                  value={formData.dispositivoNumeroSerie}
                  onChange={(e) => setFormData({ ...formData, dispositivoNumeroSerie: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dispositivoIMEI">IMEI</Label>
                <Input
                  id="dispositivoIMEI"
                  value={formData.dispositivoIMEI}
                  onChange={(e) => setFormData({ ...formData, dispositivoIMEI: e.target.value })}
                />
              </div>
              <div className="col-span-1 sm:col-span-2 space-y-2">
                <Label htmlFor="senhaDesbloqueio">Senha de Desbloqueio</Label>
                <Input
                  id="senhaDesbloqueio"
                  placeholder="Ex: 1234 ou abc123"
                  value={formData.senhaDesbloqueio}
                  onChange={(e) => setFormData({ ...formData, senhaDesbloqueio: e.target.value })}
                  disabled={formData.senhaNaoInformada}
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="senhaNaoInformada"
                    checked={formData.senhaNaoInformada}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        senhaNaoInformada: checked === true,
                        senhaDesbloqueio: checked === true ? "" : formData.senhaDesbloqueio,
                      })
                    }
                  />
                  <Label htmlFor="senhaNaoInformada" className="font-normal cursor-pointer">
                    Cliente não quis passar a senha
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Defeito Relatado + Observações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações do Serviço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="defeitoRelatado">Defeito Relatado *</Label>
                <Textarea
                  id="defeitoRelatado"
                  value={formData.defeitoRelatado}
                  onChange={(e) => setFormData({ ...formData, defeitoRelatado: e.target.value })}
                  required
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="observacoesInternas">Observações</Label>
                <Textarea
                  id="observacoesInternas"
                  value={formData.observacoesInternas}
                  onChange={(e) => setFormData({ ...formData, observacoesInternas: e.target.value })}
                  rows={2}
                  placeholder="Anotações sobre o atendimento"
                />
              </div>
            </CardContent>
          </Card>

          {/* Checklist de Entrada */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Checklist de Entrada</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ChecklistDispositivo
                tipoDispositivo={formData.dispositivoTipo}
                sistema={formData.dispositivoSistema}
                fabricante={formData.dispositivoFabricante}
                subtipo={formData.dispositivoSubtipo}
                value={{ entrada: formData.checklistEntrada, saida: {} }}
                onChange={(checklist) => setFormData({ ...formData, checklistEntrada: checklist.entrada })}
                onSistemaChange={(sistema) => setFormData({ ...formData, dispositivoSistema: sistema })}
                onFabricanteChange={(fabricante) => setFormData({ ...formData, dispositivoFabricante: fabricante })}
                onSubtipoChange={(subtipo) => setFormData({ ...formData, dispositivoSubtipo: subtipo })}
                apenasEntrada
              />
            </CardContent>
          </Card>

          {/* Serviços */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Serviços</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <SelecionadorServico
                value={formData.servicos}
                onChange={(servicos) => setFormData({ ...formData, servicos })}
              />
            </CardContent>
          </Card>

          {/* Resumo Financeiro */}
          <ResumoFinanceiro
            servicos={formData.servicos}
            formaPagamento={formData.formaPagamento}
            onFormaPagamentoChange={(forma) => setFormData({ ...formData, formaPagamento: forma })}
            desconto={formData.desconto}
            onDescontoChange={(desconto) => setFormData({ ...formData, desconto })}
            valorEntrada={formData.valorEntrada}
            onValorEntradaChange={(valor) => setFormData({ ...formData, valorEntrada: valor })}
            mostrarEntrada={formData.mostrarEntrada}
            onMostrarEntradaChange={(mostrar) => setFormData({ ...formData, mostrarEntrada: mostrar })}
            taxasAtivas={taxasAtivas}
            bandeiraSelecionada={bandeiraSelecionada}
            onBandeiraChange={setBandeiraSelecionada}
            taxaCalculada={(() => {
              const taxaSel = taxasAtivas.find((t) => t.id === bandeiraSelecionada);
              if (!taxaSel) return { percentual: 0, valor: 0 };
              return calcularTaxa(taxaSel, formData.formaPagamento, undefined, total);
            })()}
          />

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 pb-safe">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Criar Ordem"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
