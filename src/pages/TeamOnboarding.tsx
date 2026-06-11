import { useState, useEffect, Component } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ChecklistDispositivo } from "@/components/ordens/ChecklistDispositivo";
import { CartaoCheckoutDialog } from "@/components/planos/CartaoCheckoutDialog";
import { PixCheckoutDialog } from "@/components/planos/PixCheckoutDialog";
import { PLANOS } from "@/types/plano";
import { Checklist } from "@/types/ordem-servico";
import {
  ArrowRight,
  Loader2,
  Check,
  CheckCircle2,
  ClipboardList,
  TrendingUp,
  Camera,
  Wrench,
  Smartphone,
  ListChecks,
  Tag,
  Gift,
  Copy,
  Star,
  Zap,
  Shield,
  CreditCard,
  QrCode,
} from "lucide-react";
import logoMec from "@/assets/logo-mec-auth.png";
import fotoDispositivo1 from "@/assets/IMG_4811.JPG";
import fotoDispositivo2 from "@/assets/IMG_4812.JPG";

async function marcarOnboardingCompleto(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from("user_onboarding")
    .upsert(
      {
        user_id: session.user.id,
        onboarding_obrigatorio_completed: true,
        onboarding_obrigatorio_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id" }
    );
  try { sessionStorage.removeItem("mec_verificacao_cache"); } catch {}
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Etapa = "demo" | "criar-os" | "os-pronta" | "cupom";

interface OSTeste {
  marca: string;
  modelo: string;
  defeito: string;
  servico: string;
  custo: number;
  valor: number;
  checklist: Checklist;
}

// ─── Dados fictícios da OS demo ───────────────────────────────────────────────

const OS_DEMO = {
  numero: "OS-0001",
  cliente: "Carlos Andrade",
  marca: "Samsung",
  modelo: "Galaxy A54",
  defeito: "Tela quebrada — não responde ao toque",
  servico: "Troca de Display",
  custo: 85.0,
  valor: 220.0,
  status: "Em andamento",
  fotos: [
    {
      label: "Traseira quebrada",
      url: "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=300&h=400&fit=crop&auto=format",
    },
    {
      label: "Câmera danificada",
      url: "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=300&h=400&fit=crop&auto=format",
    },
    {
      label: "Tela rachada",
      url: "https://images.unsplash.com/photo-1592763124767-e3f842d4a8ed?w=300&h=400&fit=crop&auto=format",
    },
  ],
  checklist: [
    { item: "Tela", ok: true },
    { item: "Alto-falante", ok: true },
    { item: "Microfone", ok: true },
    { item: "Câmera Frontal", ok: true },
    { item: "Câmera Traseira", ok: true },
    { item: "Botões", ok: true },
    { item: "Biometria", ok: false },
    { item: "Bateria", ok: true },
    { item: "Wi-Fi", ok: true },
    { item: "Chip/Sinal", ok: true },
  ],
};

const CUPOM_CODIGO = "BEMVINDO15";
const CUPOM_DESCONTO = 15;

// Planos exibidos na tela de cupom (apenas mensais)
const PLANOS_CUPOM = [
  { key: "basico_mensal", destaque: false },
  { key: "intermediario_mensal", destaque: true },
  { key: "profissional_mensal", destaque: false },
] as const;

// ─── Error Boundary ───────────────────────────────────────────────────────────

class TeamOnboardingErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-white text-lg font-bold mb-2">Erro ao carregar</p>
          <p className="text-slate-400 text-sm mb-4">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Componente principal ─────────────────────────────────────────────────────

function TeamOnboardingInner() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState<Etapa>("demo");
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [osCriada, setOsCriada] = useState<OSTeste | null>(null);

  // Checkout
  const [planoSelecionado, setPlanoSelecionado] = useState<string | null>(null);
  const [abrirCartao, setAbrirCartao] = useState(false);
  const [abrirPix, setAbrirPix] = useState(false);

  // Form criação OS
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [defeito, setDefeito] = useState("");
  const [servico, setServico] = useState("");
  const [custo, setCusto] = useState("");
  const [valor, setValor] = useState("");
  const [checklist, setChecklist] = useState<Checklist>({ entrada: {}, saida: {} });

  const lucro = (parseFloat(valor) || 0) - (parseFloat(custo) || 0);
  const margem =
    parseFloat(valor) > 0
      ? Math.round(((parseFloat(valor) - (parseFloat(custo) || 0)) / parseFloat(valor)) * 100)
      : 0;

  const copiarCupom = async () => {
    try {
      await navigator.clipboard.writeText(CUPOM_CODIGO);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  const handleCriarOS = async () => {
    if (!marca || !modelo || !defeito || !servico || !valor) return;
    setSalvando(true);
    await new Promise((r) => setTimeout(r, 900));
    setOsCriada({
      marca,
      modelo,
      defeito,
      servico,
      custo: parseFloat(custo) || 0,
      valor: parseFloat(valor),
      checklist,
    });
    setSalvando(false);
    setEtapa("os-pronta");
  };

  const irParaDashboard = async () => {
    await marcarOnboardingCompleto();
    navigate("/dashboard", { replace: true });
  };

  const irParaPlano = async () => {
    await marcarOnboardingCompleto();
    navigate("/plano?highlight=profissional_mensal", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start py-8 px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Logo */}
      <div className="mb-6 flex-shrink-0">
        <img src={logoMec} alt="Méc" className="h-10" />
      </div>

      {/* ── ETAPA 1: OS Fictícia Demo ─────────────────────────────────────── */}
      {etapa === "demo" && (
        <div className="w-full max-w-[440px] space-y-4">
          <div className="text-center mb-2">
            <p className="text-xs text-blue-400 font-mono uppercase tracking-widest mb-1">Exemplo real</p>
            <h1 className="text-2xl font-bold text-white leading-tight">
              Veja como fica uma OS<br />no AppMec
            </h1>
            <p className="text-sm text-slate-400 mt-1.5">
              É assim que você vai organizar cada reparo da sua assistência.
            </p>
          </div>

          {/* Card OS Demo */}
          <div className="rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl overflow-hidden shadow-[0_0_40px_-10px_rgba(59,130,246,0.2)]">
            {/* Header OS */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <ClipboardList className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-mono">{OS_DEMO.numero}</p>
                  <p className="text-sm font-bold text-white">{OS_DEMO.cliente}</p>
                </div>
              </div>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[11px]">
                {OS_DEMO.status}
              </Badge>
            </div>

            {/* Dispositivo */}
            <div className="px-5 py-4 border-b border-white/10">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-700/60 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Smartphone className="h-4 w-4 text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {OS_DEMO.marca} {OS_DEMO.modelo}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{OS_DEMO.defeito}</p>
                </div>
              </div>
            </div>

            {/* Fotos do dispositivo */}
            <div className="px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Camera className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Fotos do dispositivo</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative rounded-xl overflow-hidden aspect-[3/4] bg-slate-800/60 border border-white/10">
                  <img
                    src={fotoDispositivo1}
                    alt="Foto do dispositivo 1"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                    <p className="text-[10px] text-white/80 font-medium">Frente</p>
                  </div>
                </div>
                <div className="relative rounded-xl overflow-hidden aspect-[3/4] bg-slate-800/60 border border-white/10">
                  <img
                    src={fotoDispositivo2}
                    alt="Foto do dispositivo 2"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                    <p className="text-[10px] text-white/80 font-medium">Traseira</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Serviço — Custo/Lucro */}
            <div className="px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-1.5 mb-3">
                <Wrench className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Serviço</span>
              </div>
              <p className="text-sm font-semibold text-white mb-3">{OS_DEMO.servico}</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-800/60 border border-white/10 p-3 text-center">
                  <p className="text-[10px] text-slate-500 mb-1">Cobrado</p>
                  <p className="text-sm font-bold text-white">R$ {OS_DEMO.valor.toFixed(2)}</p>
                </div>
                <div className="rounded-xl bg-slate-800/60 border border-white/10 p-3 text-center">
                  <p className="text-[10px] text-slate-500 mb-1">Custo</p>
                  <p className="text-sm font-bold text-slate-300">R$ {OS_DEMO.custo.toFixed(2)}</p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-center">
                  <p className="text-[10px] text-emerald-400 mb-1">Lucro</p>
                  <p className="text-sm font-bold text-emerald-400">
                    R$ {(OS_DEMO.valor - OS_DEMO.custo).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-3">
                <ListChecks className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Checklist de entrada</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {OS_DEMO.checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.ok
                          ? "bg-emerald-500/20 border border-emerald-500/40"
                          : "bg-red-500/20 border border-red-500/40"
                      }`}
                    >
                      {item.ok ? (
                        <Check className="h-2.5 w-2.5 text-emerald-400" />
                      ) : (
                        <span className="text-[8px] text-red-400 font-bold">✕</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-300">{item.item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="space-y-3 pt-1">
            <Button
              onClick={() => setEtapa("criar-os")}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 font-semibold rounded-xl gap-2 text-base shadow-[0_0_24px_-6px_rgba(59,130,246,0.5)]"
            >
              <ClipboardList className="h-4 w-4" />
              Criar uma OS agora
            </Button>
            <button
              onClick={() => setEtapa("cupom")}
              className="w-full text-center text-sm text-slate-400 hover:text-slate-200 transition-colors py-1.5"
            >
              Criar uma OS depois →
            </button>
          </div>
        </div>
      )}

      {/* ── ETAPA 2: Criação de OS ────────────────────────────────────────── */}
      {etapa === "criar-os" && (
        <div className="w-full max-w-[440px] space-y-4">
          <div className="text-center mb-2">
            <p className="text-xs text-blue-400 font-mono uppercase tracking-widest mb-1">Sua primeira OS</p>
            <h1 className="text-2xl font-bold text-white leading-tight">Cadastre uma OS real</h1>
            <p className="text-sm text-slate-400 mt-1.5">
              Preencha os dados do reparo que você vai fazer agora.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl p-5 space-y-5 shadow-[0_0_40px_-10px_rgba(59,130,246,0.2)]">

            {/* Dispositivo */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                <Smartphone className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Dispositivo</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Marca *</Label>
                  <Input
                    placeholder="Ex: Samsung"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    className="bg-slate-800/60 border-white/10 text-white placeholder:text-slate-600 h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Modelo *</Label>
                  <Input
                    placeholder="Ex: Galaxy A54"
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    className="bg-slate-800/60 border-white/10 text-white placeholder:text-slate-600 h-10 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Defeito relatado *</Label>
                <Textarea
                  placeholder="Ex: Tela quebrada, não liga, bateria não carrega..."
                  value={defeito}
                  onChange={(e) => setDefeito(e.target.value)}
                  rows={2}
                  className="bg-slate-800/60 border-white/10 text-white placeholder:text-slate-600 rounded-xl resize-none"
                />
              </div>
            </div>

            {/* Serviço */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                <Wrench className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Serviço</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Descrição do serviço *</Label>
                <Input
                  placeholder="Ex: Troca de tela, Troca de bateria..."
                  value={servico}
                  onChange={(e) => setServico(e.target.value)}
                  className="bg-slate-800/60 border-white/10 text-white placeholder:text-slate-600 h-10 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Valor cobrado (R$) *</Label>
                  <Input
                    type="number"
                    placeholder="220.00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="bg-slate-800/60 border-white/10 text-white placeholder:text-slate-600 h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Custo da peça (R$)</Label>
                  <Input
                    type="number"
                    placeholder="85.00"
                    value={custo}
                    onChange={(e) => setCusto(e.target.value)}
                    className="bg-slate-800/60 border-white/10 text-white placeholder:text-slate-600 h-10 rounded-xl"
                  />
                </div>
              </div>

              {/* Preview lucro */}
              {parseFloat(valor) > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-slate-800/60 border border-white/10 p-3 text-center">
                    <p className="text-[10px] text-slate-500 mb-1">Cobrado</p>
                    <p className="text-sm font-bold text-white">R$ {parseFloat(valor).toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/60 border border-white/10 p-3 text-center">
                    <p className="text-[10px] text-slate-500 mb-1">Custo</p>
                    <p className="text-sm font-bold text-slate-300">
                      R$ {(parseFloat(custo) || 0).toFixed(2)}
                    </p>
                  </div>
                  <div
                    className={`rounded-xl p-3 text-center border ${
                      lucro >= 0
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-red-500/10 border-red-500/30"
                    }`}
                  >
                    <p className={`text-[10px] mb-1 ${lucro >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      Lucro
                    </p>
                    <p className={`text-sm font-bold ${lucro >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      R$ {lucro.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Checklist */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-white/10">
                <ListChecks className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Checklist de entrada</span>
              </div>
              <div className="rounded-xl overflow-hidden border border-white/10">
                <ChecklistDispositivo
                  tipoDispositivo="celular"
                  value={checklist}
                  onChange={setChecklist}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <Button
              onClick={handleCriarOS}
              disabled={!marca || !modelo || !defeito || !servico || !valor || salvando}
              className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white border-0 font-semibold rounded-xl gap-2 text-base shadow-[0_0_24px_-6px_rgba(16,185,129,0.4)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando OS…
                </>
              ) : (
                <>
                  Criar OS
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <button
              onClick={() => setEtapa("demo")}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
            >
              ← Voltar
            </button>
          </div>
        </div>
      )}

      {/* ── ETAPA 3: OS Pronta ────────────────────────────────────────────── */}
      {etapa === "os-pronta" && osCriada && (
        <div className="w-full max-w-[440px] space-y-4">
          <div className="text-center mb-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white leading-tight">OS criada!</h1>
            <p className="text-sm text-slate-400 mt-1.5">
              É exatamente assim que você vai organizar cada reparo.
            </p>
          </div>

          {/* Card OS Criada */}
          <div className="rounded-2xl bg-slate-900/80 border border-emerald-500/20 backdrop-blur-xl overflow-hidden shadow-[0_0_40px_-10px_rgba(16,185,129,0.2)]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <ClipboardList className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-mono">OS-0001</p>
                  <p className="text-sm font-bold text-white">Nova OS</p>
                </div>
              </div>
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[11px]">
                Aberta
              </Badge>
            </div>

            {/* Dados */}
            <div className="px-5 py-4 border-b border-white/10 space-y-2">
              <div className="flex items-center gap-2">
                <Smartphone className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-sm text-white font-semibold">
                  {osCriada.marca} {osCriada.modelo}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-slate-500 mt-0.5 flex-shrink-0">Defeito:</span>
                <span className="text-sm text-slate-300 leading-snug">{osCriada.defeito}</span>
              </div>
              <div className="flex items-center gap-2">
                <Wrench className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-sm text-slate-300">{osCriada.servico}</span>
              </div>
            </div>

            {/* Financeiro */}
            <div className="px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Resultado financeiro</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-800/60 border border-white/10 p-3 text-center">
                  <p className="text-[10px] text-slate-500 mb-1">Cobrado</p>
                  <p className="text-sm font-bold text-white">R$ {osCriada.valor.toFixed(2)}</p>
                </div>
                <div className="rounded-xl bg-slate-800/60 border border-white/10 p-3 text-center">
                  <p className="text-[10px] text-slate-500 mb-1">Custo</p>
                  <p className="text-sm font-bold text-slate-300">R$ {osCriada.custo.toFixed(2)}</p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-center">
                  <p className="text-[10px] text-emerald-400 mb-1">Lucro</p>
                  <p className="text-sm font-bold text-emerald-400">
                    R$ {(osCriada.valor - osCriada.custo).toFixed(2)}
                  </p>
                </div>
              </div>
              {osCriada.valor > 0 && (
                <div className="mt-2 rounded-lg bg-slate-800/40 border border-white/10 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Margem de lucro</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {Math.round(((osCriada.valor - osCriada.custo) / osCriada.valor) * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Checklist resumo */}
            {Object.keys(osCriada.checklist.entrada || {}).length > 0 && (
              <div className="px-5 py-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <ListChecks className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Checklist de entrada</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(osCriada.checklist.entrada).slice(0, 8).map(([key, val]) => (
                    <span
                      key={key}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${
                        val === "ok"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-red-500/10 border-red-500/30 text-red-400"
                      }`}
                    >
                      {val === "ok" ? "✓" : "✕"} {key.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={() => setEtapa("cupom")}
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 font-semibold rounded-xl gap-2 text-base shadow-[0_0_24px_-6px_rgba(59,130,246,0.4)]"
          >
            Continuar
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── ETAPA 4: Cupom + Planos ──────────────────────────────────────── */}
      {etapa === "cupom" && (
        <div className="w-full max-w-[480px] space-y-4">

          {/* Banner cupom */}
          <div className="relative rounded-2xl overflow-hidden shadow-[0_0_50px_-10px_rgba(234,179,8,0.25)]">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-yellow-600/10 to-orange-500/15" />
            <div className="absolute inset-0 border border-amber-500/30 rounded-2xl pointer-events-none" />
            <div className="absolute top-3 right-5 w-2 h-2 bg-amber-400/40 rounded-full" />
            <div className="absolute top-10 right-14 w-1 h-1 bg-yellow-300/50 rounded-full" />
            <div className="absolute bottom-5 left-6 w-1.5 h-1.5 bg-amber-400/25 rounded-full" />

            <div className="relative px-5 py-6 flex items-center gap-5">
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center">
                <Gift className="h-8 w-8 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-amber-400/80 font-mono uppercase tracking-widest">Exclusivo para você</p>
                <h2 className="text-2xl font-black text-white leading-tight mt-0.5">
                  {CUPOM_DESCONTO}% OFF <span className="text-base font-semibold text-amber-200">no 1º mês</span>
                </h2>
                {/* Código copiável */}
                <button
                  onClick={copiarCupom}
                  className="group mt-2 inline-flex items-center gap-2 bg-slate-950/60 border border-dashed border-amber-500/50 hover:border-amber-400 rounded-lg px-3 py-1.5 transition-all"
                >
                  <Tag className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                  <span className="text-sm font-black text-amber-300 tracking-widest font-mono">{CUPOM_CODIGO}</span>
                  <span className={`text-[11px] font-semibold transition-colors ${copiado ? "text-emerald-400" : "text-slate-500 group-hover:text-amber-400"}`}>
                    {copiado ? (
                      <><CheckCircle2 className="h-3.5 w-3.5 inline mr-0.5" />Copiado!</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5 inline mr-0.5" />Copiar</>
                    )}
                  </span>
                </button>
              </div>
            </div>
            <div className="px-5 pb-4">
              <p className="text-[11px] text-amber-400/60">
                ⚠️ Este cupom está disponível apenas nesta tela.
              </p>
            </div>
          </div>

          {/* Título seção planos */}
          <div className="text-center pt-1">
            <h3 className="text-base font-bold text-white">Escolha seu plano</h3>
            <p className="text-xs text-slate-400 mt-0.5">Desconto aplicado automaticamente no checkout</p>
          </div>

          {/* Cards de planos */}
          <div className="space-y-3">
            {PLANOS_CUPOM.map(({ key, destaque }) => {
              const plano = PLANOS[key];
              if (!plano) return null;
              const precoComDesconto = plano.preco * (1 - CUPOM_DESCONTO / 100);
              const selecionado = planoSelecionado === key;

              return (
                <div
                  key={key}
                  onClick={() => setPlanoSelecionado(key)}
                  className={`relative rounded-2xl border-2 cursor-pointer transition-all overflow-hidden ${
                    selecionado
                      ? "border-amber-500 bg-amber-500/5 shadow-[0_0_20px_-5px_rgba(234,179,8,0.3)]"
                      : destaque
                      ? "border-blue-500/40 bg-slate-900/60 hover:border-blue-400/60"
                      : "border-white/10 bg-slate-900/40 hover:border-white/20"
                  }`}
                >
                  {destaque && !selecionado && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-violet-500" />
                  )}
                  {selecionado && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-yellow-400" />
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-white">{plano.nome}</span>
                          {destaque && (
                            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px] px-1.5 py-0">
                              Popular
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-xs text-slate-500 line-through">
                            R$ {plano.preco.toFixed(2).replace(".", ",")}
                          </span>
                          <span className="text-xl font-black text-white">
                            R$ {precoComDesconto.toFixed(2).replace(".", ",")}
                          </span>
                          <span className="text-xs text-slate-400">/mês</span>
                        </div>
                        <p className="text-[10px] text-amber-400 font-semibold mt-0.5">
                          {CUPOM_DESCONTO}% OFF no 1º mês · depois R$ {plano.preco.toFixed(2).replace(".", ",")}/mês
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                        selecionado ? "border-amber-400 bg-amber-400" : "border-slate-600"
                      }`}>
                        {selecionado && <CheckCircle2 className="h-3.5 w-3.5 text-slate-900" />}
                      </div>
                    </div>

                    {/* Recursos — top 4 */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {plano.recursos.slice(0, 4).map((r) => (
                        <div key={r} className="flex items-center gap-1.5">
                          <Zap className="h-3 w-3 text-amber-400 flex-shrink-0" />
                          <span className="text-[11px] text-slate-300 leading-tight truncate">{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botões de checkout — só aparecem quando selecionado */}
                  {selecionado && (
                    <div className="px-4 pb-4 pt-1 space-y-2 border-t border-white/10 mt-1">
                      <p className="text-[11px] text-slate-400 text-center mb-2">Como quer pagar?</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={(e) => { e.stopPropagation(); setAbrirCartao(true); }}
                          className="h-10 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-900 font-bold border-0 rounded-xl gap-1.5 text-sm"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Cartão
                        </Button>
                        <Button
                          onClick={(e) => { e.stopPropagation(); setAbrirPix(true); }}
                          className="h-10 bg-slate-700 hover:bg-slate-600 text-white font-bold border-0 rounded-xl gap-1.5 text-sm"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          Pix
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Garantias */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { icon: Zap, label: "Sem limite de OS" },
              { icon: Shield, label: "Sem fidelidade" },
              { icon: Star, label: "Cancele quando quiser" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-xl bg-slate-900/50 border border-white/10 p-2.5">
                <Icon className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                <p className="text-[10px] text-slate-400 leading-tight">{label}</p>
              </div>
            ))}
          </div>

          <button
            onClick={irParaDashboard}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors py-1.5"
          >
            Assinar depois e continuar →
          </button>
        </div>
      )}

      {/* Dialogs de checkout — cupom pré-aplicado */}
      {planoSelecionado && (() => {
        const plano = PLANOS[planoSelecionado];
        if (!plano) return null;
        return (
          <>
            <CartaoCheckoutDialog
              open={abrirCartao}
              onOpenChange={setAbrirCartao}
              planoKey={planoSelecionado}
              planoNome={plano.nome}
              planoPreco={plano.preco}
              cupomInicial={CUPOM_CODIGO}
              onSuccess={irParaDashboard}
            />
            <PixCheckoutDialog
              open={abrirPix}
              onOpenChange={setAbrirPix}
              planoKey={planoSelecionado}
              planoNome={plano.nome}
              planoPreco={plano.preco}
              cupomInicial={CUPOM_CODIGO}
              onSuccess={irParaDashboard}
            />
          </>
        );
      })()}
    </div>
  );
}

export default function TeamOnboarding() {
  return (
    <TeamOnboardingErrorBoundary>
      <TeamOnboardingInner />
    </TeamOnboardingErrorBoundary>
  );
}
