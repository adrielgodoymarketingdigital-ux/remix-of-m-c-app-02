import { useEffect, useState } from "react";
import { Loader2, ChevronRight, ChevronLeft, ClipboardList, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useConfetti } from "@/hooks/useConfetti";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { useTiposServico } from "@/hooks/useTiposServico";
import { useIsPwaMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useEventDispatcher } from "@/hooks/useEventDispatcher";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useEmpresaInfo } from "@/hooks/useResolvedUserId";
import { useTaxasCartao } from "@/hooks/useTaxasCartao";
import { useLocalizacoesOS } from "@/hooks/useLocalizacoesOS";
import { useDispositivosAdicionaisOSVisivel } from "@/hooks/useDispositivosAdicionaisOSVisivel";
import { chaveDispositivosAdicionaisOS } from "@/hooks/useOsDispositivosAdicionais";
import type { EntradaGravacaoAdicionais } from "@/lib/ordemServico/gravacaoDispositivosAdicionaisOS";
import {
  alterarAparelhoNoEstado,
  entradaGravacaoParaSalvar,
  estadoAposGravacao,
  removerAparelhoDoEstado,
  salvarAparelhoNoEstado,
  textoAparelhosPerdidos,
} from "@/lib/ordemServico/formularioDispositivosAdicionaisOS";

import { useOrdemServicoWizardState } from "./ordem-servico-wizard/useOrdemServicoWizardState";
import { validarEtapa } from "./ordem-servico-wizard/useOrdemServicoWizardValidacao";
import {
  avisoAdicionaisToast,
  gravarSomenteDispositivosAdicionais,
  salvarOrdemServico,
} from "./ordem-servico-wizard/handleSubmitOrdemServico";
import { SecaoDispositivosAdicionais } from "./ordem-servico-wizard/SecaoDispositivosAdicionais";
import type { AparelhosNasEtapas } from "./ordem-servico-wizard/BlocoDispositivoEtapa";
import { OrdemServicoWizardProgresso } from "./ordem-servico-wizard/OrdemServicoWizardProgresso";
import { EtapaCardWrapper } from "./ordem-servico-wizard/EtapaCardWrapper";
import { EtapaOrigemCliente } from "./ordem-servico-wizard/EtapaOrigemCliente";
import { EtapaDadosCliente } from "./ordem-servico-wizard/EtapaDadosCliente";
import { EtapaDispositivo } from "./ordem-servico-wizard/EtapaDispositivo";
import { EtapaInformacoesServico } from "./ordem-servico-wizard/EtapaInformacoesServico";
import { EtapaChecklistAvarias } from "./ordem-servico-wizard/EtapaChecklistAvarias";
import { EtapaServicosProdutos } from "./ordem-servico-wizard/EtapaServicosProdutos";
import { EtapaResumoAssinatura } from "./ordem-servico-wizard/EtapaResumoAssinatura";
import { EtapaWizard } from "./ordem-servico-wizard/tipos";

interface DialogOrdemServicoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico | null;
  onSuccess: () => void;
  /**
   * true quando o dialog é aberto pelo card "Primeiros Passos" do Dashboard:
   * a OS entra fora da cota do plano e sem redirect pós-save para /financeiro.
   */
  primeiraOsOnboarding?: boolean;
}

const TOTAL_ETAPAS: EtapaWizard = 7;

