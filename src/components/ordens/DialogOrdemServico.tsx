import { Loader2, ChevronRight, ChevronLeft, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

import { useOrdemServicoWizardState } from "./ordem-servico-wizard/useOrdemServicoWizardState";
import { validarEtapa } from "./ordem-servico-wizard/useOrdemServicoWizardValidacao";
import { salvarOrdemServico } from "./ordem-servico-wizard/handleSubmitOrdemServico";
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
  const { funcionarioId, lojaUserId, isFuncionario, permissoes, isDonoLoja, tecnicoObrigatorioOS, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const { empresaAtiva: empresaAtivaCtx, isProprietario } = useEmpresa();
  const { empresaId: empresaInfoId, isFilial: isFilialCtx } = useEmpresaInfo();
  const { temAcessoModulo } = useAssinatura();
  const navigate = useNavigate();
  const podeVerTecnicos = isDonoLoja || (permissoes?.recursos?.ver_tecnicos_os ?? false);
  const { funcionarios } = useFuncionarios();
  const { tiposServico, criar: criarTipoServico } = useTiposServico();
  const { taxasAtivas, calcularTaxa } = useTaxasCartao();
  const { localizacoes } = useLocalizacoesOS();
  const modoUnico = useIsPwaMobile();

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
    buscarClientes,
    selecionarCliente,
    handleClienteNomeChange,
    handleClienteCPFChange,
    handleBuscarCEPOS,
  } = useOrdemServicoWizardState({ open, ordem, isFuncionario, lojaUserId, isFilialCtx, empresaInfoId, carregandoPermissoes });

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
    try {
      await salvarOrdemServico({
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
      });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                />
              </EtapaCardWrapper>

              <EtapaCardWrapper dataEtapa={5}>
                <EtapaChecklistAvarias formData={formData} setFormData={setFormData} />
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
            <EtapaDispositivo
              formData={formData}
              setFormData={setFormData}
              campoComErro={campoComErro}
            />
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
            />
          )}

          {etapaAtual === 5 && (
            <EtapaChecklistAvarias formData={formData} setFormData={setFormData} />
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
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  className="gap-1.5 sm:h-10 sm:px-4 sm:text-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={tentarSalvarModoUnico} disabled={loading} className="sm:h-10 sm:px-4 sm:text-sm">
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
                  onClick={etapaAtual === 1 ? () => onOpenChange(false) : voltarEtapa}
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
                  <Button type="button" size="sm" onClick={tentarSalvarWizard} disabled={loading} className="sm:h-10 sm:px-4 sm:text-sm">
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
    </Dialog>
  );
};
