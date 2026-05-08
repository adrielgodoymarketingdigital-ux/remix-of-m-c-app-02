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
  MessageSquare, Camera, Hash, Calendar, Clock,
  MapPin, Phone, CreditCard, Wrench, Lock, FileText,
  RadioTower, Copy, ExternalLink, Loader2,
} from "lucide-react";
import { checklistIcons } from "@/lib/checklist-icons";
import { decryptSenhaDesbloqueio } from "@/lib/password-encryption";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useOSStatusConfig } from "@/hooks/useOSStatusConfig";
import { useOSTracking } from "@/hooks/useOSTracking";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DialogVisualizacaoOrdemProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico | null;
  onSuccess?: () => void;
}

export const DialogVisualizacaoOrdem = ({ open, onOpenChange, ordem, onSuccess }: DialogVisualizacaoOrdemProps) => {
  const [dialogAssinaturaSaidaAberto, setDialogAssinaturaSaidaAberto] = useState(false);
  const [dialogWhatsAppAberto, setDialogWhatsAppAberto] = useState(false);
  const [linkAcompanhamento, setLinkAcompanhamento] = useState<string | null>(null);
  const { config: configuracaoLoja } = useConfiguracaoLoja();
  const { statusList } = useOSStatusConfig();
  const { gerarLink, gerando } = useOSTracking();

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

  const handleAssinaturaSaidaSuccess = () => {
    setDialogAssinaturaSaidaAberto(false);
    onOpenChange(false);
    onSuccess?.();
  };

  const handleGerarLink = async () => {
    if (linkAcompanhamento) return;
    const link = await gerarLink(ordem.id);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-4xl pb-safe sm:pb-4 no-print p-0 gap-0 overflow-hidden" data-print-hide="true">

        {/* Header */}
        <div className="relative px-3 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-border/40 bg-gradient-to-r from-muted/30 to-background overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="absolute top-0 left-0 w-32 h-32 opacity-5 rounded-full bg-primary blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Ordem de Serviço</span>
                </div>
                <h2 className="text-xl font-black font-mono tracking-tight">#{ordem.numero_os}</h2>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 mt-1">
              <span
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border"
                style={{ color: statusCor, borderColor: `${statusCor}40`, backgroundColor: `${statusCor}12` }}
              >
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: statusCor }} />
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Meta linha rápida */}
          <div className="relative flex items-center gap-4 mt-3 text-[11px] text-muted-foreground font-mono flex-wrap">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {ordem.cliente?.nome || "—"}
            </span>
            <span className="flex items-center gap-1">
              <Smartphone className="h-3 w-3" />
              {ordem.dispositivo_marca} {ordem.dispositivo_modelo}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(ordem.created_at)}
            </span>
            <span className="flex items-center gap-1 font-semibold text-primary">
              <ValorMonetario valor={ordem.total || 0} tipo="preco" />
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-3 sm:px-5 pt-4 overflow-y-auto max-h-[52vh] sm:max-h-[60vh]">
          <Tabs defaultValue="cliente" className="w-full">
            <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 h-8 mb-4 bg-muted/40 border border-border/40 p-0.5 rounded-lg">
              {[
                { value: "cliente", icon: User, label: "Cliente" },
                { value: "dispositivo", icon: Smartphone, label: "Dispositivo" },
                { value: "fotos", icon: Camera, label: "Fotos", badge: fotosDispositivo.length },
                { value: "entrada", icon: CheckCircle2, label: "Entrada" },
                { value: "saida", icon: XCircle, label: "Saída" },
                { value: "assinaturas", icon: PenTool, label: "Assin." },
                { value: "rastrear", icon: RadioTower, label: "Tempo Real" },
              ].map(({ value, icon: Icon, label, badge }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="gap-1 text-[11px] h-7 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground transition-all"
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                  {badge && badge > 0 ? (
                    <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{badge}</span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Tab Cliente ── */}
            <TabsContent value="cliente" className="space-y-4 mt-0">
              <Section title="Cliente" icon={<User className="h-3.5 w-3.5" />}>
                <InfoGrid>
                  <InfoItem icon={<User className="h-3 w-3" />} label="Nome" value={ordem.cliente?.nome} />
                  <InfoItem icon={<Phone className="h-3 w-3" />} label="Telefone" value={ordem.cliente?.telefone ? formatPhone(ordem.cliente.telefone) : undefined} />
                  <InfoItem icon={<CreditCard className="h-3 w-3" />} label="CPF" value={ordem.cliente?.cpf ? formatCPF(ordem.cliente.cpf) : undefined} />
                  <InfoItem icon={<MapPin className="h-3 w-3" />} label="Endereço" value={ordem.cliente?.endereco} />
                </InfoGrid>
              </Section>

              <Section title="Serviço" icon={<Wrench className="h-3.5 w-3.5" />}>
                <InfoGrid>
                  <InfoItem icon={<Calendar className="h-3 w-3" />} label="Abertura" value={`${formatDate(ordem.created_at)} ${formatTime(ordem.created_at)}`} mono />
                  <InfoItem icon={<Hash className="h-3 w-3" />} label="OS" value={`#${ordem.numero_os}`} mono />
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
              </Section>
            </TabsContent>

            {/* ── Tab Dispositivo ── */}
            <TabsContent value="dispositivo" className="space-y-4 mt-0">
              <Section title="Dispositivo" icon={<Smartphone className="h-3.5 w-3.5" />}>
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
            <TabsContent value="fotos" className="mt-0">
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
            <TabsContent value="entrada" className="mt-0">
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
            <TabsContent value="saida" className="mt-0">
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
            <TabsContent value="assinaturas" className="mt-0">
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
            <TabsContent value="rastrear" className="mt-0">
              <Section title="Acompanhamento de OS em Tempo Real" icon={<RadioTower className="h-3.5 w-3.5" />}>
                <p className="text-xs text-muted-foreground mb-4">
                  Gere um link público para o cliente acompanhar o status da OS em tempo real, sem precisar fazer login.
                </p>

                {!linkAcompanhamento ? (
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
                        <MessageSquare className="h-3.5 w-3.5" />
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
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-3 border-t border-border/40 bg-muted/10">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogWhatsAppAberto(true)}
            className="gap-1.5 text-xs text-green-600 hover:text-green-700 border-green-500/30 hover:bg-green-500/5"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            WhatsApp
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
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

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 overflow-hidden mb-1">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-muted/20">
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">{children}</div>;
}

function InfoItem({ label, value, icon, mono }: { label: string; value?: string | null; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        {icon && <span className="text-muted-foreground/40">{icon}</span>}
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">{label}</p>
      </div>
      <p className={cn("text-sm text-foreground/80", mono && "font-mono text-xs")}>
        {value || <span className="text-muted-foreground/30">—</span>}
      </p>
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
