import { useState } from "react";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatPhone, formatCPF, formatDateTime, formatTime } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { AvariasOS, AvariaVisual } from "@/types/ordem-servico";
import { SilhuetaComAvarias } from "./SilhuetaComAvarias";
import { PatternLockVisualizacao } from "./PatternLockVisualizacao";
import { DialogAssinaturaSaida } from "./DialogAssinaturaSaida";
import { DialogEnviarWhatsApp } from "./DialogEnviarWhatsApp";
import {
  User, Smartphone, CheckCircle2, XCircle, PenTool,
  Camera, Hash, Calendar, Clock,
  MapPin, Phone, CreditCard, Wrench, Lock, FileText,
  RadioTower, Copy, ExternalLink, Loader2, Package, History,
  X, Pencil, DollarSign,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { checklistIcons } from "@/lib/checklist-icons";
import { decryptSenhaDesbloqueio } from "@/lib/password-encryption";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useOSStatusConfigContext as useOSStatusConfig } from "@/contexts/OSStatusConfigContext";
import { useOSTracking } from "@/hooks/useOSTracking";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DialogVisualizacaoOrdemProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico | null;
  onSuccess?: () => void;
  onEditar?: (ordem: OrdemServico) => void;
}

export const DialogVisualizacaoOrdem = ({ open, onOpenChange, ordem, onSuccess, onEditar }: DialogVisualizacaoOrdemProps) => {
  const [dialogAssinaturaSaidaAberto, setDialogAssinaturaSaidaAberto] = useState(false);
  const [dialogWhatsAppAberto, setDialogWhatsAppAberto] = useState(false);
  const [linkAcompanhamento, setLinkAcompanhamento] = useState<string | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const { config: configuracaoLoja } = useConfiguracaoLoja(ordem?.empresa_id);
  const { statusList } = useOSStatusConfig();
  const { gerarLink, gerando } = useOSTracking();
  const { lojaUserId, podeCompartilharLink } = useFuncionarioPermissoes();

  if (!ordem) return null;

  const avariasData = ordem.avarias as AvariasOS | null;
  const checklistEntrada = avariasData?.checklist?.entrada || {};
  const checklistSaida = avariasData?.checklist?.saida || {};
  const avariasVisuais = (avariasData?.avarias_visuais || []) as AvariaVisual[];
  const senhaDesbloqueio = decryptSenhaDesbloqueio(avariasData?.senha_desbloqueio);
  const assinaturas = avariasData?.assinaturas;
  const fotosDispositivo = avariasData?.fotos_dispositivo || [];

  const statusConfig = statusList.find(s => s.slug === ordem.status);
  const statusCor = statusConfig?.cor || "#eab308";
  const statusLabel = statusConfig?.nome || "Aguardando";

  // Custo de mão de obra: métrica interna/informativa, não altera valor cobrado do
  // cliente nem os cálculos de faturamento/lucro do Dashboard e relatórios.
  const tempoGastoHoras = ordem.tempo_gasto_horas;
  const valorHoraReferencia = configuracaoLoja?.valor_hora_referencia;
  const mostrarCustoMaoDeObra =
    tempoGastoHoras != null && tempoGastoHoras > 0 &&
    valorHoraReferencia != null && valorHoraReferencia > 0;
  const custoMaoDeObra = mostrarCustoMaoDeObra ? tempoGastoHoras * valorHoraReferencia : 0;
  const lucroRealOS = mostrarCustoMaoDeObra ? (ordem.total || 0) - custoMaoDeObra : null;

  const handleAssinaturaSaidaSuccess = () => {
    setDialogAssinaturaSaidaAberto(false);
    onOpenChange(false);
    onSuccess?.();
  };

  const handleGerarLink = async () => {
    if (linkAcompanhamento) return;
    if (!podeCompartilharLink) {
      toast.error("Você não tem permissão para compartilhar o link de acompanhamento");
      return;
    }
    const link = await gerarLink(ordem.id, lojaUserId ?? undefined);
    if (link) setLinkAcompanhamento(link);
  };

  const handleCopiarLink = async () => {
    if (!linkAcompanhamento) return;
    await navigator.clipboard.writeText(linkAcompanhamento);
    toast.success("Link copiado!");
  };

  const handleEnviarLinkWhatsApp = () => {
    if (!linkAcompanhamento) return;
    const celular = (ordem.cliente?.telefone || "").replace(/\D/g, "");
    if (!celular) { toast.error("Cliente sem telefone cadastrado"); return; }
    const msg = encodeURIComponent(
      `Olá ${ordem.cliente?.nome}! Acompanhe sua OS #${ordem.numero_os} em tempo real:\n${linkAcompanhamento}`
    );
    window.open(`https://wa.me/55${celular}?text=${msg}`, "_blank");
  };

  const getLabelAcao = (acao: string) => {
    const labels: Record<string, string> = {
      'STATUS_GARANTIA': '🔄 Status alterado para Em Garantia',
      'UPDATE': '✏️ OS atualizada',
      'CREATE': '📋 OS criada',
      'STATUS': '🔄 Status alterado',
    };
    return labels[acao] || acao;
  };

  const carregarHistorico = async () => {
    if (!ordem?.id) return;
    const { data } = await supabase
      .from('os_audit_log')
      .select('*')
      .eq('os_id', ordem.id)
      .order('created_at', { ascending: false });
    setHistorico(data || []);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!inset-auto !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !w-[calc(100vw-1rem)] !h-[92dvh] !max-w-4xl !rounded-2xl sm:!w-[calc(100vw-2rem)] sm:!h-[90dvh] sm:!max-w-4xl sm:!rounded-2xl no-print p-0 gap-0 overflow-hidden flex flex-col bg-background [&>.absolute.right-4.top-4]:hidden"
        data-print-hide="true"
      >
        <DialogTitle className="sr-only">Ordem de Serviço #{ordem.numero_os}</DialogTitle>

        {/* Alça de arrastar */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="h-1.5 w-10 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Botão fechar isolado */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 sm:right-5 sm:top-5 z-10 h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </button>

        {/* Header */}
        <div className="relative px-3 sm:px-5 pt-1 sm:pt-2 pb-3 sm:pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-start gap-3 pr-12">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Ordem de Serviço</span>
                {(ordem as any).tipo_os === "simplificada" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 font-mono">Simplificada</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black font-mono tracking-tight">#{ordem.numero_os}</h2>
                <span
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border shrink-0"
                  style={{ color: statusCor, borderColor: `${statusCor}40`, backgroundColor: `${statusCor}12` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: statusCor }} />
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Meta chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            <MetaChip icon={<User className="h-3.5 w-3.5" />} value={ordem.cliente?.nome || "—"} />
            <MetaChip icon={<Smartphone className="h-3.5 w-3.5" />} value={`${ordem.dispositivo_marca || ""} ${ordem.dispositivo_modelo || ""}`.trim() || "—"} />
            <MetaChip icon={<Calendar className="h-3.5 w-3.5" />} value={formatDate(ordem.created_at)} />
            <MetaChip icon={<DollarSign className="h-3.5 w-3.5" />} value={<ValorMonetario valor={ordem.total || 0} tipo="preco" />} highlight />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-3 sm:px-5 pt-3 overflow-y-auto flex-1 min-h-0">
          <Tabs
            defaultValue="cliente"
            className="w-full"
            onValueChange={(value) => { if (value === "historico") carregarHistorico(); }}
          >
            <TabsList className="flex w-full h-auto mb-4 bg-transparent border-0 p-0 gap-1 overflow-x-auto scrollbar-hide justify-start sm:justify-between">
              {[
                { value: "cliente", icon: User, label: "Cliente" },
                { value: "dispositivo", icon: Smartphone, label: "Dispositivo" },
                { value: "fotos", icon: Camera, label: "Fotos", badge: fotosDispositivo.length },
                { value: "entrada", icon: CheckCircle2, label: "Entrada" },
                { value: "saida", icon: XCircle, label: "Saída" },
                { value: "assinaturas", icon: PenTool, label: "Assinatura" },
                { value: "rastrear", icon: RadioTower, label: "Tempo" },
                { value: "historico", icon: History, label: "Histórico" },
              ].map(({ value, icon: Icon, label, badge }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="group/tab flex flex-col items-center justify-center gap-1 py-1 px-1.5 h-auto rounded-none bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-all shrink-0"
                >
                  <div className="relative h-8 w-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground transition-colors group-data-[state=active]/tab:bg-primary group-data-[state=active]/tab:text-primary-foreground">
                    <Icon className="h-4 w-4 shrink-0" />
                    {badge && badge > 0 ? (
                      <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center">{badge}</span>
                    ) : null}
                  </div>
                  <span className="text-[10px] font-medium leading-none whitespace-nowrap text-muted-foreground transition-colors group-data-[state=active]/tab:text-foreground group-data-[state=active]/tab:font-semibold">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Tab Cliente ── */}
            <TabsContent value="cliente" className="space-y-4 mt-0 focus-visible:ring-0 focus-visible:outline-none">
              <Section title="Cliente" icon={<User className="h-3.5 w-3.5" />} onEditar={onEditar ? () => onEditar(ordem) : undefined}>
                <InfoGrid>
                  <InfoItem icon={<User className="h-3 w-3" />} label="Nome" value={ordem.cliente?.nome} />
                  <InfoItem icon={<Phone className="h-3 w-3" />} label="Telefone" value={ordem.cliente?.telefone ? formatPhone(ordem.cliente.telefone) : undefined} />
                  <InfoItem icon={<CreditCard className="h-3 w-3" />} label="CPF" value={ordem.cliente?.cpf ? formatCPF(ordem.cliente.cpf) : undefined} />
                  <InfoItem icon={<MapPin className="h-3 w-3" />} label="Endereço" value={ordem.cliente?.endereco} />
                </InfoGrid>
              </Section>

              <Section title="Serviço" icon={<Wrench className="h-3.5 w-3.5" />} onEditar={onEditar ? () => onEditar(ordem) : undefined}>
                <InfoGrid>
                  <InfoItem icon={<Calendar className="h-3 w-3" />} label="Abertura" value={`${formatDate(ordem.created_at)} ${formatTime(ordem.created_at)}`} mono />
                  {ordem.data_saida && (
                    <InfoItem icon={<Calendar className="h-3 w-3" />} label="Entrega" value={`${formatDate(ordem.data_saida)} ${formatTime(ordem.data_saida)}`} mono />
                  )}
                  <InfoItem icon={<Hash className="h-3 w-3" />} label="OS" value={`#${ordem.numero_os}`} mono />
                  {ordem.localizacao_fisica && (
                    <InfoItem icon={<Package className="h-3 w-3" />} label="Localização Física" value={ordem.localizacao_fisica} />
                  )}
                </InfoGrid>
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60 mb-1">Defeito Relatado</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{ordem.defeito_relatado}</p>
                </div>
                {avariasData?.observacoes_internas && (
                  <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-600/80 mb-1">Observações Internas</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{avariasData.observacoes_internas}</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-1 italic">Não aparece na impressão</p>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">Valor Total</span>
                  <span className="text-xl font-black font-mono text-primary">
                    <ValorMonetario valor={ordem.total || 0} tipo="preco" />
                  </span>
                </div>

                {mostrarCustoMaoDeObra && (
                  <div className="mt-2 space-y-1.5 rounded-lg border border-muted-foreground/10 bg-muted/30 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">
                      Mão de obra (informativo)
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Custo de mão de obra ({tempoGastoHoras}h × <ValorMonetario valor={valorHoraReferencia || 0} tipo="preco" />/h)
                      </span>
                      <span className="font-semibold text-foreground/80">
                        <ValorMonetario valor={custoMaoDeObra} tipo="preco" />
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Lucro real</span>
                      <span className="font-bold text-primary">
                        <ValorMonetario valor={lucroRealOS || 0} tipo="preco" />
                      </span>
                    </div>
                  </div>
                )}
              </Section>
            </TabsContent>

            {/* ── Tab Dispositivo ── */}
            <TabsContent value="dispositivo" className="space-y-4 mt-0 focus-visible:ring-0 focus-visible:outline-none">
              <Section title="Dispositivo" icon={<Smartphone className="h-3.5 w-3.5" />} onEditar={onEditar ? () => onEditar(ordem) : undefined}>
                <InfoGrid>
                  <InfoItem label="Tipo" value={ordem.dispositivo_tipo} />
                  <InfoItem label="Marca" value={ordem.dispositivo_marca} />
                  <InfoItem label="Modelo" value={ordem.dispositivo_modelo} />
                  <InfoItem label="Cor" value={ordem.dispositivo_cor} />
                  <InfoItem label="IMEI" value={ordem.dispositivo_imei} mono />
                  <InfoItem label="Nº Série" value={ordem.dispositivo_numero_serie} mono />
                </InfoGrid>
              </Section>

              <Section title="Senha de Desbloqueio" icon={<Lock className="h-3.5 w-3.5" />}>
                {senhaDesbloqueio ? (
                  <div className="space-y-2">
                    <InfoItem label="Tipo" value={
                      senhaDesbloqueio.tipo === "numero" ? "PIN Numérico" :
                      senhaDesbloqueio.tipo === "letra" ? "Senha Texto" : "Padrão Android"
                    } />
                    {senhaDesbloqueio.tipo !== "padrao" && (
                      <InfoItem label="Senha" value={senhaDesbloqueio.valor} mono />
                    )}
                    {senhaDesbloqueio.tipo === "padrao" && senhaDesbloqueio.padrao && (
                      <PatternLockVisualizacao pattern={senhaDesbloqueio.padrao} size={100} />
                    )}
                  </div>
                ) : (
                  <EmptyState label="Nenhuma senha registrada" />
                )}
              </Section>
            </TabsContent>

            {/* ── Tab Fotos ── */}
            <TabsContent value="fotos" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
              <Section title="Fotos do Dispositivo" icon={<Camera className="h-3.5 w-3.5" />}>
                {fotosDispositivo.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {fotosDispositivo.map((url, index) => (
                      <a key={index} href={url} target="_blank" rel="noopener noreferrer"
                        className="relative aspect-square rounded-lg overflow-hidden border border-border/40 hover:border-primary/40 transition-colors group"
                      >
                        <img src={url} alt={`Foto ${index + 1}`}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <EmptyState label="Nenhuma foto registrada" />
                )}
              </Section>
            </TabsContent>

            {/* ── Tab Entrada ── */}
            <TabsContent value="entrada" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
              <div className="grid md:grid-cols-2 gap-4">
                <Section title="Checklist de Entrada" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                  {avariasData?.checklist?.sem_teste && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 mb-3">
                      <span className="font-semibold">Sem teste</span>
                      <span className="text-muted-foreground">Aparelho chegou desligado.</span>
                    </div>
                  )}
                  {Object.keys(checklistEntrada).length > 0 ? (
                    <div className="space-y-1.5">
                      {Object.entries(checklistEntrada).map(([item, status]) => {
                        const Icon = checklistIcons[item] || Smartphone;
                        return (
                          <div key={item}>
                            <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/30 transition-colors">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                              <span className="flex-1 text-xs capitalize">{item.replace(/_/g, " ")}</span>
                              {status ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                              )}
                            </div>
                            {item === "peca_trocada" && status && avariasData?.checklist?.peca_trocada_descricao_entrada && (
                              <p className="text-[10px] text-muted-foreground italic pl-7">
                                {avariasData.checklist.peca_trocada_descricao_entrada}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    !avariasData?.checklist?.sem_teste && <EmptyState label="Nenhum checklist registrado" />
                  )}
                </Section>

                {avariasVisuais.length > 0 && (
                  <Section title="Avarias Visuais" icon={<Smartphone className="h-3.5 w-3.5" />}>
                    <div className="space-y-4">
                      {avariasVisuais.filter(a => a.lado === "frente").length > 0 && (
                        <SilhuetaComAvarias
                          tipoDispositivo={ordem.dispositivo_tipo}
                          subtipoRelogio={(avariasData as any)?.dispositivo_subtipo}
                          lado="frente"
                          avarias={avariasVisuais.filter(a => a.lado === "frente")}
                        />
                      )}
                      {avariasVisuais.filter(a => a.lado === "traseira").length > 0 && (
                        <SilhuetaComAvarias
                          tipoDispositivo={ordem.dispositivo_tipo}
                          subtipoRelogio={(avariasData as any)?.dispositivo_subtipo}
                          lado="traseira"
                          avarias={avariasVisuais.filter(a => a.lado === "traseira")}
                        />
                      )}
                    </div>
                  </Section>
                )}
              </div>
            </TabsContent>

            {/* ── Tab Saída ── */}
            <TabsContent value="saida" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
              <Section title="Checklist de Saída" icon={<XCircle className="h-3.5 w-3.5" />}>
                {Object.keys(checklistSaida).length > 0 ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(checklistSaida).map(([item, status]) => {
                      const Icon = checklistIcons[item] || Smartphone;
                      return (
                        <div key={item}>
                          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/30 transition-colors">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                            <span className="flex-1 text-xs capitalize">{item.replace(/_/g, " ")}</span>
                            {status ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                            )}
                          </div>
                          {item === "peca_trocada" && status && avariasData?.checklist?.peca_trocada_descricao_saida && (
                            <p className="text-[10px] text-muted-foreground italic pl-7">
                              {avariasData.checklist.peca_trocada_descricao_saida}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState label="Nenhum checklist de saída registrado" />
                )}
              </Section>
            </TabsContent>

            {/* ── Tab Assinaturas ── */}
            <TabsContent value="assinaturas" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
              <Section title="Assinaturas Digitais" icon={<PenTool className="h-3.5 w-3.5" />}>
                <div className="grid md:grid-cols-2 gap-3">
                  {/* Entrada */}
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/20">
                      <span className="text-xs font-semibold">Entrada</span>
                      {assinaturas?.cliente_entrada ? (
                        <span className="text-[10px] font-bold text-green-500 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Assinado
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50">Pendente</span>
                      )}
                    </div>
                    <div className="p-3">
                      {assinaturas?.cliente_entrada ? (
                        <div className="space-y-2">
                          <div className="rounded-lg bg-muted/20 p-2 flex items-center justify-center">
                            <img src={assinaturas.cliente_entrada} alt="Assinatura de Entrada" className="max-h-20" />
                          </div>
                          {assinaturas.data_assinatura_entrada && (
                            <p className="text-[10px] text-muted-foreground/60 text-center font-mono">
                              {formatDateTime(assinaturas.data_assinatura_entrada)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <EmptyState label="Sem assinatura" small />
                      )}
                    </div>
                  </div>

                  {/* Saída */}
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/20">
                      <span className="text-xs font-semibold">Saída</span>
                      {assinaturas?.cliente_saida ? (
                        <span className="text-[10px] font-bold text-green-500 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Assinado
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50">Pendente</span>
                      )}
                    </div>
                    <div className="p-3">
                      {assinaturas?.cliente_saida ? (
                        <div className="space-y-2">
                          <div className="rounded-lg bg-muted/20 p-2 flex items-center justify-center">
                            <img src={assinaturas.cliente_saida} alt="Assinatura de Saída" className="max-h-20" />
                          </div>
                          {assinaturas.data_assinatura_saida && (
                            <p className="text-[10px] text-muted-foreground/60 text-center font-mono">
                              {formatDateTime(assinaturas.data_assinatura_saida)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <EmptyState label="Sem assinatura" small />
                          <Button onClick={() => setDialogAssinaturaSaidaAberto(true)} variant="outline" size="sm" className="w-full h-7 text-xs gap-1.5">
                            <PenTool className="h-3 w-3" />
                            Inserir Assinatura
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Section>
            </TabsContent>
            {/* ── Tab Rastrear ── */}
            <TabsContent value="rastrear" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
              <Section title="Acompanhamento de OS em Tempo Real" icon={<RadioTower className="h-3.5 w-3.5" />}>
                <p className="text-xs text-muted-foreground mb-4">
                  Gere um link público para o cliente acompanhar o status da OS em tempo real, sem precisar fazer login.
                </p>

                {!podeCompartilharLink ? (
                  <p className="text-xs text-muted-foreground italic">
                    Você não tem permissão para compartilhar o link de acompanhamento. Fale com o responsável da loja.
                  </p>
                ) : !linkAcompanhamento ? (
                  <Button
                    onClick={handleGerarLink}
                    disabled={gerando}
                    className="w-full gap-2 os-nova-btn"
                    size="sm"
                  >
                    {gerando ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RadioTower className="h-3.5 w-3.5" />
                    )}
                    {gerando ? "Gerando link..." : "Gerar Link de Acompanhamento"}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    {/* Link gerado */}
                    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                      <RadioTower className="h-3.5 w-3.5 text-primary shrink-0" />
                      <p className="text-xs font-mono text-foreground/70 flex-1 truncate">{linkAcompanhamento}</p>
                      <button
                        onClick={handleCopiarLink}
                        className="shrink-0 p-1 rounded-md hover:bg-primary/10 transition-colors"
                        title="Copiar link"
                      >
                        <Copy className="h-3.5 w-3.5 text-primary" />
                      </button>
                    </div>

                    {/* Ações */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopiarLink}
                        className="gap-1.5 text-xs h-8"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(linkAcompanhamento, "_blank")}
                        className="gap-1.5 text-xs h-8"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Visualizar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleEnviarLinkWhatsApp}
                        className="col-span-2 gap-1.5 text-xs h-8 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <FaWhatsapp className="h-3.5 w-3.5" />
                        Enviar pelo WhatsApp
                      </Button>
                    </div>

                    <p className="text-[10px] text-muted-foreground/50 text-center font-mono">
                      O link permanece ativo enquanto a OS estiver em aberto.
                    </p>
                  </div>
                )}
              </Section>
            </TabsContent>

            {/* ── Tab Histórico ── */}
            <TabsContent value="historico" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
              <Section title="Histórico da OS" icon={<History className="h-3.5 w-3.5" />}>
                {historico.length > 0 ? (
                  <div className="space-y-3">
                    {historico.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div className="w-px flex-1 bg-border mt-1" />
                        </div>
                        <div className="pb-3 flex-1">
                          <p className="text-xs font-medium">{getLabelAcao(item.acao)}</p>
                          {item.dados_depois?.problema_relatado && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Problema: {item.dados_depois.problema_relatado}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState label="Nenhum registro de histórico" />
                )}
              </Section>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="grid grid-cols-2 gap-2 px-3 sm:px-5 py-3 border-t border-border/40 bg-muted/10 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogWhatsAppAberto(true)}
            className="gap-1.5 text-xs h-9 text-green-600 hover:text-green-700 border-green-500/30 hover:bg-green-500/5"
          >
            <FaWhatsapp className="h-3.5 w-3.5" />
            WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-9">
            Fechar
          </Button>
        </div>
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

// ── Sub-componentes de layout ──

function MetaChip({ icon, value, highlight }: { icon: React.ReactNode; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2 min-w-0">
      <span className={cn("shrink-0", highlight ? "text-primary" : "text-muted-foreground/60")}>{icon}</span>
      <span className={cn("text-xs truncate", highlight ? "font-bold text-primary" : "font-medium text-foreground/80")}>{value}</span>
    </div>
  );
}

function Section({ title, icon, children, onEditar }: { title: string; icon?: React.ReactNode; children: React.ReactNode; onEditar?: () => void }) {
  return (
    <div className="rounded-xl border border-border/40 overflow-hidden mb-1">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground/60">{icon}</span>}
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">{title}</span>
        </div>
        {onEditar && (
          <button
            type="button"
            onClick={onEditar}
            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Editar
          </button>
        )}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5">{children}</div>;
}

function InfoItem({ label, value, icon, mono }: { label: string; value?: string | null; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground/60">
        {icon || <FileText className="h-3 w-3" />}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50 mb-0.5">{label}</p>
        <p className={cn("text-sm text-foreground/80 truncate", mono && "font-mono text-xs")}>
          {value || <span className="text-muted-foreground/30">—</span>}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ label, small }: { label: string; small?: boolean }) {
  return (
    <p className={cn("text-center text-muted-foreground/40 font-mono", small ? "text-[10px] py-2" : "text-xs py-6")}>
      {label}
    </p>
  );
}
