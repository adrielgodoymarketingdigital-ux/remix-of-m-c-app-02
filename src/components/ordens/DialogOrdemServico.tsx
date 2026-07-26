import { Loader2, ChevronRight } from "lucide-react";
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
}

const TOTAL_ETAPAS: EtapaWizard = 7;

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
  const { funcionarioId, lojaUserId, isFuncionario, permissoes, isDonoLoja, tecnicoObrigatorioOS } = useFuncionarioPermissoes();
  const { empresaAtiva: empresaAtivaCtx, isProprietario } = useEmpresa();
  const { empresaId: empresaInfoId, isFilial: isFilialCtx } = useEmpresaInfo();
  const { temAcessoModulo } = useAssinatura();
  const navigate = useNavigate();
  const podeVerTecnicos = isDonoLoja || (permissoes?.recursos?.ver_tecnicos_os ?? false);
  const { funcionarios } = useFuncionarios();
  const { tiposServico, criar: criarTipoServico } = useTiposServico();
  const { taxasAtivas, calcularTaxa } = useTaxasCartao();
  const { localizacoes } = useLocalizacoesOS();

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
  } = useOrdemServicoWizardState({ open, ordem, isFuncionario, lojaUserId, isFilialCtx, empresaInfoId });

  const irParaEtapa = (etapa: EtapaWizard) => {
    if (etapa <= etapaMaximaAlcancada) {
      setCampoComErro(null);
      setEtapaAtual(etapa);
    }
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
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl sm:max-w-3xl lg:max-w-5xl h-[92dvh] sm:h-[96dvh] p-0 gap-0 overflow-hidden flex flex-col rounded-3xl bg-muted/30 [&>button]:h-9 [&>button]:w-9 [&>button]:rounded-full [&>button]:bg-background [&>button]:opacity-100 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:top-4 [&>button]:right-4 [&>button]:shadow-sm">
        <div className="shrink-0 px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
          <div className="bg-background rounded-2xl shadow-sm px-4 py-3 sm:px-5">
            <DialogHeader className="mb-2.5">
              <DialogTitle className="text-lg sm:text-xl font-bold">
                {ordem ? `Editar Ordem de Serviço — OS ${ordem.numero_os}` : "Nova Ordem de Serviço"}
              </DialogTitle>
            </DialogHeader>
            <OrdemServicoWizardProgresso
              etapaAtual={etapaAtual}
              etapaMaximaAlcancada={etapaMaximaAlcancada}
              onEtapaClick={irParaEtapa}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 sm:px-6">
          <div className="bg-background rounded-2xl shadow-sm p-4 sm:p-5">
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
              tecnicosOS={tecnicosOS}
              setTecnicosOS={setTecnicosOS}
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
            <EtapaServicosProdutos formData={formData} setFormData={setFormData} />
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
          </div>
        </div>

        <div className="shrink-0 px-4 py-3 sm:px-6 sm:py-4 flex flex-row justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={etapaAtual === 1 ? () => onOpenChange(false) : voltarEtapa}
            disabled={loading}
            className="rounded-full px-6"
          >
            {etapaAtual === 1 ? "Cancelar" : "Anterior"}
          </Button>
          {etapaAtual < TOTAL_ETAPAS ? (
            <Button type="button" onClick={tentarAvancar} disabled={loading} className="rounded-full px-6 gap-1.5">
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSalvar} disabled={loading} className="rounded-full px-6">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
