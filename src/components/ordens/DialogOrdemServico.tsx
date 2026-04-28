import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useConfetti } from "@/hooks/useConfetti";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { useTiposServico } from "@/hooks/useTiposServico";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Check, Wrench, CalendarIcon, Plus, Search, Trash2 } from "lucide-react";
import { buscarCEP } from "@/lib/buscarCEP";
import { aplicarMascaraCEP, aplicarMascaraCPF, aplicarMascaraCNPJ, removerMascara } from "@/lib/mascaras";
import { Cliente } from "@/types/cliente";
import { Badge } from "@/components/ui/badge";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { SenhaDesbloqueio } from "./SenhaDesbloqueio";
import { ChecklistDispositivo } from "./ChecklistDispositivo";
import { MarcacaoAvarias } from "./MarcacaoAvarias";
import { SelecionadorServico } from "./SelecionadorServico";
import { SelecionadorProduto } from "./SelecionadorProduto";
import { ResumoFinanceiro } from "./ResumoFinanceiro";
import { AssinaturaDigital } from "./AssinaturaDigital";
import { UploadFotosOS } from "./UploadFotosOS";
import { Servico } from "@/types/servico";
import {
  SenhaDesbloqueio as SenhaDesbloqueioType, 
  Checklist, 
  AvariaVisual, 
  AvariasOS,
  ServicoRealizado,
  ProdutoUtilizado,
  CustoAdicional,
  AssinaturaDigital as AssinaturaDigitalType,
  TipoAssinatura
} from "@/types/ordem-servico";
import { encryptSenhaDesbloqueio, decryptSenhaDesbloqueio, encryptValue } from "@/lib/password-encryption";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useEventDispatcher } from "@/hooks/useEventDispatcher";
import { useTaxasCartao } from "@/hooks/useTaxasCartao";
import { formatCurrency } from "@/lib/formatters";

interface DialogOrdemServicoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico | null;
  onSuccess: () => void;
}

interface FormData {
  // Cliente
  clienteNome: string;
  clienteTelefone: string;
  clienteCPF: string;
  clienteEndereco: string;
  clienteBairro: string;
  clienteNumero: string;
  clienteCidade: string;
  clienteEstado: string;
  clienteCEP: string;
  clienteDataNascimento: string;
  // Dispositivo
  dispositivoTipo: string;
  dispositivoMarca: string;
  dispositivoModelo: string;
  dispositivoCor: string;
  dispositivoNumeroSerie: string;
  dispositivoIMEI: string;
  dispositivoSistema: string;
  dispositivoFabricante: string;
  dispositivoSubtipo: string;
  fotosDispositivo: string[];
  // Serviço
  defeitoRelatado: string;
  observacoesInternas: string;
  senhaDesbloqueio: SenhaDesbloqueioType;
  checklist: Checklist;
  avarias: AvariaVisual[];
  servicos: Servico[];
  produtos: ProdutoUtilizado[];
  custosAdicionais: CustoAdicional[];
  tempoGarantia: number | null;
  // Pagamento
  formaPagamento: string;
  numeroParcelas: number;
  desconto: number;
  valorEntrada: number;
  mostrarEntrada: boolean;
  total: number;
  entrada?: number;
  saldo?: number;
  status: string;
  assinaturaEntrada?: string;
  tipoAssinaturaEntrada?: TipoAssinatura;
  assinaturaSaida?: string;
  tipoAssinaturaSaida?: TipoAssinatura;
  dataVencimentoPrazo?: Date;
  semDataDefinida: boolean;
  dataEntrada: Date;
  dataSaida?: Date;
}