export const DialogOrdemServico = ({
  open,
  onOpenChange,
  ordem,
  onSuccess,
  primeiraOsOnboarding,
}: DialogOrdemServicoProps) => {
  const { toast } = useToast();
  const { trackOSCriada } = useEventTracking();
  const { disparar: dispararConfetti } = useConfetti();
  const { dispatchEvent } = useEventDispatcher();
  const { funcionarioId, lojaUserId, isFuncionario, tecnicoObrigatorioOS, podeVerTecnicos, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const { empresaAtiva: empresaAtivaCtx, isProprietario } = useEmpresa();
  const { empresaId: empresaInfoId, isFilial: isFilialCtx } = useEmpresaInfo();
  const { temAcessoModulo } = useAssinatura();
  const navigate = useNavigate();
  const { funcionarios } = useFuncionarios();
  const { tiposServico, criar: criarTipoServico } = useTiposServico();
  const { taxasAtivas, calcularTaxa } = useTaxasCartao();
  const { localizacoes } = useLocalizacoesOS();
  const modoUnico = useIsPwaMobile();
  const queryClient = useQueryClient();
  // Dispositivos adicionais: tudo abaixo só age para quem os vê (hoje, admin do MecApp).
  const adicionaisVisiveis = useDispositivosAdicionaisOSVisivel();
  // OS salva, mas os adicionais não (resultado "falhou" da gravação): o
  // assistente fica aberto até "Gravar aparelhos de novo" ou fechar confirmando.
  const [falhaAdicionais, setFalhaAdicionais] = useState<
    { osId: string | null; numeroOS: string | null; entrada: EntradaGravacaoAdicionais } | null
  >(null);
  const [gravandoAdicionaisDeNovo, setGravandoAdicionaisDeNovo] = useState(false);
  const [confirmarFecharSemAdicionais, setConfirmarFecharSemAdicionais] = useState(false);

  const {
    loading, setLoading,
    tecnicoId, setTecnicoId,
    tecnicosOS, setTecnicosOS,
    tipoServicoId, setTipoServicoId,
    novoTipoServicoNome, setNovoTipoServicoNome,
    criandoTipoServico, setCriandoTipoServico,
    bandeiraSelecionada, setBandeiraSelecionada,
    buscandoCEP,
    clientesFiltrados,
    mostrarSugestoesNome, setMostrarSugestoesNome,
    mostrarSugestoesCPF, setMostrarSugestoesCPF,
    clienteSelecionadoId,
    nomeInputRef,
    cpfInputRef,
    etapaAtual, setEtapaAtual,
    etapaMaximaAlcancada, setEtapaMaximaAlcancada,
    campoComErro, setCampoComErro,
    formData, setFormData,
    estadoAdicionais, setEstadoAdicionais, recarregarAdicionais,
    buscarClientes,
    selecionarCliente,
    handleClienteNomeChange,
    handleClienteCPFChange,
    handleBuscarCEPOS,
  } = useOrdemServicoWizardState({ open, ordem, isFuncionario, lojaUserId, isFilialCtx, empresaInfoId, carregandoPermissoes, adicionaisVisiveis });

  useEffect(() => {
    if (!open) {
      setFalhaAdicionais(null);
      setConfirmarFecharSemAdicionais(false);
    }
  }, [open]);

  /** Fechar o assistente: com adicionais pendentes de gravar, pede confirmação. */
  const fecharAssistente = (aberto: boolean) => {
    if (!aberto && falhaAdicionais) {
      setConfirmarFecharSemAdicionais(true);
      return;
    }
    onOpenChange(aberto);
  };

  const gravarAdicionaisDeNovo = async () => {
    if (!falhaAdicionais?.osId) return;
    const osId = falhaAdicionais.osId;
    setGravandoAdicionaisDeNovo(true);
    try {
      const resultado = await gravarSomenteDispositivosAdicionais({
        osId,
        entrada: falhaAdicionais.entrada,
        fotosDispositivo1: formData.fotosDispositivo,
        isProprietario,
        empresaAtivaCtx,
      });
      queryClient.invalidateQueries({ queryKey: chaveDispositivosAdicionaisOS(osId) });
      if (resultado.status === "falhou") {
        toast({ title: "Aparelhos adicionais ainda não gravados", description: resultado.mensagem, variant: "destructive" });
        return;
      }
      toast({
        title: "Aparelhos adicionais gravados",
        description: avisoAdicionaisToast(resultado, falhaAdicionais.entrada) ?? undefined,
      });
      setEstadoAdicionais(estadoAposGravacao);
      setFalhaAdicionais(null);
      onSuccess();
      onOpenChange(false);
    } finally {
      setGravandoAdicionaisDeNovo(false);
    }
  };

  // Só montada para quem vê os adicionais; para os demais é null (nada muda na tela).
  const secaoAdicionais = adicionaisVisiveis ? (
    <SecaoDispositivosAdicionais
      estado={estadoAdicionais}
      servicos={formData.servicos}
      imeiDispositivo1={formData.dispositivoIMEI}
      bloqueada={!!falhaAdicionais}
      onSalvarAparelho={(aparelho) => setEstadoAdicionais((e) => salvarAparelhoNoEstado(e, aparelho))}
      onRemoverAparelho={(id) => {
        const r = removerAparelhoDoEstado(estadoAdicionais, id, formData.servicos);
        setEstadoAdicionais(r.estado);
        if (r.servicosDesligados > 0) setFormData({ ...formData, servicos: r.servicos });
      }}
      onTentarCarregarDeNovo={recarregarAdicionais}
    />
  ) : null;

  // Blocos por aparelho das etapas 4 e 5: mesmo estadoAdicionais do diálogo do
  // aparelho. undefined para quem não vê os adicionais (etapas como sempre foram).
  const aparelhosNasEtapas: AparelhosNasEtapas | undefined = adicionaisVisiveis
    ? {
        estado: estadoAdicionais,
        bloqueada: !!falhaAdicionais,
        onAlterar: (id, parcial) => setEstadoAdicionais((e) => alterarAparelhoNoEstado(e, id, parcial)),
        onTentarCarregarDeNovo: recarregarAdicionais,
      }
    : undefined;

  // Banner de confirmação de custo (Comissão sobre Lucro): deve aparecer se
  // QUALQUER técnico envolvido na OS calcula comissão sobre lucro — o técnico
  // principal da Etapa 4 (tecnicoId), o funcionário técnico que preenche a OS
  // (funcionarioId), OU qualquer técnico vinculado via "Técnicos por Serviço"
  // (tecnicosOS). OR no nível da OS: confirmar/preencher o custo nunca
  // prejudica quem calcula sobre faturamento.
  const idsTecnicosEnvolvidos = [
    tecnicoId,
    funcionarioId,
    ...tecnicosOS.map((t) => t.funcionario_id),
  ].filter(Boolean) as string[];
  const comissaoLucroAtiva = funcionarios.some(
    (f) => idsTecnicosEnvolvidos.includes(f.id) && f.comissao_calculo === "lucro",
  );

  const irParaEtapa = (etapa: EtapaWizard) => {
    setCampoComErro(null);
    setEtapaAtual(etapa);
    setEtapaMaximaAlcancada((prev) => (etapa > prev ? etapa : prev));
  };

  const voltarEtapa = () => {
    if (etapaAtual > 1) {
      setCampoComErro(null);
      setEtapaAtual((etapaAtual - 1) as EtapaWizard);
    }
  };

  const tentarAvancar = () => {
    const resultado = validarEtapa({
      etapa: etapaAtual,
      formData,
      tecnicoId,
      tecnicoObrigatorioOS,
      funcionarioId,
    });

    if (!resultado.valido) {
      toast({
        title: "Campo obrigatório",
        description: resultado.mensagem,
        variant: "destructive",
      });
      setCampoComErro(resultado.campoComErro ?? null);
      return;
    }

    setCampoComErro(null);
    if (etapaAtual < TOTAL_ETAPAS) {
      const proxima = (etapaAtual + 1) as EtapaWizard;
      setEtapaAtual(proxima);
      setEtapaMaximaAlcancada((prev) => (proxima > prev ? proxima : prev));
    }
  };

  const handleSalvar = async () => {
    setLoading(true);
    // undefined para quem não vê os adicionais (ou se a lista não carregou): a gravação não toca na tabela.
    const entradaAdicionais = entradaGravacaoParaSalvar(adicionaisVisiveis, estadoAdicionais);
    try {
      const resultado = await salvarOrdemServico({
        formData,
        ordem,
        tecnicoId,
        tecnicosOS,
        tipoServicoId,
        clienteSelecionadoId,
        bandeiraSelecionada,
        taxasAtivas,
        tiposServico,
        funcionarioId,
        tecnicoObrigatorioOS,
        isProprietario,
        empresaAtivaCtx,
        temAcessoModulo,
        calcularTaxa,
        toast,
        trackOSCriada,
        dispararConfetti,
        dispatchEvent,
        navigate,
        onSuccess,
        onOpenChange,
        primeiraOsOnboarding,
        dispositivosAdicionais: entradaAdicionais,
      });
      if (entradaAdicionais && resultado) {
        if (resultado.osId) queryClient.invalidateQueries({ queryKey: chaveDispositivosAdicionaisOS(resultado.osId) });
        if (resultado.adicionais?.status === "falhou") {
          setFalhaAdicionais({ osId: resultado.osId, numeroOS: resultado.numeroOS, entrada: entradaAdicionais });
        } else {
          setEstadoAdicionais(estadoAposGravacao);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  /** Valida as etapas 2, 3 e 4 (únicas com campos obrigatórios) em ordem; retorna a primeira inválida, se houver. */
  const validarEtapasObrigatorias = () => {
    const etapasParaValidar: EtapaWizard[] = [2, 3, 4];
    for (const etapa of etapasParaValidar) {
      const resultado = validarEtapa({
        etapa,
        formData,
        tecnicoId,
        tecnicoObrigatorioOS,
        funcionarioId,
      });
      if (!resultado.valido) {
        return { etapa, resultado };
      }
    }
    return null;
  };

  const tentarSalvarModoUnico = () => {
    const invalida = validarEtapasObrigatorias();
    if (invalida) {
      toast({
        title: "Campo obrigatório",
        description: invalida.resultado.mensagem,
        variant: "destructive",
      });
      setCampoComErro(invalida.resultado.campoComErro ?? null);
      document
        .querySelector(`[data-etapa="${invalida.etapa}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setCampoComErro(null);
    handleSalvar();
  };

  const tentarSalvarWizard = () => {
    const invalida = validarEtapasObrigatorias();
    if (invalida) {
      toast({
        title: "Campo obrigatório",
        description: invalida.resultado.mensagem,
        variant: "destructive",
      });
      setCampoComErro(invalida.resultado.campoComErro ?? null);
      setEtapaAtual(invalida.etapa);
      setEtapaMaximaAlcancada((prev) => (invalida.etapa > prev ? invalida.etapa : prev));
      return;
    }

    setCampoComErro(null);
    handleSalvar();
  };

  const etapasComPendencia: EtapaWizard[] = ([2, 3, 4] as EtapaWizard[]).filter(
    (etapa) =>
      !validarEtapa({ etapa, formData, tecnicoId, tecnicoObrigatorioOS, funcionarioId }).valido
  );

  return (
    <Dialog open={open} onOpenChange={fecharAssistente}>
      <DialogContent className="!inset-auto !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-[calc(100vw-1rem)] !h-[92dvh] !max-w-2xl !rounded-2xl sm:!w-screen sm:!h-screen sm:!max-w-none sm:!max-h-none sm:!rounded-none sm:!left-0 sm:!top-0 sm:!translate-x-0 sm:!translate-y-0 sm:!border-0 sm:zoom-in-100 sm:slide-in-from-left-0 sm:slide-in-from-top-0 sm:data-[state=closed]:slide-out-to-left-0 sm:data-[state=closed]:slide-out-to-top-0 sm:data-[state=closed]:zoom-out-100 p-0 gap-0 overflow-hidden flex flex-col bg-background [&>button]:h-7 [&>button]:w-7 sm:[&>button]:h-8 sm:[&>button]:w-8 [&>button]:rounded-full [&>button]:bg-muted [&>button]:opacity-100 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:top-3 [&>button]:right-3 sm:[&>button]:top-6 sm:[&>button]:right-6">
        <div className="shrink-0 px-3 pt-3 pb-2.5 sm:px-6 sm:pt-6 sm:pb-5 border-b">
          <div className="w-full sm:max-w-5xl sm:mx-auto">
            <DialogHeader className="mb-2.5 sm:mb-5">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="h-8 w-8 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-sm sm:text-lg font-bold text-left truncate">
                    {ordem ? `Editar OS ${ordem.numero_os}` : "Nova Ordem de Serviço"}
                  </DialogTitle>
                  <p className="hidden sm:block text-sm text-muted-foreground">
                    {ordem ? "Atualize as informações e acompanhe o progresso." : "Preencha as informações para abrir uma nova OS."}
                  </p>
                </div>
              </div>
            </DialogHeader>
            {!modoUnico && (
              <OrdemServicoWizardProgresso
                etapaAtual={etapaAtual}
                etapaMaximaAlcancada={etapaMaximaAlcancada}
                onEtapaClick={irParaEtapa}
                etapasComPendencia={etapasComPendencia}
              />
            )}
          </div>
        </div>

        {falhaAdicionais && (
          <div className="shrink-0 px-3 py-2.5 sm:px-6 border-b border-destructive/40 bg-destructive/10" data-falha-adicionais>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:max-w-5xl sm:mx-auto text-sm text-destructive">
              <span className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {falhaAdicionais.osId
                  ? `A OS nº ${falhaAdicionais.numeroOS ?? ""} foi salva, mas os aparelhos adicionais não. Toque em Gravar aparelhos de novo.`
                  : `A OS nº ${falhaAdicionais.numeroOS ?? ""} foi salva, mas os aparelhos adicionais não. Abra a OS pela lista e cadastre-os de novo.`}
              </span>
              {falhaAdicionais.osId && (
                <Button type="button" size="sm" variant="destructive" onClick={gravarAdicionaisDeNovo} disabled={gravandoAdicionaisDeNovo} className="shrink-0">
                  {gravandoAdicionaisDeNovo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Gravar aparelhos de novo
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 sm:px-6 sm:py-5">
          <div className="text-sm sm:max-w-5xl sm:mx-auto">
          {modoUnico ? (
            <div className="space-y-4">
              <EtapaCardWrapper dataEtapa={1}>
                <EtapaOrigemCliente formData={formData} setFormData={setFormData} />
              </EtapaCardWrapper>

              <EtapaCardWrapper dataEtapa={2}>
                <EtapaDadosCliente
                  formData={formData}
                  setFormData={setFormData}
                  campoComErro={campoComErro}
                  clienteSelecionadoId={clienteSelecionadoId}
                  clientesFiltrados={clientesFiltrados}
                  mostrarSugestoesNome={mostrarSugestoesNome}
                  setMostrarSugestoesNome={setMostrarSugestoesNome}
                  mostrarSugestoesCPF={mostrarSugestoesCPF}
                  setMostrarSugestoesCPF={setMostrarSugestoesCPF}
                  nomeInputRef={nomeInputRef}
                  cpfInputRef={cpfInputRef}
                  buscandoCEP={buscandoCEP}
                  buscarClientes={buscarClientes}
                  selecionarCliente={selecionarCliente}
                  handleClienteNomeChange={handleClienteNomeChange}
                  handleClienteCPFChange={handleClienteCPFChange}
                  handleBuscarCEPOS={handleBuscarCEPOS}
                />
              </EtapaCardWrapper>

              <EtapaCardWrapper dataEtapa={3}>
                <EtapaDispositivo
                  formData={formData}
                  setFormData={setFormData}
                  campoComErro={campoComErro}
                />
                {secaoAdicionais}
              </EtapaCardWrapper>

              <EtapaCardWrapper dataEtapa={4}>
                <EtapaInformacoesServico
                  formData={formData}
                  setFormData={setFormData}
                  campoComErro={campoComErro}
                  localizacoes={localizacoes}
                  podeVerTecnicos={podeVerTecnicos}
                  funcionarios={funcionarios}
                  tecnicoObrigatorioOS={tecnicoObrigatorioOS}
                  tecnicoId={tecnicoId}
                  setTecnicoId={setTecnicoId}
                  tiposServico={tiposServico}
                  tipoServicoId={tipoServicoId}
                  setTipoServicoId={setTipoServicoId}
                  criandoTipoServico={criandoTipoServico}
                  setCriandoTipoServico={setCriandoTipoServico}
                  novoTipoServicoNome={novoTipoServicoNome}
                  setNovoTipoServicoNome={setNovoTipoServicoNome}
                  criarTipoServico={criarTipoServico}
                  dispositivosAdicionais={aparelhosNasEtapas}
                />
              </EtapaCardWrapper>

              <EtapaCardWrapper dataEtapa={5}>
                <EtapaChecklistAvarias formData={formData} setFormData={setFormData} dispositivosAdicionais={aparelhosNasEtapas} />
              </EtapaCardWrapper>

              <EtapaCardWrapper dataEtapa={6}>
                <EtapaServicosProdutos
                  formData={formData}
                  setFormData={setFormData}
                  podeVerTecnicos={podeVerTecnicos}
                  funcionarios={funcionarios}
                  tecnicosOS={tecnicosOS}
                  setTecnicosOS={setTecnicosOS}
                  comissaoLucroAtiva={comissaoLucroAtiva}
                  dispositivosAdicionais={adicionaisVisiveis ? estadoAdicionais.dispositivos : undefined}
                />
              </EtapaCardWrapper>

              <EtapaCardWrapper dataEtapa={7}>
                <EtapaResumoAssinatura
                  formData={formData}
                  setFormData={setFormData}
                  taxasAtivas={taxasAtivas}
                  bandeiraSelecionada={bandeiraSelecionada}
                  setBandeiraSelecionada={setBandeiraSelecionada}
                  calcularTaxa={calcularTaxa}
                  temAssinaturaSaida={!!ordem}
                />
              </EtapaCardWrapper>
            </div>
          ) : (
            <>
          {etapaAtual === 1 && (
            <EtapaOrigemCliente formData={formData} setFormData={setFormData} />
          )}

          {etapaAtual === 2 && (
            <EtapaDadosCliente
              formData={formData}
              setFormData={setFormData}
              campoComErro={campoComErro}
              clienteSelecionadoId={clienteSelecionadoId}
              clientesFiltrados={clientesFiltrados}
              mostrarSugestoesNome={mostrarSugestoesNome}
              setMostrarSugestoesNome={setMostrarSugestoesNome}
              mostrarSugestoesCPF={mostrarSugestoesCPF}
              setMostrarSugestoesCPF={setMostrarSugestoesCPF}
              nomeInputRef={nomeInputRef}
              cpfInputRef={cpfInputRef}
              buscandoCEP={buscandoCEP}
              buscarClientes={buscarClientes}
              selecionarCliente={selecionarCliente}
              handleClienteNomeChange={handleClienteNomeChange}
              handleClienteCPFChange={handleClienteCPFChange}
              handleBuscarCEPOS={handleBuscarCEPOS}
            />
          )}

          {etapaAtual === 3 && (
            <>
              <EtapaDispositivo
                formData={formData}
                setFormData={setFormData}
                campoComErro={campoComErro}
              />
              {secaoAdicionais}
            </>
          )}

          {etapaAtual === 4 && (
            <EtapaInformacoesServico
              formData={formData}
              setFormData={setFormData}
              campoComErro={campoComErro}
              localizacoes={localizacoes}
              podeVerTecnicos={podeVerTecnicos}
              funcionarios={funcionarios}
              tecnicoObrigatorioOS={tecnicoObrigatorioOS}
              tecnicoId={tecnicoId}
              setTecnicoId={setTecnicoId}
              tiposServico={tiposServico}
              tipoServicoId={tipoServicoId}
              setTipoServicoId={setTipoServicoId}
              criandoTipoServico={criandoTipoServico}
              setCriandoTipoServico={setCriandoTipoServico}
              novoTipoServicoNome={novoTipoServicoNome}
              setNovoTipoServicoNome={setNovoTipoServicoNome}
              criarTipoServico={criarTipoServico}
              dispositivosAdicionais={aparelhosNasEtapas}
            />
          )}

          {etapaAtual === 5 && (
            <EtapaChecklistAvarias formData={formData} setFormData={setFormData} dispositivosAdicionais={aparelhosNasEtapas} />
          )}

          {etapaAtual === 6 && (
            <EtapaServicosProdutos
              formData={formData}
              setFormData={setFormData}
              podeVerTecnicos={podeVerTecnicos}
              funcionarios={funcionarios}
              tecnicosOS={tecnicosOS}
              setTecnicosOS={setTecnicosOS}
              comissaoLucroAtiva={comissaoLucroAtiva}
              dispositivosAdicionais={adicionaisVisiveis ? estadoAdicionais.dispositivos : undefined}
            />
          )}

          {etapaAtual === 7 && (
            <EtapaResumoAssinatura
              formData={formData}
              setFormData={setFormData}
              taxasAtivas={taxasAtivas}
              bandeiraSelecionada={bandeiraSelecionada}
              setBandeiraSelecionada={setBandeiraSelecionada}
              calcularTaxa={calcularTaxa}
              temAssinaturaSaida={!!ordem}
            />
          )}
            </>
          )}
          </div>
        </div>

        <div className="shrink-0 px-3 py-2.5 sm:px-6 sm:py-4 border-t">
          <div className="flex flex-row justify-between gap-2 sm:gap-3 sm:max-w-5xl sm:mx-auto">
            {modoUnico ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fecharAssistente(false)}
                  disabled={loading}
                  className="gap-1.5 sm:h-10 sm:px-4 sm:text-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={tentarSalvarModoUnico} disabled={loading || !!falhaAdicionais} className="sm:h-10 sm:px-4 sm:text-sm">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    ordem ? "Atualizar" : "Criar Ordem"
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={etapaAtual === 1 ? () => fecharAssistente(false) : voltarEtapa}
                  disabled={loading}
                  className="gap-1.5 sm:h-10 sm:px-4 sm:text-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {etapaAtual === 1 ? "Cancelar" : "Anterior"}
                </Button>
                {etapaAtual < TOTAL_ETAPAS ? (
                  <Button type="button" size="sm" onClick={tentarAvancar} disabled={loading} className="gap-1.5 sm:h-10 sm:px-4 sm:text-sm">
                    Próximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={tentarSalvarWizard} disabled={loading || !!falhaAdicionais} className="sm:h-10 sm:px-4 sm:text-sm">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      ordem ? "Atualizar" : "Criar Ordem"
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={confirmarFecharSemAdicionais} onOpenChange={setConfirmarFecharSemAdicionais}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar sem gravar os aparelhos?</AlertDialogTitle>
            <AlertDialogDescription>
              A OS nº {falhaAdicionais?.numeroOS ?? ""} já foi salva, mas {textoAparelhosPerdidos(falhaAdicionais?.entrada.dispositivos.length ?? 0)} se você fechar agora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar aqui</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setFalhaAdicionais(null);
                onOpenChange(false);
              }}
            >
              Fechar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
