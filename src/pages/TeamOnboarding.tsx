import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ChecklistDispositivo } from "@/components/ordens/ChecklistDispositivo";
import { Checklist } from "@/types/ordem-servico";
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  ClipboardList,
  TrendingUp,
  Camera,
  Wrench,
  Smartphone,
  DollarSign,
  ListChecks,
  Sparkles,
  Tag,
  Gift,
  Copy,
  Check,
  ChevronRight,
  Star,
  Zap,
  Shield,
} from "lucide-react";
import logoMec from "@/assets/logo-mec-auth.png";

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
    { label: "Frente do dispositivo", cor: "from-slate-700 to-slate-600", icon: "📱" },
    { label: "Tela danificada", cor: "from-red-900/40 to-slate-700", icon: "🔴" },
    { label: "Interior aberto", cor: "from-slate-600 to-slate-500", icon: "🔧" },
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

const CUPOM_CODIGO = "BOASVINDAS15";
const CUPOM_DESCONTO = 15;

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TeamOnboarding() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState<Etapa>("demo");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [osCriada, setOsCriada] = useState<OSTeste | null>(null);

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/auth", { replace: true });
      else setCarregando(false);
    });
  }, [navigate]);

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

  const irParaDashboard = () => navigate("/dashboard", { replace: true });

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

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

            {/* Fotos */}
            <div className="px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Camera className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">Fotos do dispositivo</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {OS_DEMO.fotos.map((foto, i) => (
                  <div
                    key={i}
                    className={`aspect-square rounded-xl bg-gradient-to-br ${foto.cor} border border-white/10 flex flex-col items-center justify-center gap-1`}
                  >
                    <span className="text-2xl">{foto.icon}</span>
                    <span className="text-[9px] text-slate-400 text-center px-1 leading-tight">{foto.label}</span>
                  </div>
                ))}
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

      {/* ── ETAPA 4: Cupom de Desconto ────────────────────────────────────── */}
      {etapa === "cupom" && (
        <div className="w-full max-w-[440px] space-y-4">
          {/* Card cupom principal */}
          <div className="relative rounded-2xl overflow-hidden shadow-[0_0_60px_-10px_rgba(234,179,8,0.3)]">
            {/* Fundo gradiente */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-yellow-600/10 to-orange-500/20" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,179,8,0.15),transparent_60%)]" />
            <div className="absolute inset-0 border border-amber-500/30 rounded-2xl" />

            {/* Partículas decorativas */}
            <div className="absolute top-4 right-6 w-2 h-2 bg-amber-400/40 rounded-full" />
            <div className="absolute top-12 right-16 w-1 h-1 bg-yellow-300/60 rounded-full" />
            <div className="absolute bottom-8 left-8 w-1.5 h-1.5 bg-amber-400/30 rounded-full" />
            <div className="absolute bottom-16 left-20 w-1 h-1 bg-yellow-300/40 rounded-full" />

            <div className="relative px-6 py-8 text-center space-y-5">
              {/* Ícone */}
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/40">
                <Gift className="h-9 w-9 text-amber-400" />
                <div className="absolute">
                  <Sparkles className="h-4 w-4 text-yellow-300 opacity-80 -translate-x-6 -translate-y-5" />
                  <Star className="h-3 w-3 text-amber-300 opacity-60 translate-x-6 -translate-y-3" />
                </div>
              </div>

              {/* Headline */}
              <div>
                <p className="text-xs text-amber-400/80 font-mono uppercase tracking-widest mb-1">
                  Exclusivo para você
                </p>
                <h2 className="text-3xl font-black text-white leading-tight">
                  {CUPOM_DESCONTO}% OFF
                </h2>
                <p className="text-base font-semibold text-amber-200 mt-1">
                  na primeira mensalidade
                </p>
              </div>

              {/* Código do cupom */}
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Seu cupom de desconto:</p>
                <button
                  onClick={copiarCupom}
                  className="group w-full flex items-center justify-between gap-3 bg-slate-950/60 border-2 border-dashed border-amber-500/50 hover:border-amber-400 rounded-xl px-5 py-3.5 transition-all"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Tag className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    <span className="text-lg font-black text-amber-300 tracking-widest font-mono truncate">
                      {CUPOM_CODIGO}
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 text-xs font-semibold flex-shrink-0 transition-colors ${
                      copiado ? "text-emerald-400" : "text-slate-400 group-hover:text-amber-400"
                    }`}
                  >
                    {copiado ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copiar
                      </>
                    )}
                  </div>
                </button>
                <p className="text-[11px] text-amber-400/60">
                  ⚠️ Este cupom só está disponível nesta tela
                </p>
              </div>

              {/* Benefícios */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: Zap, label: "OS ilimitadas" },
                  { icon: Shield, label: "Sem fidelidade" },
                  { icon: Star, label: "Cancele quando quiser" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="rounded-xl bg-slate-950/40 border border-white/10 p-2.5">
                    <Icon className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-400 leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Info preço */}
          <div className="rounded-xl bg-slate-900/60 border border-white/10 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Plano Profissional</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-sm text-slate-500 line-through">R$ 79,90</span>
                <span className="text-lg font-black text-white">R$ 67,92</span>
                <span className="text-xs text-slate-400">/mês</span>
              </div>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs font-bold">
              -{CUPOM_DESCONTO}%
            </Badge>
          </div>

          {/* Botões */}
          <div className="space-y-3">
            <Button
              onClick={() => navigate("/plano?highlight=profissional_mensal", { replace: true })}
              className="w-full h-12 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-900 font-bold border-0 rounded-xl gap-2 text-base shadow-[0_0_24px_-6px_rgba(234,179,8,0.5)]"
            >
              <Sparkles className="h-4 w-4" />
              Assinar com desconto
            </Button>
            <button
              onClick={irParaDashboard}
              className="w-full text-center text-sm text-slate-400 hover:text-slate-200 transition-colors py-1.5"
            >
              Assinar depois e continuar →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
