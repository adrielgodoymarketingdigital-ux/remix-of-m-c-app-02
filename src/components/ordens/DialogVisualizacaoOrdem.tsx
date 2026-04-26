import { useState } from "react";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPhone, formatCPF, formatDateTime } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { AvariasOS, AvariaVisual } from "@/types/ordem-servico";
import { SilhuetaComAvarias } from "./SilhuetaComAvarias";
import { PatternLockVisualizacao } from "./PatternLockVisualizacao";
import { DialogAssinaturaSaida } from "./DialogAssinaturaSaida";
import { DialogEnviarWhatsApp } from "./DialogEnviarWhatsApp";
import { User, Smartphone, CheckCircle2, XCircle, PenTool, MessageSquare, Camera } from "lucide-react";
import { checklistIcons } from "@/lib/checklist-icons";
import { decryptSenhaDesbloqueio } from "@/lib/password-encryption";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";

interface DialogVisualizacaoOrdemProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico | null;
  onSuccess?: () => void;
}

export const DialogVisualizacaoOrdem = ({ open, onOpenChange, ordem, onSuccess }: DialogVisualizacaoOrdemProps) => {
  const [dialogAssinaturaSaidaAberto, setDialogAssinaturaSaidaAberto] = useState(false);
  const [dialogWhatsAppAberto, setDialogWhatsAppAberto] = useState(false);
  const { config: configuracaoLoja } = useConfiguracaoLoja();

  if (!ordem) return null;

  const avariasData = ordem.avarias as AvariasOS | null;
  const checklistEntrada = avariasData?.checklist?.entrada || {};
  const checklistSaida = avariasData?.checklist?.saida || {};
  const avariasVisuais = (avariasData?.avarias_visuais || []) as AvariaVisual[];
  const senhaDesbloqueio = decryptSenhaDesbloqueio(avariasData?.senha_desbloqueio);
  const assinaturas = avariasData?.assinaturas;
  const fotosDispositivo = avariasData?.fotos_dispositivo || [];

  const handleAssinaturaSaidaSuccess = () => {
    setDialogAssinaturaSaidaAberto(false);
    // Fechar o dialog de visualização também para forçar refresh dos dados
    onOpenChange(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  const handleEnviarWhatsApp = () => {
    setDialogWhatsAppAberto(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl pb-20 sm:pb-6 no-print" data-print-hide="true">
        <DialogHeader>
          <DialogTitle>Ordem de Serviço #{ordem.numero_os}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="cliente" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto gap-1">
            <TabsTrigger value="cliente" className="gap-1 text-xs sm:text-sm">
              <User className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Cliente</span>
            </TabsTrigger>
            <TabsTrigger value="dispositivo" className="gap-1 text-xs sm:text-sm">
              <Smartphone className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Dispositivo</span>
            </TabsTrigger>
            <TabsTrigger value="fotos" className="gap-1 text-xs sm:text-sm">
              <Camera className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Fotos</span>
              {fotosDispositivo.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {fotosDispositivo.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="entrada" className="gap-1 text-xs sm:text-sm">
              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Entrada</span>
            </TabsTrigger>
            <TabsTrigger value="saida" className="gap-1 text-xs sm:text-sm">
              <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Saída</span>
            </TabsTrigger>
            <TabsTrigger value="assinaturas" className="gap-1 text-xs sm:text-sm">
              <PenTool className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Assinaturas</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Cliente */}
          <TabsContent value="cliente" className="space-y-4 mt-4">
            <div>
              <h3 className="text-lg font-semibold mb-3">Dados do Cliente</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Nome:</span>
                  <p className="text-muted-foreground">{ordem.cliente?.nome || "N/A"}</p>
                </div>
                <div>
                  <span className="font-medium">Telefone:</span>
                  <p className="text-muted-foreground">
                    {ordem.cliente?.telefone ? formatPhone(ordem.cliente.telefone) : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="font-medium">CPF:</span>
                  <p className="text-muted-foreground">
                    {ordem.cliente?.cpf ? formatCPF(ordem.cliente.cpf) : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="font-medium">Endereço:</span>
                  <p className="text-muted-foreground">{ordem.cliente?.endereco || "N/A"}</p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-3">Informações do Serviço</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Data de Abertura:</span>
                  <p className="text-muted-foreground">{formatDate(ordem.created_at)}</p>
                </div>
                <div>
                  <span className="font-medium">Defeito Relatado:</span>
                  <p className="text-muted-foreground">{ordem.defeito_relatado}</p>
                </div>
                {avariasData?.observacoes_internas && (
                  <div className="bg-muted/50 border border-dashed rounded-lg p-3">
                    <span className="font-medium text-amber-600 dark:text-amber-400">📝 Observações Internas:</span>
                    <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{avariasData.observacoes_internas}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1 italic">Não aparece na impressão</p>
                  </div>
                )}
                <div>
                  <span className="font-medium">Valor Total:</span>
                  <ValorMonetario valor={ordem.total || 0} tipo="preco" className="text-lg font-semibold text-primary" />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab: Dispositivo */}
          <TabsContent value="dispositivo" className="space-y-4 mt-4">
            <div>
              <h3 className="text-lg font-semibold mb-3">Dados do Dispositivo</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Tipo:</span>
                  <p className="text-muted-foreground">{ordem.dispositivo_tipo}</p>
                </div>
                <div>
                  <span className="font-medium">Marca:</span>
                  <p className="text-muted-foreground">{ordem.dispositivo_marca}</p>
                </div>
                <div>
                  <span className="font-medium">Modelo:</span>
                  <p className="text-muted-foreground">{ordem.dispositivo_modelo}</p>
                </div>
                <div>
                  <span className="font-medium">Cor:</span>
                  <p className="text-muted-foreground">{ordem.dispositivo_cor || "N/A"}</p>
                </div>
                <div>
                  <span className="font-medium">IMEI:</span>
                  <p className="text-muted-foreground">{ordem.dispositivo_imei || "N/A"}</p>
                </div>
                <div>
                  <span className="font-medium">Nº Série:</span>
                  <p className="text-muted-foreground">
                    {ordem.dispositivo_numero_serie || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-3">Senha de Desbloqueio</h3>
              {senhaDesbloqueio ? (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Tipo:</span>
                    <p className="text-muted-foreground capitalize">
                      {senhaDesbloqueio.tipo === "numero" && "PIN Numérico"}
                      {senhaDesbloqueio.tipo === "letra" && "Senha Texto"}
                      {senhaDesbloqueio.tipo === "padrao" && "Padrão Android"}
                    </p>
                  </div>
                  {senhaDesbloqueio.tipo !== 'padrao' && (
                    <div>
                      <span className="font-medium">Senha:</span>
                      <p className="text-muted-foreground font-mono">
                        {senhaDesbloqueio.valor || "N/A"}
                      </p>
                    </div>
                  )}
                  {senhaDesbloqueio.tipo === 'padrao' && senhaDesbloqueio.padrao && (
                    <div className="space-y-2">
                      <PatternLockVisualizacao 
                        pattern={senhaDesbloqueio.padrao} 
                        size={100} 
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma senha registrada</p>
              )}
            </div>
          </TabsContent>

          {/* Tab: Fotos */}
          <TabsContent value="fotos" className="space-y-4 mt-4">
            <div>
              <h3 className="text-lg font-semibold mb-3">Fotos do Dispositivo</h3>
              {fotosDispositivo.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {fotosDispositivo.map((url, index) => (
                    <div key={index} className="relative aspect-square">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                        <img
                          src={url}
                          alt={`Foto ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer"
                        />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma foto registrada para este dispositivo
                </p>
              )}
            </div>
          </TabsContent>

          {/* Tab: Entrada */}
          <TabsContent value="entrada" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Coluna 1: Checklist */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Checklist de Entrada</h3>
                {avariasData?.checklist?.sem_teste && (
                  <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-300">
                    <span className="font-medium">⚠️ Sem teste:</span>
                    <span>Aparelho chegou desligado — testes de entrada não realizados.</span>
                  </div>
                )}
                {Object.keys(checklistEntrada).length > 0 ? (
                  <div className="grid gap-2">
                    {Object.entries(checklistEntrada).map(([item, status]) => {
                      const Icon = checklistIcons[item] || Smartphone;
                      return (
                        <div key={item}>
                          <div className="flex items-center gap-2 text-sm">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1 capitalize">{item.replace(/_/g, " ")}</span>
                            {status ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                          {item === 'peca_trocada' && status && avariasData?.checklist?.peca_trocada_descricao_entrada && (
                            <p className="text-xs text-muted-foreground italic pl-6">
                              Peça: {avariasData.checklist.peca_trocada_descricao_entrada}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  !avariasData?.checklist?.sem_teste && (
                    <p className="text-sm text-muted-foreground">Nenhum checklist registrado</p>
                  )
                )}
              </div>

              {/* Coluna 2: Silhuetas com Avarias */}
              {avariasVisuais.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Avarias Visuais</h3>
                  <div className="space-y-4">
                    {avariasVisuais.filter(a => a.lado === 'frente').length > 0 && (
                      <SilhuetaComAvarias
                        tipoDispositivo={ordem.dispositivo_tipo}
                        subtipoRelogio={(avariasData as any)?.dispositivo_subtipo}
                        lado="frente"
                        avarias={avariasVisuais.filter(a => a.lado === 'frente')}
                      />
                    )}
                    {avariasVisuais.filter(a => a.lado === 'traseira').length > 0 && (
                      <SilhuetaComAvarias
                        tipoDispositivo={ordem.dispositivo_tipo}
                        subtipoRelogio={(avariasData as any)?.dispositivo_subtipo}
                        lado="traseira"
                        avarias={avariasVisuais.filter(a => a.lado === 'traseira')}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Saída */}
          <TabsContent value="saida" className="space-y-4 mt-4">
            <div>
              <h3 className="text-lg font-semibold mb-3">Checklist de Saída</h3>
              {Object.keys(checklistSaida).length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(checklistSaida).map(([item, status]) => {
                    const Icon = checklistIcons[item] || Smartphone;
                    return (
                      <div key={item}>
                        <div className="flex items-center gap-2 text-sm">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 capitalize">{item.replace(/_/g, " ")}</span>
                          {status ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        {item === 'peca_trocada' && status && avariasData?.checklist?.peca_trocada_descricao_saida && (
                          <p className="text-xs text-muted-foreground italic pl-6">
                            Peça: {avariasData.checklist.peca_trocada_descricao_saida}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum checklist de saída registrado</p>
              )}
            </div>
          </TabsContent>

          {/* Tab: Assinaturas */}
          <TabsContent value="assinaturas" className="space-y-4 mt-4">
            <div>
              <h3 className="text-lg font-semibold mb-3">Assinaturas Digitais</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                {/* Assinatura de Entrada */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium">Assinatura de Entrada</span>
                    {assinaturas?.cliente_entrada ? (
                      <Badge className="bg-green-500">Assinado</Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </div>
                  {assinaturas?.cliente_entrada ? (
                    <div className="space-y-2">
                      <div className="border rounded-lg p-2 bg-muted/20">
                        <img 
                          src={assinaturas.cliente_entrada} 
                          alt="Assinatura de Entrada" 
                          className="max-h-24 mx-auto"
                        />
                      </div>
                      {assinaturas.data_assinatura_entrada && (
                        <p className="text-xs text-muted-foreground text-center">
                          Assinado em: {formatDateTime(assinaturas.data_assinatura_entrada)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma assinatura registrada
                    </p>
                  )}
                </div>

                {/* Assinatura de Saída */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium">Assinatura de Saída</span>
                    {assinaturas?.cliente_saida ? (
                      <Badge className="bg-green-500">Assinado</Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </div>
                  {assinaturas?.cliente_saida ? (
                    <div className="space-y-2">
                      <div className="border rounded-lg p-2 bg-muted/20">
                        <img 
                          src={assinaturas.cliente_saida} 
                          alt="Assinatura de Saída" 
                          className="max-h-24 mx-auto"
                        />
                      </div>
                      {assinaturas.data_assinatura_saida && (
                        <p className="text-xs text-muted-foreground text-center">
                          Assinado em: {formatDateTime(assinaturas.data_assinatura_saida)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Nenhuma assinatura registrada
                      </p>
                      <Button 
                        onClick={() => setDialogAssinaturaSaidaAberto(true)}
                        className="w-full"
                        variant="outline"
                      >
                        <PenTool className="h-4 w-4 mr-2" />
                        Inserir Assinatura de Saída
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 mt-6 flex-col sm:flex-row">
          <Button 
            variant="outline" 
            onClick={handleEnviarWhatsApp}
            className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            <MessageSquare className="h-4 w-4" />
            Enviar via WhatsApp
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>

      <DialogAssinaturaSaida
        open={dialogAssinaturaSaidaAberto}
        onOpenChange={setDialogAssinaturaSaidaAberto}
        ordem={ordem}
        onSuccess={handleAssinaturaSaidaSuccess}
      />

      <DialogEnviarWhatsApp
        open={dialogWhatsAppAberto}
        onOpenChange={setDialogWhatsAppAberto}
        ordem={ordem}
        loja={configuracaoLoja || undefined}
      />
    </Dialog>
  );
};
