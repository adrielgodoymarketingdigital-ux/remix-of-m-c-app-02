import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useResolvedUserId } from "@/hooks/useResolvedUserId";
import { Cliente } from "@/types/cliente";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { AvariasOS } from "@/types/ordem-servico";
import { aplicarMascaraCPF, aplicarMascaraCNPJ, removerMascara } from "@/lib/mascaras";
import { buscarCEP } from "@/lib/buscarCEP";
import { decryptSenhaDesbloqueio } from "@/lib/password-encryption";
import { FormData, TecnicoOS, EtapaWizard } from "./tipos";

const formDataVazio: FormData = {
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
  fotosDispositivo: [],
  localizacaoFisica: "",
  defeitoRelatado: "",
  observacoesInternas: "",
  mostrarObsInternasImpressao: false,
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
  formaPagamentoEntrada: "dinheiro",
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
};

interface UseOrdemServicoWizardStateParams {
  open: boolean;
  ordem: OrdemServico | null;
  isFuncionario: boolean;
  lojaUserId: string | null;
  isFilialCtx: boolean;
  empresaInfoId: string | null;
  carregandoPermissoes: boolean;
}

/**
 * Concentra formData e todo o state/efeitos auxiliares do wizard de OS —
 * extraído sem mudança semântica de DialogOrdemServico.tsx.
 */
export function useOrdemServicoWizardState({
  open,
  ordem,
  isFuncionario,
  lojaUserId,
  isFilialCtx,
  empresaInfoId,
  carregandoPermissoes,
}: UseOrdemServicoWizardStateParams) {
  const [loading, setLoading] = useState(false);
  const [tecnicoId, setTecnicoId] = useState<string | null>(null);
  const [tecnicosOS, setTecnicosOS] = useState<TecnicoOS[]>([]);
  const [tipoServicoId, setTipoServicoId] = useState<string | null>(null);
  const [novoTipoServicoNome, setNovoTipoServicoNome] = useState("");
  const [criandoTipoServico, setCriandoTipoServico] = useState(false);
  const [bandeiraSelecionada, setBandeiraSelecionada] = useState("");
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const [mostrarSugestoesNome, setMostrarSugestoesNome] = useState(false);
  const [mostrarSugestoesCPF, setMostrarSugestoesCPF] = useState(false);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(null);
  const nomeInputRef = useRef<HTMLDivElement>(null);
  const cpfInputRef = useRef<HTMLDivElement>(null);

  const [etapaAtual, setEtapaAtual] = useState<EtapaWizard>(1);
  const [etapaMaximaAlcancada, setEtapaMaximaAlcancada] = useState<EtapaWizard>(1);
  const [campoComErro, setCampoComErro] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>(formDataVazio);

  const resolvedUserIdFromContext = useResolvedUserId();

  // Carregar clientes ao abrir o dialog
  useEffect(() => {
    // Aguarda useFuncionarioPermissoes resolver — senão isFuncionario/lojaUserId
    // ainda estão nos valores padrão (false/null) e a busca cai no usuário errado
    if (open && !carregandoPermissoes) {
      const carregarClientes = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Gerente de filial → user_id do proprietário; funcionário → lojaUserId
        const userId = resolvedUserIdFromContext
          ?? ((isFuncionario && lojaUserId) ? lojaUserId : user.id);

        let query = supabase
          .from("clientes")
          .select("*")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("nome");

        // Filial: filtrar exatamente pela empresa da filial
        if (isFilialCtx && empresaInfoId) {
          query = query.eq("empresa_id", empresaInfoId);
        }

        const { data } = await query;
        setClientes(data || []);
      };
      carregarClientes();
    }
  }, [open, carregandoPermissoes, resolvedUserIdFromContext, isFuncionario, lojaUserId, isFilialCtx, empresaInfoId]);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        origemCliente: (ordem as any).origem_cliente || "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tipoMidia: (ordem as any).tipo_midia || "",
        dispositivoTipo: ordem.dispositivo_tipo,
        dispositivoMarca: ordem.dispositivo_marca,
        dispositivoModelo: ordem.dispositivo_modelo,
        dispositivoCor: ordem.dispositivo_cor || "",
        dispositivoNumeroSerie: ordem.dispositivo_numero_serie || "",
        dispositivoIMEI: ordem.dispositivo_imei || "",
        dispositivoSistema: avariasData.dispositivo_sistema || "",
        dispositivoFabricante: avariasData.dispositivo_fabricante || "",
        dispositivoSubtipo: avariasData.dispositivo_subtipo || "",
        fotosDispositivo: avariasData.fotos_dispositivo || [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        localizacaoFisica: (ordem as any).localizacao_fisica || "",
        defeitoRelatado: ordem.defeito_relatado,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        observacoesInternas: (avariasData as any)?.observacoes_internas || "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mostrarObsInternasImpressao: (avariasData as any)?.mostrar_obs_internas_impressao ?? false,
        senhaDesbloqueio: decryptSenhaDesbloqueio(avariasData.senha_desbloqueio) || { tipo: 'numero', valor: '', padrao: [] },
        checklist: avariasData.checklist || { entrada: {}, saida: {} },
        avarias: avariasData.avarias_visuais || [],
        servicos: servicosCarregados,
        produtos: produtosUtilizados,
        custosAdicionais: avariasData.custos_adicionais || [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tempoGarantia: (ordem as any).tempo_garantia ?? 90,
        formaPagamento: avariasData.dados_pagamento?.forma || "",
        numeroParcelas: avariasData.dados_pagamento?.parcelas || 2,
        desconto: avariasData.dados_pagamento?.desconto || 0,
        valorEntrada: avariasData.dados_pagamento?.entrada || 0,
        mostrarEntrada: (avariasData.dados_pagamento?.entrada || 0) > 0,
        formaPagamentoEntrada: avariasData.dados_pagamento?.forma_pagamento_entrada || "dinheiro",
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

      // Wizard sempre abre na etapa 1, mesmo na edição
      setEtapaAtual(1);
      setEtapaMaximaAlcancada(1);
      setCampoComErro(null);

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
      setFormData(formDataVazio);
      setClienteSelecionadoId(null);
      setTecnicoId(null);
      setTecnicosOS([]);
      setTipoServicoId(null);
      setNovoTipoServicoNome("");
      setCriandoTipoServico(false);
      setClientesFiltrados([]);
      setEtapaAtual(1);
      setEtapaMaximaAlcancada(1);
      setCampoComErro(null);
    }
  }, [ordem, open]);

  return {
    loading, setLoading,
    tecnicoId, setTecnicoId,
    tecnicosOS, setTecnicosOS,
    tipoServicoId, setTipoServicoId,
    novoTipoServicoNome, setNovoTipoServicoNome,
    criandoTipoServico, setCriandoTipoServico,
    bandeiraSelecionada, setBandeiraSelecionada,
    buscandoCEP,
    clientes,
    clientesFiltrados,
    mostrarSugestoesNome, setMostrarSugestoesNome,
    mostrarSugestoesCPF, setMostrarSugestoesCPF,
    clienteSelecionadoId, setClienteSelecionadoId,
    nomeInputRef,
    cpfInputRef,
    etapaAtual, setEtapaAtual,
    etapaMaximaAlcancada, setEtapaMaximaAlcancada,
    campoComErro, setCampoComErro,
    formData, setFormData,
    buscarClientes,
    selecionarCliente,
    handleClienteNomeChange,
    handleClienteCPFChange,
    handleBuscarCEPOS,
  };
}
