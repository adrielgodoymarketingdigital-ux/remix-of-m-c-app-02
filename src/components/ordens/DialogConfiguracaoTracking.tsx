import { useState, useEffect } from "react";
import { RadioTower, Save, Eye, RotateCcw, Smartphone, Wrench, CheckCircle2, DollarSign, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { TrackingPageConfig, TRACKING_CONFIG_PADRAO } from "@/types/configuracao-loja";
import { supabase } from "@/integrations/supabase/client";

interface DialogConfiguracaoTrackingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESETS = [
  { label: "Dark Blue", fundo: "#0a0f1e", card: "#111827", primaria: "#3b82f6", texto: "#ffffff", secundario: "#94a3b8" },
  { label: "Dark Green", fundo: "#071a0f", card: "#0d1f16", primaria: "#22c55e", texto: "#ffffff", secundario: "#86efac" },
  { label: "Dark Purple", fundo: "#0f0a1e", card: "#1a1133", primaria: "#a855f7", texto: "#ffffff", secundario: "#c4b5fd" },
  { label: "Dark Amber", fundo: "#1a0f00", card: "#1f1500", primaria: "#f59e0b", texto: "#ffffff", secundario: "#fcd34d" },
  { label: "Slate Clean", fundo: "#0f172a", card: "#1e293b", primaria: "#64748b", texto: "#f1f5f9", secundario: "#94a3b8" },
  { label: "Branco", fundo: "#f8fafc", card: "#ffffff", primaria: "#3b82f6", texto: "#0f172a", secundario: "#64748b" },
];

export function DialogConfiguracaoTracking({ open, onOpenChange }: DialogConfiguracaoTrackingProps) {
  const { config, atualizarConfiguracao } = useConfiguracaoLoja();
  const [cfg, setCfg] = useState<TrackingPageConfig>(TRACKING_CONFIG_PADRAO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const coresPersonalizadas = (config as any)?.cores_personalizadas as Record<string, unknown> | null;
    const saved = coresPersonalizadas?.tracking_config as TrackingPageConfig | undefined;
    if (saved) {
      setCfg({ ...TRACKING_CONFIG_PADRAO, ...saved });
    } else {
      setCfg(TRACKING_CONFIG_PADRAO);
    }
  }, [config]);

  const set = (key: keyof TrackingPageConfig, value: string | boolean) =>
    setCfg((prev) => ({ ...prev, [key]: value }));

  const aplicarPreset = (p: typeof PRESETS[0]) =>
    setCfg((prev) => ({ ...prev, cor_fundo: p.fundo, cor_card: p.card, cor_primaria: p.primaria, cor_texto: p.texto, cor_texto_secundario: p.secundario }));

  const resetar = () => setCfg(TRACKING_CONFIG_PADRAO);

  const salvar = async () => {
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("não autenticado");

      // Lê o valor atual do banco para não apagar outros campos do objeto
      const { data: atual } = await supabase
        .from("configuracoes_loja")
        .select("cores_personalizadas")
        .eq("user_id", user.id)
        .single();

      const coresAtuais = (atual?.cores_personalizadas as Record<string, unknown>) || {};

      const { error } = await supabase
        .from("configuracoes_loja")
        .update({ cores_personalizadas: { ...coresAtuais, tracking_config: cfg } })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Configurações da página de acompanhamento salvas!");
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const primRgb = hexToRgb(cfg.cor_primaria);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <RadioTower className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Personalizar Página de Acompanhamento</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Configure cores, logo e informações exibidas para o cliente ao acompanhar a OS.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row gap-0 min-h-0">
          {/* Painel de controles */}
          <div className="lg:w-72 xl:w-80 shrink-0 border-r border-border/40 overflow-y-auto">
            <div className="p-5 space-y-5">

              {/* Presets */}
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3 block">
                  Temas Rápidos
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => aplicarPreset(p)}
                      className="group relative rounded-lg overflow-hidden border-2 border-transparent hover:border-primary/50 transition-all"
                      title={p.label}
                    >
                      <div className="h-10 w-full" style={{ background: p.fundo }}>
                        <div className="absolute bottom-0 left-0 right-0 h-3" style={{ background: p.card }} />
                        <div className="absolute top-1.5 left-1.5 h-1.5 w-1.5 rounded-full" style={{ background: p.primaria }} />
                      </div>
                      <span className="block text-[9px] text-center text-muted-foreground pt-1 pb-0.5 leading-none">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Cores */}
              <div className="space-y-3">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 block">
                  Cores
                </Label>
                <ColorField label="Fundo da página" value={cfg.cor_fundo} onChange={(v) => set("cor_fundo", v)} />
                <ColorField label="Fundo do card" value={cfg.cor_card} onChange={(v) => set("cor_card", v)} />
                <ColorField label="Cor de destaque" value={cfg.cor_primaria} onChange={(v) => set("cor_primaria", v)} />
                <ColorField label="Texto principal" value={cfg.cor_texto} onChange={(v) => set("cor_texto", v)} />
                <ColorField label="Texto secundário" value={cfg.cor_texto_secundario} onChange={(v) => set("cor_texto_secundario", v)} />
              </div>

              <Separator />

              {/* Visibilidade */}
              <div className="space-y-3">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 block">
                  Informações Visíveis
                </Label>
                <ToggleField label="Logo da loja" value={cfg.mostrar_logo} onChange={(v) => set("mostrar_logo", v)} />
                <ToggleField label="Valor do serviço" value={cfg.mostrar_valor} onChange={(v) => set("mostrar_valor", v)} />
                <ToggleField label="Defeito relatado" value={cfg.mostrar_defeito} onChange={(v) => set("mostrar_defeito", v)} />
              </div>

              <Separator />

              {/* Mensagem de rodapé */}
              <div>
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2 block">
                  Mensagem de Rodapé
                </Label>
                <Input
                  placeholder="Ex: Obrigado pela preferência!"
                  value={cfg.mensagem_rodape || ""}
                  onChange={(e) => set("mensagem_rodape", e.target.value)}
                  className="h-8 text-xs"
                  maxLength={80}
                />
                <p className="text-[10px] text-muted-foreground/50 mt-1">{(cfg.mensagem_rodape || "").length}/80 caracteres</p>
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={resetar} className="gap-1.5 text-xs flex-1">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Resetar
                </Button>
                <Button size="sm" onClick={salvar} disabled={salvando} className="gap-1.5 text-xs flex-1">
                  <Save className="h-3.5 w-3.5" />
                  {salvando ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border/40 bg-muted/20">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Preview — como o cliente verá</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-start justify-center" style={{ background: "#18181b" }}>
              <TrackingPreview cfg={cfg} loja={config} primRgb={primRgb} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Preview inline ──────────────────────────────────────────────────

interface PreviewProps {
  cfg: TrackingPageConfig;
  loja: { nome_loja?: string; logo_url?: string; telefone?: string } | null;
  primRgb: string;
}

function TrackingPreview({ cfg, loja, primRgb }: PreviewProps) {
  const etapas = ["Recebida", "Em Reparo", "Pronto", "Entregue"];
  const etapaAtual = 2;

  return (
    <div
      className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: `radial-gradient(ellipse at 50% 0%, ${cfg.cor_fundo}dd 0%, ${cfg.cor_fundo} 70%)` }}
    >
      {/* Badge tempo real */}
      <div className="flex justify-center pt-5 pb-3">
        <div className="flex items-center gap-2 rounded-full px-3 py-1 border"
          style={{ background: `${cfg.cor_primaria}15`, borderColor: `${cfg.cor_primaria}30` }}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: cfg.cor_primaria }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: cfg.cor_primaria }} />
          </span>
          <span className="text-[10px] font-medium" style={{ color: cfg.cor_primaria }}>Atualização em tempo real</span>
        </div>
      </div>

      {/* Card */}
      <div className="mx-3 mb-5 rounded-2xl overflow-hidden border"
        style={{ background: cfg.cor_card, borderColor: `${cfg.cor_primaria}25`, boxShadow: `0 0 40px ${cfg.cor_primaria}18` }}>

        {/* Barra colorida topo */}
        <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${cfg.cor_primaria}, ${cfg.cor_primaria}55)` }} />

        <div className="p-5">
          {/* Header loja */}
          {cfg.mostrar_logo && (
            <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: `1px solid ${cfg.cor_primaria}15` }}>
              {loja?.logo_url ? (
                <img src={loja.logo_url} alt="" className="h-12 w-12 rounded-xl object-contain p-1"
                  style={{ background: `${cfg.cor_primaria}18`, border: `1px solid ${cfg.cor_primaria}30` }} />
              ) : (
                <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${cfg.cor_primaria}18`, border: `1px solid ${cfg.cor_primaria}30` }}>
                  <Wrench className="h-5 w-5" style={{ color: cfg.cor_primaria }} />
                </div>
              )}
              <div>
                <p className="font-bold text-sm leading-tight" style={{ color: cfg.cor_texto }}>{loja?.nome_loja || "Assistência Técnica"}</p>
                {loja?.telefone && <p className="text-[11px] mt-0.5" style={{ color: cfg.cor_texto_secundario }}>{loja.telefone}</p>}
              </div>
            </div>
          )}

          {/* Número OS + Status */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: cfg.cor_texto_secundario }}>Ordem de Serviço</p>
              <h2 className="text-4xl font-black leading-none" style={{ color: cfg.cor_texto }}>#1042</h2>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold"
              style={{ color: cfg.cor_primaria, borderColor: `${cfg.cor_primaria}40`, background: `${cfg.cor_primaria}12` }}>
              <Wrench className="h-3 w-3" />
              Em Reparo
            </div>
          </div>

          {/* Timeline */}
          <div className="mb-5">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 right-0 top-3.5 h-px" style={{ background: `${cfg.cor_texto_secundario}20` }} />
              <div className="absolute left-0 top-3.5 h-px transition-all" style={{ width: "50%", background: `linear-gradient(90deg, ${cfg.cor_primaria}, ${cfg.cor_primaria}80)` }} />
              {etapas.map((e, i) => {
                const concluida = etapaAtual > i + 1;
                const atual = etapaAtual === i + 1;
                return (
                  <div key={e} className="flex flex-col items-center gap-1 z-10">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center transition-all"
                      style={concluida || atual
                        ? { background: cfg.cor_primaria, boxShadow: atual ? `0 0 8px ${cfg.cor_primaria}` : "none" }
                        : { background: "#1e293b", border: "1px solid #334155" }
                      }>
                      {concluida
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        : atual
                          ? <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                          : <div className="h-2 w-2 rounded-full" style={{ background: cfg.cor_texto_secundario + "40" }} />
                      }
                    </div>
                    <span className="text-[8px] text-center leading-tight max-w-[40px]"
                      style={{ color: atual ? cfg.cor_texto : concluida ? cfg.cor_texto_secundario : cfg.cor_texto_secundario + "60", fontWeight: atual ? 600 : 400 }}>
                      {e}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-4" style={{ borderTop: `1px solid ${cfg.cor_primaria}12` }} />

          {/* Infos */}
          <div className="space-y-2.5">
            <InfoRow icon={<Smartphone className="h-3.5 w-3.5" />} label="Dispositivo" value="Samsung Galaxy A54" cfg={cfg} />
            {cfg.mostrar_defeito && <InfoRow icon={<Wrench className="h-3.5 w-3.5" />} label="Problema" value="Tela trincada, não liga" cfg={cfg} />}
            {cfg.mostrar_valor && <InfoRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Valor" value="R$ 250,00" cfg={cfg} bold />}
            <InfoRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Entrada" value="05/05/2025" cfg={cfg} />
          </div>

          <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: `1px solid ${cfg.cor_primaria}12` }}>
            <span className="text-[9px]" style={{ color: cfg.cor_texto_secundario + "80" }}>Atualizado agora</span>
            <span className="text-[9px] font-medium" style={{ color: cfg.cor_primaria }}>● Ao vivo</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-[10px] pb-4 px-4" style={{ color: cfg.cor_texto_secundario + "60" }}>
        {cfg.mensagem_rodape || "Powered by Méc App"}
      </p>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, cfg, bold }: { icon: React.ReactNode; label: string; value: string; cfg: TrackingPageConfig; bold?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: cfg.cor_texto_secundario + "10", color: cfg.cor_texto_secundario }}>
        {icon}
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider" style={{ color: cfg.cor_texto_secundario + "80" }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: bold ? cfg.cor_primaria : cfg.cor_texto, fontWeight: bold ? 700 : 400 }}>{value}</p>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs text-muted-foreground flex-1 leading-none">{label}</Label>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="relative h-7 w-7 rounded-md border border-border/60 overflow-hidden cursor-pointer">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
          <div className="w-full h-full rounded-md" style={{ background: value }} />
        </div>
        <Input value={value} onChange={(e) => onChange(e.target.value)}
          className="h-7 w-24 text-xs font-mono px-2" maxLength={7} />
      </div>
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-foreground/80">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function hexToRgb(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "59 130 246";
  return `${parseInt(c.slice(0, 2), 16)} ${parseInt(c.slice(2, 4), 16)} ${parseInt(c.slice(4, 6), 16)}`;
}