export const DialogOrdemServico = ({
  open,
  onOpenChange,
  ordem,
  onSuccess,
}: DialogOrdemServicoProps) => {
  const { toast } = useToast();
  const { trackOSCriada } = useEventTracking();
  const { disparar: dispararConfetti } = useConfetti();
  const { dispatchEvent } = useEventDispatcher();
  const { funcionarioId, lojaUserId, isFuncionario, podeSincronizarOS, permissoes, isDonoLoja } = useFuncionarioPermissoes();
  const navigate = useNavigate();
  const podeVerTecnicos = isDonoLoja || (permissoes?.recursos?.ver_tecnicos_os ?? false);
  const { funcionarios } = useFuncionarios();
  const { tiposServico, criar: criarTipoServico } = useTiposServico();
  const [loading, setLoading] = useState(false);
  const [tecnicoId, setTecnicoId] = useState<string | null>(null);
  const [tecnicosOS, setTecnicosOS] = useState<{ funcionario_id: string; descricao_servico: string }[]>([]);
  const [tipoServicoId, setTipoServicoId] = useState<string | null>(null);
  const [novoTipoServicoNome, setNovoTipoServicoNome] = useState("");
  const [criandoTipoServico, setCriandoTipoServico] = useState(false);
  const [bandeiraSelecionada, setBandeiraSelecionada] = useState("");
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const { taxasAtivas, calcularTaxa } = useTaxasCartao();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const [mostrarSugestoesNome, setMostrarSugestoesNome] = useState(false);
  const [mostrarSugestoesCPF, setMostrarSugestoesCPF] = useState(false);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(null);
  const nomeInputRef = useRef<HTMLDivElement>(null);
  const cpfInputRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState<FormData>({
    clienteNome: "",
    clienteTelefone: "",
    clienteCPF: "",
    clienteEndereco: "",
    clienteBairro: "",
    clienteNumero: "",
    clienteCidade: "",
    clienteEstado: "",
    clienteCEP: "",
    clienteDataNascimento: "",
    dispositivoTipo: "",
    dispositivoMarca: "",
    dispositivoModelo: "",
    dispositivoCor: "",
    dispositivoNumeroSerie: "",
    dispositivoIMEI: "",
    dispositivoSistema: "",
    dispositivoFabricante: "",
    dispositivoSubtipo: "",
    fotosDispositivo: [],
    defeitoRelatado: "",
    observacoesInternas: "",
    senhaDesbloqueio: { tipo: 'numero', valor: '', padrao: undefined },
    checklist: { entrada: {}, saida: {} },
    avarias: [],
    servicos: [],
    produtos: [],
    custosAdicionais: [],
    tempoGarantia: 90,
    formaPagamento: "",
    numeroParcelas: 2,
    desconto: 0,
    valorEntrada: 0,
    mostrarEntrada: false,
    total: 0,
    entrada: 0,
    saldo: 0,
    status: "aguardando_aprovacao",
    assinaturaEntrada: "",
    tipoAssinaturaEntrada: "digital",
    assinaturaSaida: "",
    tipoAssinaturaSaida: "digital",
    dataVencimentoPrazo: undefined,
    semDataDefinida: false,
    dataEntrada: new Date(),
    dataSaida: undefined,
  });

  // Carregar clientes ao abrir o dialog
  useEffect(() => {
    if (open) {
      const carregarClientes = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Usar ID do dono se funcionário tem permissão
        const userId = (isFuncionario && podeSincronizarOS && lojaUserId) ? lojaUserId : user.id;
        
        const { data } = await supabase
          .from("clientes")
          .select("*")
          .eq("user_id", userId)
          .order("nome");
        setClientes(data || []);
      };
      carregarClientes();
    }
  }, [open]);

  // Buscar clientes por termo
  const buscarClientes = (termo: string, campo: 'nome' | 'cpf') => {
    if (termo.length < 2) {
      setClientesFiltrados([]);
      setMostrarSugestoesNome(false);
      setMostrarSugestoesCPF(false);
      return;
    }

    const filtrados = clientes.filter(c => {
      if (campo === 'nome') {
        return c.nome.toLowerCase().includes(termo.toLowerCase());
      } else {
        return c.cpf?.includes(termo.replace(/\D/g, ''));
      }
    }).slice(0, 5); // Limitar a 5 sugestões

    setClientesFiltrados(filtrados);
    if (campo === 'nome') {
      setMostrarSugestoesNome(filtrados.length > 0);
    } else {
      setMostrarSugestoesCPF(filtrados.length > 0);
    }
  };

  // Selecionar cliente da lista
  const selecionarCliente = (cliente: Cliente) => {
    setFormData({
      ...formData,
      clienteNome: cliente.nome,
      clienteTelefone: cliente.telefone || "",
      clienteCPF: cliente.cpf || "",
      clienteEndereco: cliente.endereco || "",
      clienteBairro: "",
      clienteNumero: "",
      clienteCidade: "",
      clienteEstado: "",
      clienteCEP: "",
      clienteDataNascimento: cliente.data_nascimento || "",
    });
    setClienteSelecionadoId(cliente.id);
    setMostrarSugestoesNome(false);
    setMostrarSugestoesCPF(false);
  };

  // Limpar seleção quando editar campos manualmente
  const handleClienteNomeChange = (value: string) => {
    setFormData({ ...formData, clienteNome: value });
    setClienteSelecionadoId(null);
    buscarClientes(value, 'nome');
  };

  const handleClienteCPFChange = (value: string) => {
    const numeros = value.replace(/\D/g, '');
    let mascarado = value;
    if (numeros.length <= 11) {
      mascarado = aplicarMascaraCPF(value);
    } else {
      mascarado = aplicarMascaraCNPJ(value);
    }
    setFormData({ ...formData, clienteCPF: mascarado });
    setClienteSelecionadoId(null);
    buscarClientes(mascarado, 'cpf');
  };

  const handleBuscarCEPOS = async () => {
    const cepLimpo = removerMascara(formData.clienteCEP || "");
    if (cepLimpo.length !== 8) return;
    setBuscandoCEP(true);
    const dados = await buscarCEP(cepLimpo);
    setBuscandoCEP(false);
    if (dados) {
      setFormData(prev => ({
        ...prev,
        clienteEndereco: dados.logradouro,
        clienteBairro: dados.bairro,
        clienteCidade: dados.cidade,
        clienteEstado: dados.estado,
      }));
    }
  };

  useEffect(() => {
    if (ordem && open) {
      const avariasData = (ordem.avarias as AvariasOS) || {};
      
      // Recuperar serviços salvos no campo avarias
      const servicosRealizados = avariasData.servicos_realizados || [];
      const servicosCarregados = servicosRealizados.map((s: any) => ({
        id: s.id,
        nome: s.nome,
        preco: s.preco || 0,
        custo: s.custo || 0,
        lucro: s.lucro || 0,
        quantidade: 1,
        created_at: '',
        user_id: '',
        peca_id: s.peca_id || undefined,
        peca_nome: s.peca_nome || undefined,
        peca_fornecedor_id: s.peca_fornecedor_id || undefined,
        peca_fornecedor_nome: s.peca_fornecedor_nome || undefined,
        peca_status_pagamento: s.peca_status_pagamento || undefined,
        peca_data_pagamento: s.peca_data_pagamento || undefined,
        peca_valor: s.peca_valor !== undefined ? s.peca_valor : undefined,
      }));

      // Recuperar produtos salvos no campo avarias
      const produtosUtilizados = avariasData.produtos_utilizados || [];
      
      setFormData({
        clienteNome: ordem.cliente?.nome || "",
        clienteTelefone: ordem.cliente?.telefone || "",
        clienteCPF: ordem.cliente?.cpf || "",
        clienteEndereco: ordem.cliente?.endereco || "",
        clienteBairro: "",
        clienteNumero: "",
        clienteCidade: "",
        clienteEstado: "",
        clienteCEP: "",
        clienteDataNascimento: ordem.cliente?.data_nascimento || "",
        dispositivoTipo: ordem.dispositivo_tipo,
        dispositivoMarca: ordem.dispositivo_marca,
        dispositivoModelo: ordem.dispositivo_modelo,
        dispositivoCor: ordem.dispositivo_cor || "",
        dispositivoNumeroSerie: ordem.dispositivo_numero_serie || "",
        dispositivoIMEI: ordem.dispositivo_imei || "",
        dispositivoSistema: "",
        dispositivoFabricante: "",
        dispositivoSubtipo: "",
        fotosDispositivo: avariasData.fotos_dispositivo || [],
        defeitoRelatado: ordem.defeito_relatado,
        observacoesInternas: (avariasData as any)?.observacoes_internas || "",
        senhaDesbloqueio: decryptSenhaDesbloqueio(avariasData.senha_desbloqueio) || { tipo: 'numero', valor: '', padrao: [] },
        checklist: avariasData.checklist || { entrada: {}, saida: {} },
        avarias: avariasData.avarias_visuais || [],
        servicos: servicosCarregados,
        produtos: produtosUtilizados,
        custosAdicionais: avariasData.custos_adicionais || [],
        tempoGarantia: (ordem as any).tempo_garantia ?? 90,
        formaPagamento: avariasData.dados_pagamento?.forma || "",
        numeroParcelas: avariasData.dados_pagamento?.parcelas || 2,
        desconto: avariasData.dados_pagamento?.desconto || 0,
        valorEntrada: avariasData.dados_pagamento?.entrada || 0,
        mostrarEntrada: (avariasData.dados_pagamento?.entrada || 0) > 0,
        total: ordem.total || 0,
        entrada: avariasData.dados_pagamento?.entrada || 0,
        saldo: avariasData.dados_pagamento?.saldo || (ordem.total || 0),
        status: ordem.status || "aguardando_aprovacao",
        assinaturaEntrada: avariasData.assinaturas?.cliente_entrada || "",
        tipoAssinaturaEntrada: avariasData.assinaturas?.tipo_assinatura_entrada || "digital",
        assinaturaSaida: avariasData.assinaturas?.cliente_saida || "",
        tipoAssinaturaSaida: avariasData.assinaturas?.tipo_assinatura_saida || "digital",
        semDataDefinida: avariasData.dados_pagamento?.data_vencimento_prazo === 'sem_prazo',
        dataEntrada: ordem.created_at ? new Date(ordem.created_at) : new Date(),
        dataSaida: ordem.data_saida ? new Date(ordem.data_saida) : undefined,
      });
      setClienteSelecionadoId(ordem.cliente_id);
      setTecnicoId(ordem.funcionario_id || null);
      setTipoServicoId(ordem.tipo_servico_id || null);
      
      // Carregar técnicos da OS
      supabase
        .from("os_tecnicos")
        .select("funcionario_id, descricao_servico")
        .eq("os_id", ordem.id)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setTecnicosOS(data.map(t => ({
              funcionario_id: t.funcionario_id,
              descricao_servico: t.descricao_servico || "",
            })));
          } else {
            setTecnicosOS([]);
          }
        });
    } else if (!open) {
      setFormData({
        clienteNome: "",
        clienteTelefone: "",
        clienteCPF: "",
        clienteEndereco: "",
        clienteBairro: "",
        clienteNumero: "",
        clienteCidade: "",
        clienteEstado: "",
        clienteCEP: "",
        clienteDataNascimento: "",
        dispositivoTipo: "",
        dispositivoMarca: "",
        dispositivoModelo: "",
        dispositivoCor: "",
        dispositivoNumeroSerie: "",
        dispositivoIMEI: "",
        dispositivoSistema: "",
        dispositivoFabricante: "",
        dispositivoSubtipo: "",
        fotosDispositivo: [],
        defeitoRelatado: "",
        observacoesInternas: "",
        senhaDesbloqueio: { tipo: 'numero', valor: '', padrao: [] },
        checklist: { entrada: {}, saida: {} },
        avarias: [],
        servicos: [],
        produtos: [],
        custosAdicionais: [],
        tempoGarantia: 90,
        formaPagamento: "",
        numeroParcelas: 2,
        desconto: 0,
        valorEntrada: 0,
        mostrarEntrada: false,
        total: 0,
        entrada: 0,
        saldo: 0,
        status: "aguardando_aprovacao",
        assinaturaEntrada: "",
        tipoAssinaturaEntrada: "digital",
        assinaturaSaida: "",
        tipoAssinaturaSaida: "digital",
        dataVencimentoPrazo: undefined,
        semDataDefinida: false,
        dataEntrada: new Date(),
        dataSaida: undefined,
      });
      setClienteSelecionadoId(null);
      setTecnicoId(null);
      setTecnicosOS([]);
      setTipoServicoId(null);
      setNovoTipoServicoNome("");
      setCriandoTipoServico(false);
      setClientesFiltrados([]);
    }
  }, [ordem, open]);

  // Função para salvar técnicos da OS com comissões individuais
  const salvarTecnicosOS = async (osId: string, tecnicos: { funcionario_id: string; descricao_servico: string }[], totalOS: number) => {
    if (tecnicos.length === 0) {
      // Limpar técnicos existentes se lista vazia
      await supabase.from("os_tecnicos").delete().eq("os_id", osId);
      return;
    }

    // Remover técnicos antigos
    await supabase.from("os_tecnicos").delete().eq("os_id", osId);

    // Calcular comissão para cada técnico
    const tsId = tipoServicoId || null;
    const tecnicosParaInserir = [];

    for (const tec of tecnicos) {
      let comissaoTipo: string | null = null;
      let comissaoValor: number | null = null;
      let comissaoCalculada: number | null = null;

      if (tsId) {
        const { data: comissaoConfig } = await supabase
          .from("comissoes_tipo_servico")
          .select("comissao_tipo, comissao_valor")
          .eq("funcionario_id", tec.funcionario_id)
          .eq("tipo_servico_id", tsId)
          .maybeSingle();

        if (comissaoConfig && comissaoConfig.comissao_valor > 0) {
          comissaoTipo = comissaoConfig.comissao_tipo;
          comissaoValor = comissaoConfig.comissao_valor;
          if (comissaoConfig.comissao_tipo === "porcentagem") {
            comissaoCalculada = (totalOS > 0 ? totalOS : 0) * (comissaoConfig.comissao_valor / 100);
          } else {
            comissaoCalculada = comissaoConfig.comissao_valor;
          }
        }
      }

      tecnicosParaInserir.push({
        os_id: osId,
        funcionario_id: tec.funcionario_id,
        descricao_servico: tec.descricao_servico || null,
        comissao_tipo_snapshot: comissaoTipo,
        comissao_valor_snapshot: comissaoValor,
        comissao_calculada_snapshot: comissaoCalculada,
      });
    }

    await supabase.from("os_tecnicos").insert(tecnicosParaInserir);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Obter usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      // Usar ID do dono se funcionário tem permissão de sincronizar OS
      const effectiveUserId = (isFuncionario && podeSincronizarOS && lojaUserId) ? lojaUserId : user.id;

      // Usar cliente existente selecionado ou criar/atualizar
      let clienteId = clienteSelecionadoId || ordem?.cliente_id;

      if (clienteSelecionadoId && !ordem) {
        // Cliente existente foi selecionado - apenas atualizar dados se necessário
        const { error: clienteError } = await supabase
          .from("clientes")
          .update({
            nome: formData.clienteNome,
            telefone: formData.clienteTelefone,
            cpf: formData.clienteCPF,
            endereco: formData.clienteEndereco,
            data_nascimento: formData.clienteDataNascimento || null,
          })
          .eq("id", clienteSelecionadoId);

        if (clienteError) throw clienteError;
        clienteId = clienteSelecionadoId;
      } else if (ordem?.cliente_id) {
        // Editando ordem existente - atualizar cliente
        const { error: clienteError } = await supabase
          .from("clientes")
          .update({
            nome: formData.clienteNome,
            telefone: formData.clienteTelefone,
            cpf: formData.clienteCPF,
            endereco: formData.clienteEndereco,
            data_nascimento: formData.clienteDataNascimento || null,
          })
          .eq("id", ordem.cliente_id);

        if (clienteError) throw clienteError;
      } else {
        // Criar novo cliente
        const { data: clienteData, error: clienteError } = await supabase
          .from("clientes")
          .insert({
            nome: formData.clienteNome,
            telefone: formData.clienteTelefone,
            cpf: formData.clienteCPF,
            endereco: formData.clienteEndereco,
            data_nascimento: formData.clienteDataNascimento || null,
            user_id: effectiveUserId,
          })
          .select()
          .single();

        if (clienteError) throw clienteError;
        clienteId = clienteData.id;
      }

      // Preparar dados de avarias com senha criptografada, serviços realizados, produtos e assinatura
      const ordemAvarias = (ordem?.avarias as AvariasOS) || {};
      const avariasData: AvariasOS = {
        senha_desbloqueio: encryptSenhaDesbloqueio(formData.senhaDesbloqueio),
        checklist: formData.checklist,
        avarias_visuais: formData.avarias,
        servicos_realizados: formData.servicos.map(s => ({
          id: s.id,
          nome: s.nome,
          preco: Number(s.preco || 0),
          custo: Number(s.custo || 0),
          lucro: Number(s.preco || 0) - Number(s.custo || 0),
          peca_id: (s as any).peca_id || undefined,
          peca_nome: (s as any).peca_nome || undefined,
          peca_fornecedor_id: (s as any).peca_fornecedor_id || undefined,
          peca_fornecedor_nome: (s as any).peca_fornecedor_nome || undefined,
          peca_status_pagamento: (s as any).peca_status_pagamento || undefined,
          peca_data_pagamento: (s as any).peca_data_pagamento || undefined,
          peca_valor: (s as any).peca_valor !== undefined ? (s as any).peca_valor : undefined,
        })),
        produtos_utilizados: formData.produtos.map(p => ({
          id: p.id,
          nome: p.nome,
          tipo: p.tipo,
          quantidade: p.quantidade,
          preco_unitario: p.preco_unitario,
          custo_unitario: p.custo_unitario,
          preco_total: p.preco_total,
        })),
        custos_adicionais: formData.custosAdicionais,
        assinaturas: {
          ...ordemAvarias.assinaturas,
          cliente_entrada: formData.assinaturaEntrada || undefined,
          data_assinatura_entrada: formData.assinaturaEntrada 
            ? (ordemAvarias.assinaturas?.data_assinatura_entrada || new Date().toISOString())
            : undefined,
          tipo_assinatura_entrada: formData.tipoAssinaturaEntrada,
          cliente_saida: formData.assinaturaSaida || ordemAvarias.assinaturas?.cliente_saida || undefined,
          data_assinatura_saida: formData.assinaturaSaida 
            ? new Date().toISOString()
            : ordemAvarias.assinaturas?.data_assinatura_saida,
          tipo_assinatura_saida: formData.tipoAssinaturaSaida,
        },
        fotos_dispositivo: formData.fotosDispositivo,
        observacoes_internas: formData.observacoesInternas || undefined,
      };

      // Calcular total dos serviços + produtos + custos repassados - desconto
      const totalServicos = formData.servicos.reduce((sum, s) => sum + s.preco, 0);
      const totalProdutos = formData.produtos.reduce((sum, p) => sum + p.preco_total, 0);
      const totalCustosRepassados = formData.custosAdicionais
        .filter(c => c.repassar_cliente)
        .reduce((sum, c) => sum + c.valor, 0);
      const subtotal = totalServicos + totalProdutos + totalCustosRepassados;
      const total = Math.max(0, subtotal - formData.desconto);

      // Adicionar dados de pagamento ao avarias
      if (subtotal > 0 || formData.formaPagamento || formData.desconto > 0) {
        avariasData.dados_pagamento = {
          forma: (formData.formaPagamento as any) || undefined,
          parcelas: formData.numeroParcelas,
          desconto: formData.desconto,
          subtotal,
          total,
          entrada: formData.mostrarEntrada ? formData.valorEntrada : 0,
          saldo: formData.mostrarEntrada ? Math.max(0, total - formData.valorEntrada) : total,
          data_vencimento_prazo: formData.formaPagamento === 'a_prazo'
            ? (formData.semDataDefinida ? 'sem_prazo' : (formData.dataVencimentoPrazo ? formData.dataVencimentoPrazo.toISOString().split('T')[0] : undefined))
            : undefined,
        };
      } else {
        avariasData.dados_pagamento = undefined;
      }
      
      // Pegar o primeiro serviço para salvar no campo servico_id (para relatórios)
      // Ignorar serviços manuais (ID não é UUID válido)
      const primeiroServicoCatalogo = formData.servicos.find(s => !s.id.startsWith('manual_'));
      const primeiroServicoId = primeiroServicoCatalogo?.id || null;
      const primeiroServico = formData.servicos.length > 0 ? formData.servicos[0] : null;

      // === SNAPSHOT DA COMISSÃO ===
      let comissaoTipoSnapshot: string | null = null;
      let comissaoValorSnapshot: number | null = null;
      let comissaoCalculadaSnapshot: number | null = null;
      let tipoServicoNomeSnapshot: string | null = null;

      const funcId = tecnicoId || funcionarioId || null;
      const tsId = tipoServicoId || null;

      if (funcId && tsId) {
        // Buscar nome do tipo de serviço
        const tipoEncontrado = tiposServico.find(t => t.id === tsId);
        tipoServicoNomeSnapshot = tipoEncontrado?.nome || null;

        // Buscar comissão configurada para essa combinação
        const { data: comissaoConfig } = await supabase
          .from("comissoes_tipo_servico")
          .select("comissao_tipo, comissao_valor")
          .eq("funcionario_id", funcId)
          .eq("tipo_servico_id", tsId)
          .maybeSingle();

        if (comissaoConfig && comissaoConfig.comissao_valor > 0) {
          comissaoTipoSnapshot = comissaoConfig.comissao_tipo;
          comissaoValorSnapshot = comissaoConfig.comissao_valor;
          if (comissaoConfig.comissao_tipo === "porcentagem") {
            comissaoCalculadaSnapshot = (total > 0 ? total : 0) * (comissaoConfig.comissao_valor / 100);
          } else {
            comissaoCalculadaSnapshot = comissaoConfig.comissao_valor;
          }
        }
      }

      if (ordem) {
        // Atualizar ordem existente
        const { error } = await supabase
          .from("ordens_servico")
          .update({
            dispositivo_tipo: formData.dispositivoTipo,
            dispositivo_marca: formData.dispositivoMarca,
            dispositivo_modelo: formData.dispositivoModelo,
            dispositivo_cor: formData.dispositivoCor,
            dispositivo_numero_serie: formData.dispositivoNumeroSerie,
            dispositivo_imei: formData.dispositivoIMEI,
            defeito_relatado: formData.defeitoRelatado,
            senha_desbloqueio: encryptValue(formData.senhaDesbloqueio.valor),
            avarias: avariasData as any,
            total: total > 0 ? total : null,
            servico_id: primeiroServicoId,
            servico_fornecedor_id: (primeiroServico as any)?.fornecedor_id || null,
            servico_status_pagamento: (primeiroServico as any)?.status_pagamento || 'pago',
            servico_data_pagamento: (primeiroServico as any)?.data_pagamento || null,
            tempo_garantia: formData.tempoGarantia,
            funcionario_id: tecnicoId || null,
            tipo_servico_id: tipoServicoId || null,
            comissao_tipo_snapshot: comissaoTipoSnapshot,
            comissao_valor_snapshot: comissaoValorSnapshot,
            comissao_calculada_snapshot: comissaoCalculadaSnapshot,
            tipo_servico_nome_snapshot: tipoServicoNomeSnapshot,
            created_at: formData.dataEntrada.toISOString(),
            data_saida: formData.dataSaida ? formData.dataSaida.toISOString() : null,
          })
          .eq("id", ordem.id)
          .eq("user_id", effectiveUserId);

        if (error) throw error;

        // === SALVAR TÉCNICOS DA OS ===
        await salvarTecnicosOS(ordem.id, tecnicosOS, total);

        // === ATUALIZAR OU CRIAR CONTA A RECEBER AO EDITAR OS ===
        if (ordem.numero_os) {
          if (total > 0) {
            const temEntrada = formData.mostrarEntrada && formData.valorEntrada > 0;
            const entradaPaga = temEntrada ? formData.valorEntrada : 0;
            const saldoRestante = Math.max(0, total - entradaPaga);
            const dadosPag = avariasData.dados_pagamento;

            const isSemPrazo = dadosPag?.data_vencimento_prazo === 'sem_prazo';
            const dataVencConta = isSemPrazo ? null : (dadosPag?.data_vencimento_prazo || null);

            const descricaoConta = temEntrada 
              ? `OS ${ordem.numero_os} - ${formData.defeitoRelatado} (Entrada paga: R$ ${entradaPaga.toFixed(2)})${isSemPrazo ? ' (Sem prazo)' : ''}`
              : `Ordem de Serviço ${ordem.numero_os} - ${formData.defeitoRelatado}${isSemPrazo ? ' (Sem prazo)' : ''}`;

            // Verificar se já existe conta para esta OS
            const { data: contaExistente } = await supabase
              .from("contas")
              .select("id")
              .eq("user_id", effectiveUserId)
              .eq("os_numero", ordem.numero_os)
              .eq("tipo", "receber")
              .maybeSingle();

            if (contaExistente) {
              // Atualizar conta existente com novos valores
              await supabase.from("contas").update({
                valor: saldoRestante > 0 ? saldoRestante : total,
                valor_pago: entradaPaga > 0 ? entradaPaga : null,
                descricao: descricaoConta,
                nome: `OS ${ordem.numero_os} - ${formData.clienteNome}`,
                data_vencimento: dataVencConta,
              }).eq("id", contaExistente.id);
            } else {
              // Criar nova conta
              await supabase.from("contas").insert({
                nome: `OS ${ordem.numero_os} - ${formData.clienteNome}`,
                tipo: "receber",
                valor: saldoRestante > 0 ? saldoRestante : total,
                data: dataVencConta || new Date().toISOString().split('T')[0],
                data_vencimento: dataVencConta,
                valor_pago: entradaPaga > 0 ? entradaPaga : null,
                os_numero: ordem.numero_os,
                status: "pendente",
                recorrente: false,
                categoria: "Serviços",
                descricao: descricaoConta,
                user_id: effectiveUserId,
              });
            }
          } else {
            // Total zerou (serviços removidos) → remover conta vinculada e limpar entrada
            const { data: contaExistente } = await supabase
              .from("contas")
              .select("id")
              .eq("user_id", effectiveUserId)
              .eq("os_numero", ordem.numero_os)
              .eq("tipo", "receber")
              .maybeSingle();

            if (contaExistente) {
              await supabase.from("contas").delete().eq("id", contaExistente.id);
            }
          }
        }

        // === CRIAR/ATUALIZAR CONTAS A PAGAR PARA PEÇAS NA EDIÇÃO ===
        if (ordem.numero_os) {
          for (const servico of formData.servicos) {
            const s = servico as any;
            const pecaValor = s.peca_valor ?? s.custo ?? 0;
            if (s.peca_status_pagamento === 'a_pagar' && pecaValor > 0) {
              const pecaNome = s.peca_nome || s.nome;
              const fornecedorNome = s.peca_fornecedor_nome ? ` - ${s.peca_fornecedor_nome}` : '';
              const nomeConta = `Peça: ${pecaNome}${fornecedorNome} (OS ${ordem.numero_os})`;

              // Verificar se já existe conta para esta peça nesta OS
              const { data: contaPecaExistente } = await supabase
                .from("contas")
                .select("id")
                .eq("user_id", effectiveUserId)
                .eq("os_numero", ordem.numero_os)
                .eq("tipo", "pagar")
                .ilike("nome", `%Peça:%${pecaNome}%`)
                .maybeSingle();

              if (contaPecaExistente) {
                await supabase.from("contas").update({
                  nome: nomeConta,
                  valor: Number(pecaValor),
                  data: s.peca_data_pagamento || new Date().toISOString().split('T')[0],
                  fornecedor_id: s.peca_fornecedor_id || null,
                  descricao: `Peça "${pecaNome}" utilizada no serviço "${s.nome}" - OS ${ordem.numero_os}`,
                }).eq("id", contaPecaExistente.id);
              } else {
                await supabase.from("contas").insert({
                  nome: nomeConta,
                  tipo: "pagar",
                  valor: Number(pecaValor),
                  data: s.peca_data_pagamento || new Date().toISOString().split('T')[0],
                  status: "pendente",
                  recorrente: false,
                  categoria: "Fornecedores",
                  descricao: `Peça "${pecaNome}" utilizada no serviço "${s.nome}" - OS ${ordem.numero_os}`,
                  fornecedor_id: s.peca_fornecedor_id || null,
                  os_numero: ordem.numero_os,
                  user_id: effectiveUserId,
                });
              }
            }
          }
        }

        toast({
          title: "Ordem atualizada",
          description: "A ordem de serviço foi atualizada com sucesso.",
        });
      } else {
        // Criar nova ordem

        // Loop de retry para gerar número único da OS (evita erro 23505 de duplicidade)
        let numeroOS: string | null = null;
        let insertError: any = null;
        const maxTentativas = 5;
        
        for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
          // Usar a função do banco para gerar número único da OS (por usuário)
          const { data: novoNumeroOS, error: numeroError } = await supabase
            .rpc("generate_os_number", { p_user_id: effectiveUserId });

          if (numeroError) throw numeroError;
          
          numeroOS = novoNumeroOS;

          const { error } = await supabase.from("ordens_servico").insert([{
            numero_os: numeroOS,
            cliente_id: clienteId!,
            user_id: effectiveUserId,
            dispositivo_tipo: formData.dispositivoTipo,
            dispositivo_marca: formData.dispositivoMarca,
            dispositivo_modelo: formData.dispositivoModelo,
            dispositivo_cor: formData.dispositivoCor,
            dispositivo_numero_serie: formData.dispositivoNumeroSerie,
            dispositivo_imei: formData.dispositivoIMEI,
            defeito_relatado: formData.defeitoRelatado,
            senha_desbloqueio: encryptValue(formData.senhaDesbloqueio.valor),
            avarias: avariasData as any,
            total: total > 0 ? total : null,
            servico_id: primeiroServicoId,
            servico_fornecedor_id: (primeiroServico as any)?.fornecedor_id || null,
            servico_status_pagamento: (primeiroServico as any)?.status_pagamento || 'pago',
            servico_data_pagamento: (primeiroServico as any)?.data_pagamento || null,
            tempo_garantia: formData.tempoGarantia,
            funcionario_id: tecnicoId || funcionarioId || null,
            tipo_servico_id: tipoServicoId || null,
            comissao_tipo_snapshot: comissaoTipoSnapshot,
            comissao_valor_snapshot: comissaoValorSnapshot,
            comissao_calculada_snapshot: comissaoCalculadaSnapshot,
            tipo_servico_nome_snapshot: tipoServicoNomeSnapshot,
            created_at: formData.dataEntrada.toISOString(),
            data_saida: formData.dataSaida ? formData.dataSaida.toISOString() : null,
          }]);

          // Se não houve erro, sair do loop
          if (!error) {
            insertError = null;
            break;
          }
          
          // Se for erro de duplicidade (23505), tentar novamente
          if (error.code === "23505") {
            console.log(`⚠️ [OS] Tentativa ${tentativa + 1}: número ${numeroOS} já existe, gerando novo...`);
            insertError = error;
            continue;
          }
          
          // Qualquer outro erro, lançar imediatamente
          throw error;
        }
        
        // Se após todas as tentativas ainda houver erro, lançar
        if (insertError) {
          throw insertError;
        }

        // === SALVAR TÉCNICOS DA OS (INSERT) ===
        // Buscar o ID da OS recém-criada
        const { data: osCriada } = await supabase
          .from("ordens_servico")
          .select("id")
          .eq("numero_os", numeroOS)
          .eq("user_id", effectiveUserId)
          .maybeSingle();
        
        if (osCriada) {
          await salvarTecnicosOS(osCriada.id, tecnicosOS, total);
        }

        // === BAIXA NO ESTOQUE E REGISTRO DE VENDAS PARA PRODUTOS/PEÇAS ===
        if (formData.produtos.length > 0) {
          for (const produto of formData.produtos) {
            // 1. Atualizar estoque na tabela correspondente
            if (produto.tipo === 'produto') {
              const { error: estoqueError } = await supabase
                .from('produtos')
                .update({
                  quantidade: (produto.estoque_disponivel || 0) - produto.quantidade,
                })
                .eq('id', produto.id)
                .eq('user_id', effectiveUserId);

              if (estoqueError) {
                console.error('Erro ao atualizar estoque de produto:', estoqueError);
              }
            } else if (produto.tipo === 'peca') {
              const { error: estoqueError } = await supabase
                .from('pecas')
                .update({
                  quantidade: (produto.estoque_disponivel || 0) - produto.quantidade,
                })
                .eq('id', produto.id)
                .eq('user_id', effectiveUserId);

              if (estoqueError) {
                console.error('Erro ao atualizar estoque de peça:', estoqueError);
              }
            }

            // 2. Registrar na tabela de vendas para contabilização no faturamento
            // Peças são tratadas como produtos no banco (tipo_produto só aceita 'produto' ou 'dispositivo')
            const { error: vendaError } = await supabase
              .from('vendas')
              .insert({
                tipo: 'produto' as const,
                produto_id: produto.tipo === 'produto' ? produto.id : null,
                quantidade: produto.quantidade,
                total: produto.preco_total,
                custo_unitario: produto.custo_unitario,
                forma_pagamento: 'pix' as const, // Default para OS
                user_id: effectiveUserId,
                cliente_id: clienteId,
                recebido: false, // Será recebido quando a OS for finalizada
                observacoes: `Peça/Produto utilizado na OS ${numeroOS}`,
              });

            if (vendaError) {
              console.error('Erro ao registrar venda de produto:', vendaError);
            }
          }
        }

        // === CRIAR CONTA A RECEBER PARA TODA OS COM VALOR ===
        if (total > 0) {
          const dadosPag = avariasData.dados_pagamento;
          const temEntrada = formData.mostrarEntrada && formData.valorEntrada > 0;
          const entradaPaga = temEntrada ? formData.valorEntrada : 0;
          const saldoRestante = Math.max(0, total - entradaPaga);

          const descricaoConta = temEntrada 
            ? `OS ${numeroOS} - ${formData.defeitoRelatado} (Entrada paga: R$ ${entradaPaga.toFixed(2)})`
            : `Ordem de Serviço ${numeroOS} - ${formData.defeitoRelatado}`;

          await supabase.from("contas").insert({
            nome: `OS ${numeroOS} - ${formData.clienteNome}`,
            tipo: "receber",
            valor: saldoRestante > 0 ? saldoRestante : total,
            data: dadosPag?.data_vencimento_prazo || new Date().toISOString().split('T')[0],
            data_vencimento: dadosPag?.data_vencimento_prazo || null,
            valor_pago: entradaPaga > 0 ? entradaPaga : null,
            os_numero: numeroOS,
            status: "pendente",
            recorrente: false,
            categoria: "Serviços",
            descricao: descricaoConta,
            user_id: effectiveUserId,
          });
        }

        // === CRIAR CONTAS A PAGAR PARA PEÇAS COM STATUS "A PAGAR" ===
        for (const servico of formData.servicos) {
          const s = servico as any;
          const pecaValor = s.peca_valor ?? s.custo ?? 0;
          if (s.peca_status_pagamento === 'a_pagar' && pecaValor > 0) {
            const pecaNome = s.peca_nome || s.nome;
            const fornecedorNome = s.peca_fornecedor_nome ? ` - ${s.peca_fornecedor_nome}` : '';
            await supabase.from("contas").insert({
              nome: `Peça: ${pecaNome}${fornecedorNome} (OS ${numeroOS})`,
              tipo: "pagar",
              valor: Number(pecaValor),
              data: s.peca_data_pagamento || new Date().toISOString().split('T')[0],
              status: "pendente",
              recorrente: false,
              categoria: "Fornecedores",
              descricao: `Peça "${pecaNome}" utilizada no serviço "${s.nome}" - OS ${numeroOS}`,
              fornecedor_id: s.peca_fornecedor_id || null,
              os_numero: numeroOS,
              user_id: effectiveUserId,
            });
          }
        }

        // === REGISTRAR TAXA DE CARTÃO NO FINANCEIRO ===
        if (bandeiraSelecionada && bandeiraSelecionada !== "nenhuma" && total > 0) {
          const taxaSel = taxasAtivas.find(t => t.id === bandeiraSelecionada);
          console.log("[OS] Taxa cartão - bandeira:", bandeiraSelecionada, "taxaSel:", taxaSel, "formaPagamento:", formData.formaPagamento);
          if (taxaSel) {
            const { percentual, valor: valorTaxa } = calcularTaxa(taxaSel, formData.formaPagamento, formData.numeroParcelas, total);
            console.log("[OS] Taxa cartão - percentual:", percentual, "valorTaxa:", valorTaxa, "total:", total);
            if (valorTaxa > 0) {
              const { error: taxaError } = await supabase.from("contas").insert({
                nome: `Taxa Cartão ${taxaSel.bandeira} - OS ${numeroOS}`,
                tipo: "pagar" as const,
                valor: valorTaxa,
                data: new Date().toISOString().split('T')[0],
                status: "pago" as const,
                recorrente: false,
                categoria: "Taxa de Cartão",
                descricao: `Taxa ${percentual}% da bandeira ${taxaSel.bandeira} sobre OS ${numeroOS} (${formatCurrency(total)})`,
                os_numero: numeroOS,
                user_id: effectiveUserId,
              });
              if (taxaError) {
                console.error("[OS] Erro ao registrar taxa de cartão:", taxaError);
              } else {
                console.log("[OS] Taxa de cartão registrada com sucesso:", valorTaxa);
              }
            }
          }
        }

        // Tracking de evento e atualização do onboarding
        trackOSCriada(numeroOS, !!clienteId, !!formData.dispositivoModelo);
        
        // Verificar se precisa navegar para próximo passo
        const { data: onboardingData } = await supabase
          .from('user_onboarding')
          .select('step_lucro_visualizado')
          .eq('user_id', user.id)
          .maybeSingle();
        
        // Atualizar progresso do onboarding
        await supabase.rpc('update_onboarding_step', {
          _user_id: user.id,
          _step: 'os_criada'
        });

        // Disparar confetti de celebração
        dispararConfetti('celebracao');

        toast({
          title: "Ordem criada",
          description: `Ordem de serviço ${numeroOS} criada com sucesso.`,
        });

        // Disparar evento de notificação automática
        dispatchEvent("SERVICE_ORDER_CREATED", {
          numero_os: numeroOS,
          clienteNome: formData.clienteNome,
        });

        // Navegar para próximo passo se ainda não visualizou lucro
        if (!onboardingData?.step_lucro_visualizado) {
          setTimeout(() => navigate('/financeiro'), 1000);
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar ordem:", error);
      
      let mensagemErro = "Não foi possível salvar a ordem de serviço.";
      
      if (error?.code === "23505") {
        mensagemErro = "Número da ordem de serviço já existe. Tentando novamente...";
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
      <DialogContent className="sm:max-w-4xl pb-20 sm:pb-6">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {ordem ? "Editar Ordem de Serviço" : "Nova Ordem de Serviço"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 overflow-x-hidden">
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
                  value={formData.clienteNome}
                  onChange={(e) => handleClienteNomeChange(e.target.value)}
                  onFocus={() => formData.clienteNome.length >= 2 && buscarClientes(formData.clienteNome, 'nome')}
                  onBlur={() => setTimeout(() => setMostrarSugestoesNome(false), 200)}
                  autoComplete="off"
                  required
                />
                {mostrarSugestoesNome && clientesFiltrados.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
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
                  onChange={(e) =>
                    setFormData({ ...formData, clienteTelefone: e.target.value })
                  }
                />
              </div>
              <div className="relative" ref={cpfInputRef}>
                <Label htmlFor="clienteCPF">CPF / CNPJ</Label>
                <Input
                  id="clienteCPF"
                  value={formData.clienteCPF}
                  onChange={(e) => handleClienteCPFChange(e.target.value)}
                  onFocus={() => formData.clienteCPF.length >= 2 && buscarClientes(formData.clienteCPF, 'cpf')}
                  onBlur={() => setTimeout(() => setMostrarSugestoesCPF(false), 200)}
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  maxLength={18}
                />
                {mostrarSugestoesCPF && clientesFiltrados.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
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
                          {cliente.cpf && `${cliente.cpf.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF'}: ${cliente.cpf}`}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="clienteCEP">CEP</Label>
                <div className="flex gap-2">
                  <Input
                    id="clienteCEP"
                    value={formData.clienteCEP}
                    placeholder="00000-000"
                    maxLength={9}
                    onChange={(e) =>
                      setFormData({ ...formData, clienteCEP: aplicarMascaraCEP(e.target.value) })
                    }
                    onBlur={() => handleBuscarCEPOS()}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleBuscarCEPOS} disabled={buscandoCEP}>
                    {buscandoCEP ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="clienteEndereco">Endereço (Rua)</Label>
                <Input
                  id="clienteEndereco"
                  value={formData.clienteEndereco}
                  onChange={(e) =>
                    setFormData({ ...formData, clienteEndereco: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="clienteNumero">Número</Label>
                <Input
                  id="clienteNumero"
                  value={formData.clienteNumero}
                  onChange={(e) =>
                    setFormData({ ...formData, clienteNumero: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="clienteBairro">Bairro</Label>
                <Input
                  id="clienteBairro"
                  value={formData.clienteBairro}
                  onChange={(e) =>
                    setFormData({ ...formData, clienteBairro: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="clienteCidade">Cidade</Label>
                <Input
                  id="clienteCidade"
                  value={formData.clienteCidade}
                  onChange={(e) =>
                    setFormData({ ...formData, clienteCidade: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="clienteEstado">Estado</Label>
                <Input
                  id="clienteEstado"
                  value={formData.clienteEstado}
                  placeholder="UF"
                  maxLength={2}
                  onChange={(e) =>
                    setFormData({ ...formData, clienteEstado: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div>
                <Label htmlFor="clienteDataNascimento">Data de Nascimento</Label>
                <Input
                  id="clienteDataNascimento"
                  type="date"
                  value={formData.clienteDataNascimento}
                  onChange={(e) =>
                    setFormData({ ...formData, clienteDataNascimento: e.target.value })
                  }
                />
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
                      checklist: { entrada: {}, saida: {} },
                      avarias: []
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
                  onChange={(e) =>
                    setFormData({ ...formData, dispositivoMarca: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="dispositivoModelo">Modelo *</Label>
                <Input
                  id="dispositivoModelo"
                  value={formData.dispositivoModelo}
                  onChange={(e) =>
                    setFormData({ ...formData, dispositivoModelo: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="dispositivoCor">Cor</Label>
                <Input
                  id="dispositivoCor"
                  value={formData.dispositivoCor}
                  onChange={(e) =>
                    setFormData({ ...formData, dispositivoCor: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="dispositivoNumeroSerie">Número de Série</Label>
                <Input
                  id="dispositivoNumeroSerie"
                  value={formData.dispositivoNumeroSerie}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dispositivoNumeroSerie: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="dispositivoIMEI">IMEI</Label>
                <Input
                  id="dispositivoIMEI"
                  value={formData.dispositivoIMEI}
                  onChange={(e) =>
                    setFormData({ ...formData, dispositivoIMEI: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Fotos do Dispositivo */}
          <UploadFotosOS
            fotos={formData.fotosDispositivo}
            onFotosChange={(fotos) => setFormData({ ...formData, fotosDispositivo: fotos })}
            maxFotos={10}
          />

          {/* Informações do Serviço */}
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
                  onChange={(e) =>
                    setFormData({ ...formData, defeitoRelatado: e.target.value })
                  }
                  required
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="observacoesInternas">Observações Internas</Label>
                <Textarea
                  id="observacoesInternas"
                  value={formData.observacoesInternas}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoesInternas: e.target.value })
                  }
                  rows={2}
                  placeholder="Anotações internas sobre o aparelho (não aparece na impressão)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Visível apenas internamente, não será impresso.
                </p>
              </div>
              <div>
                <Label htmlFor="tempoGarantia">Tempo de Garantia (dias)</Label>
                <Select
                  value={formData.tempoGarantia?.toString() || "90"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tempoGarantia: value === "0" ? null : Number(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tempo de garantia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sem garantia</SelectItem>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="15">15 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                    <SelectItem value="180">180 dias (6 meses)</SelectItem>
                    <SelectItem value="365">365 dias (1 ano)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Técnico Responsável (principal - compatibilidade) */}
              {podeVerTecnicos && funcionarios.length > 0 && (
                <div>
                  <Label htmlFor="tecnicoId" className="flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5" />
                    Técnico Principal
                  </Label>
                  <Select
                    value={tecnicoId || "nenhum"}
                    onValueChange={(value) => setTecnicoId(value === "nenhum" ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o técnico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      {funcionarios
                        .filter(f => f.ativo)
                        .map((func) => (
                          <SelectItem key={func.id} value={func.id}>
                            {func.nome}
                            {func.cargo ? ` (${func.cargo})` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Técnicos Adicionais */}
              {podeVerTecnicos && funcionarios.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      Técnicos e Serviços Realizados
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTecnicosOS([...tecnicosOS, { funcionario_id: "", descricao_servico: "" }])}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar Técnico
                    </Button>
                  </div>
                  {tecnicosOS.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Adicione técnicos para especificar o que cada um realizou nesta OS.
                    </p>
                  )}
                  {tecnicosOS.map((tec, index) => (
                    <div key={index} className="flex gap-2 items-start p-2 border rounded-md bg-muted/30">
                      <div className="flex-1 space-y-2">
                        <Select
                          value={tec.funcionario_id || "selecionar"}
                          onValueChange={(value) => {
                            const novos = [...tecnicosOS];
                            novos[index].funcionario_id = value === "selecionar" ? "" : value;
                            setTecnicosOS(novos);
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Selecione o técnico" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="selecionar">Selecione...</SelectItem>
                            {funcionarios
                              .filter(f => f.ativo)
                              .map((func) => (
                                <SelectItem key={func.id} value={func.id}>
                                  {func.nome}
                                  {func.cargo ? ` (${func.cargo})` : ""}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="O que este técnico realizou? Ex: Troca de tela"
                          value={tec.descricao_servico}
                          onChange={(e) => {
                            const novos = [...tecnicosOS];
                            novos[index].descricao_servico = e.target.value;
                            setTecnicosOS(novos);
                          }}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          const novos = tecnicosOS.filter((_, i) => i !== index);
                          setTecnicosOS(novos);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Tipo de Serviço */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5" />
                  Tipo de Serviço
                </Label>
                {criandoTipoServico ? (
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder="Nome do tipo de serviço"
                      value={novoTipoServicoNome}
                      onChange={(e) => setNovoTipoServicoNome(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && novoTipoServicoNome.trim()) {
                          e.preventDefault();
                          const novo = await criarTipoServico(novoTipoServicoNome.trim());
                          if (novo) {
                            setTipoServicoId(novo.id);
                            setCriandoTipoServico(false);
                            setNovoTipoServicoNome("");
                          }
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={async () => {
                        if (novoTipoServicoNome.trim()) {
                          const novo = await criarTipoServico(novoTipoServicoNome.trim());
                          if (novo) {
                            setTipoServicoId(novo.id);
                            setCriandoTipoServico(false);
                            setNovoTipoServicoNome("");
                          }
                        }
                      }}
                      disabled={!novoTipoServicoNome.trim()}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => { setCriandoTipoServico(false); setNovoTipoServicoNome(""); }}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2 items-center">
                    <Select
                      value={tipoServicoId || "nenhum"}
                      onValueChange={(value) => setTipoServicoId(value === "nenhum" ? null : value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
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
                      onClick={() => setCriandoTipoServico(true)}
                      title="Criar novo tipo de serviço"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.dataEntrada && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.dataEntrada
                          ? format(formData.dataEntrada, "dd/MM/yyyy", { locale: ptBR })
                          : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.dataEntrada}
                        onSelect={(date) => date && setFormData({ ...formData, dataEntrada: date })}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Data de Saída</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.dataSaida && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.dataSaida
                          ? format(formData.dataSaida, "dd/MM/yyyy", { locale: ptBR })
                          : "Preenchida ao entregar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.dataSaida}
                        onSelect={(date) => setFormData({ ...formData, dataSaida: date || undefined })}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Senha de Desbloqueio */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Senha de Desbloqueio</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <SenhaDesbloqueio
                value={formData.senhaDesbloqueio}
                onChange={(senha) => setFormData({ ...formData, senhaDesbloqueio: senha })}
              />
            </CardContent>
          </Card>

          {/* Checklist de Entrada e Saída */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Checklist de Entrada e Saída</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ChecklistDispositivo
                tipoDispositivo={formData.dispositivoTipo}
                sistema={formData.dispositivoSistema}
                fabricante={formData.dispositivoFabricante}
                subtipo={formData.dispositivoSubtipo}
                value={formData.checklist}
                onChange={(checklist) => setFormData({ ...formData, checklist })}
                onSistemaChange={(sistema) => setFormData({ ...formData, dispositivoSistema: sistema })}
                onFabricanteChange={(fabricante) => setFormData({ ...formData, dispositivoFabricante: fabricante })}
                onSubtipoChange={(subtipo) => setFormData({ ...formData, dispositivoSubtipo: subtipo })}
              />
            </CardContent>
          </Card>

          {/* Marcação de Avarias */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Marcação de Avarias</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <MarcacaoAvarias
                tipoDispositivo={formData.dispositivoTipo}
                value={formData.avarias}
                onChange={(avarias) => setFormData({ ...formData, avarias })}
                subtipoRelogio={formData.dispositivoSubtipo}
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

          {/* Produtos e Peças */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Produtos e Peças</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <SelecionadorProduto
                value={formData.produtos}
                onChange={(produtos) => setFormData({ ...formData, produtos })}
              />
            </CardContent>
          </Card>

          {/* Resumo Financeiro */}
          <ResumoFinanceiro
              servicos={formData.servicos}
              produtos={formData.produtos}
              custosAdicionais={formData.custosAdicionais}
              onCustosAdicionaisChange={(custos) => setFormData({ ...formData, custosAdicionais: custos })}
              formaPagamento={formData.formaPagamento}
              onFormaPagamentoChange={(forma) => setFormData({ ...formData, formaPagamento: forma })}
              desconto={formData.desconto}
              onDescontoChange={(desconto) => setFormData({ ...formData, desconto })}
              valorEntrada={formData.valorEntrada}
              onValorEntradaChange={(valor) => setFormData({ ...formData, valorEntrada: valor })}
              numeroParcelas={formData.numeroParcelas}
              onNumeroParcelasChange={(parcelas) => setFormData({ ...formData, numeroParcelas: parcelas })}
              mostrarEntrada={formData.mostrarEntrada}
              onMostrarEntradaChange={(mostrar) => setFormData({ ...formData, mostrarEntrada: mostrar })}
              dataVencimentoPrazo={formData.dataVencimentoPrazo}
              onDataVencimentoPrazoChange={(data) => setFormData({ ...formData, dataVencimentoPrazo: data })}
              semDataDefinida={formData.semDataDefinida}
              onSemDataDefinidaChange={(sem) => setFormData({ ...formData, semDataDefinida: sem, dataVencimentoPrazo: sem ? undefined : formData.dataVencimentoPrazo })}
              taxasAtivas={taxasAtivas}
              bandeiraSelecionada={bandeiraSelecionada}
              onBandeiraChange={setBandeiraSelecionada}
              taxaCalculada={(() => {
                const taxaSel = taxasAtivas.find(t => t.id === bandeiraSelecionada);
                if (!taxaSel) return { percentual: 0, valor: 0 };
                const totalServicos = formData.servicos.reduce((sum, s) => sum + s.preco, 0);
                const totalProdutos = formData.produtos.reduce((sum, p) => sum + p.preco_total, 0);
                const totalCustosRep = formData.custosAdicionais.filter(c => c.repassar_cliente).reduce((sum, c) => sum + c.valor, 0);
                const subtotal = totalServicos + totalProdutos + totalCustosRep;
                const total = Math.max(0, subtotal - formData.desconto);
                return calcularTaxa(taxaSel, formData.formaPagamento, formData.numeroParcelas, total);
              })()}
            />

          {/* Assinatura Digital do Cliente - Entrada */}
          <AssinaturaDigital
            label="Assinatura do Cliente (Entrada)"
            textoAceite="Declaro estar ciente das condições do dispositivo conforme checklist e avarias registradas neste documento. Autorizo a execução dos serviços descritos."
            onSave={(assinatura) => setFormData({ ...formData, assinaturaEntrada: assinatura })}
            onClear={() => setFormData({ ...formData, assinaturaEntrada: "" })}
            onTipoChange={(tipo) => setFormData({ ...formData, tipoAssinaturaEntrada: tipo, assinaturaEntrada: tipo === 'fisica' ? "" : formData.assinaturaEntrada })}
            assinaturaExistente={formData.assinaturaEntrada}
            tipoAssinatura={formData.tipoAssinaturaEntrada}
            mostrarCheckbox={true}
            mostrarSeletorTipo={true}
          />

          {/* Assinatura Digital do Cliente - Saída (somente na edição) */}
          {ordem && (
            <AssinaturaDigital
              label="Assinatura do Cliente (Saída / Recebimento)"
              textoAceite="Declaro ter recebido o dispositivo nas condições descritas nesta ordem de serviço. Confirmo que o serviço foi realizado conforme acordado."
              onSave={(assinatura) => setFormData({ ...formData, assinaturaSaida: assinatura })}
              onClear={() => setFormData({ ...formData, assinaturaSaida: "" })}
              onTipoChange={(tipo) => setFormData({ ...formData, tipoAssinaturaSaida: tipo, assinaturaSaida: tipo === 'fisica' ? "" : formData.assinaturaSaida })}
              assinaturaExistente={formData.assinaturaSaida}
              tipoAssinatura={formData.tipoAssinaturaSaida}
              mostrarCheckbox={true}
              mostrarSeletorTipo={true}
            />
          )}

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
                ordem ? "Atualizar" : "Criar Ordem"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
