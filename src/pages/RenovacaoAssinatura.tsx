import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CartaoCheckoutDialog } from "@/components/planos/CartaoCheckoutDialog";
import { PixCheckoutDialog } from "@/components/planos/PixCheckoutDialog";
import { PLANOS } from "@/types/plano";
import type { PlanoTipo } from "@/types/assinatura";
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  CreditCard,
  QrCode,
  Zap,
  RefreshCw,
  TrendingUp,
  Search,
  AlertCircle,
} from "lucide-react";
import logoMec from "@/assets/logo-mec-auth.png";

// Planos pagos ordenados por hierarquia
const HIERARQUIA_PLANOS: PlanoTipo[] = [
  "basico_mensal",
  "basico_anual",
  "intermediario_mensal",
  "intermediario_anual",
  "profissional_mensal",
  "profissional_anual",
  "profissional_ultra_mensal",
  "profissional_ultra_anual",
];

const LABEL_PLANO: Record<string, string> = {
  basico_mensal: "Básico Mensal",
  basico_anual: "Básico Anual",
  intermediario_mensal: "Intermediário Mensal",
  intermediario_anual: "Intermediário Anual",
  profissional_mensal: "Profissional Mensal",
  profissional_anual: "Profissional Anual",
  profissional_ultra_mensal: "Ultra Mensal",
  profissional_ultra_anual: "Ultra Anual",
};

const PLANOS_GRATUITOS: PlanoTipo[] = ["free", "trial", "demonstracao"];

// Planos disponíveis para upgrade dado o plano atual
function getUpgradePlanos(planoAtual: PlanoTipo): PlanoTipo[] {
  const idx = HIERARQUIA_PLANOS.indexOf(planoAtual);
  if (idx === -1) return HIERARQUIA_PLANOS; // gratuitos: mostrar todos
  return HIERARQUIA_PLANOS.slice(idx + 1);
}

// Cores do badge de status
function corStatus(status: string) {
  if (status === "active") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (status === "trialing") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (status === "canceled") return "bg-red-500/20 text-red-300 border-red-500/30";
  if (status === "past_due" || status === "unpaid") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  return "bg-slate-500/20 text-slate-300 border-slate-500/30";
}

function labelStatus(status: string) {
  const map: Record<string, string> = {
    active: "Ativo",
    trialing: "Em trial",
    canceled: "Cancelado",
    past_due: "Pagamento atrasado",
    unpaid: "Não pago",
    incomplete: "Incompleto",
    incomplete_expired: "Expirado",
  };
  return map[status] ?? status;
}

type Etapa = "email" | "escolha" | "sucesso";

interface DadosAssinatura {
  userId: string;
  planoTipo: PlanoTipo;
  status: string;
  dataFim?: string;
  dataProximaCobranca?: string;
  nomeUsuario?: string;
  email: string;
}

// Grupos de planos: cada grupo tem mensal e anual (anual pode não existir para alguns)
const GRUPOS_PLANOS = [
  { base: "basico",            mensal: "basico_mensal",            anual: "basico_anual" },
  { base: "intermediario",     mensal: "intermediario_mensal",     anual: "intermediario_anual" },
  { base: "profissional",      mensal: "profissional_mensal",      anual: "profissional_anual" },
  { base: "ultra",             mensal: "profissional_ultra_mensal", anual: "profissional_ultra_anual" },
] as const;

function GruposUpgrade({
  disponiveis,
  planoSelecionado,
  onSelecionar,
}: {
  disponiveis: PlanoTipo[];
  planoSelecionado: string | null;
  onSelecionar: (key: string) => void;
}) {
  // Período ativo por grupo: "mensal" | "anual"
  const [periodos, setPeriodos] = useState<Record<string, "mensal" | "anual">>({});

  const gruposFiltrados = GRUPOS_PLANOS.filter(
    (g) => disponiveis.includes(g.mensal as PlanoTipo) || disponiveis.includes(g.anual as PlanoTipo)
  );

  return (
    <div className="space-y-3">
      {gruposFiltrados.map((grupo) => {
        const periodo = periodos[grupo.base] ?? "mensal";
        const keyAtivo = periodo === "mensal" ? grupo.mensal : grupo.anual;
        const plano = PLANOS[keyAtivo];
        if (!plano) return null;

        const sel = planoSelecionado === keyAtivo;
        const temAnual = disponiveis.includes(grupo.anual as PlanoTipo) && !!PLANOS[grupo.anual];

        const setPeriodo = (p: "mensal" | "anual") => {
          setPeriodos((prev) => ({ ...prev, [grupo.base]: p }));
          // Se esse grupo já estava selecionado, atualiza a seleção para o novo período
          if (planoSelecionado === grupo.mensal || planoSelecionado === grupo.anual) {
            onSelecionar(p === "mensal" ? grupo.mensal : grupo.anual);
          }
        };

        return (
          <div
            key={grupo.base}
            onClick={() => onSelecionar(keyAtivo)}
            className={`rounded-2xl border-2 cursor-pointer transition-all overflow-hidden ${
              sel
                ? "border-violet-500 bg-violet-500/10 shadow-[0_0_20px_-5px_rgba(139,92,246,0.3)]"
                : "border-white/10 bg-slate-900/60 hover:border-white/20"
            }`}
          >
            <div className="p-4">
              {/* Header: nome + badge + radio */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-white">{plano.nome}</span>
                    {plano.popular && (
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px] px-1.5 py-0">Popular</Badge>
                    )}
                    {plano.novo && (
                      <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px] px-1.5 py-0">Novo</Badge>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-white">
                      R$ {plano.preco.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="text-xs text-slate-400">{plano.periodo}</span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                  sel ? "border-violet-400 bg-violet-400" : "border-slate-600"
                }`}>
                  {sel && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                </div>
              </div>

              {/* Toggle mensal / anual */}
              {temAnual && (
                <div
                  className="flex rounded-lg overflow-hidden border border-white/10 mb-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setPeriodo("mensal")}
                    className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${
                      periodo === "mensal"
                        ? "bg-white/10 text-white"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setPeriodo("anual")}
                    className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${
                      periodo === "anual"
                        ? "bg-white/10 text-white"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Anual
                    <span className="ml-1 text-emerald-400 text-[10px]">economize</span>
                  </button>
                </div>
              )}

              {/* Recursos */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {plano.recursos.slice(0, 4).map((r) => (
                  <div key={r} className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-violet-400 flex-shrink-0" />
                    <span className="text-[11px] text-slate-300 truncate">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RenovacaoAssinatura() {
  const [etapa, setEtapa] = useState<Etapa>("email");
  const [email, setEmail] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosAssinatura | null>(null);

  // Modo: "renovar" = mesmo plano, "upgrade" = outro plano
  const [modo, setModo] = useState<"renovar" | "upgrade" | null>(null);
  const [planoSelecionado, setPlanoSelecionado] = useState<string | null>(null);
  const [mostrarUpgrades, setMostrarUpgrades] = useState(false);

  // Checkout
  const [abrirCartao, setAbrirCartao] = useState(false);
  const [abrirPix, setAbrirPix] = useState(false);

  const buscarAssinatura = async () => {
    if (!email.trim()) return;
    setBuscando(true);
    setErroEmail(null);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buscar-assinatura-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        }
      );

      const data = await res.json();

      if (!res.ok || data?.error) {
        setErroEmail(data?.error ?? "Erro ao buscar assinatura.");
        return;
      }

      const planoTipo = data.planoTipo as PlanoTipo;

      setDados({
        userId: data.userId,
        planoTipo,
        status: data.status,
        dataFim: data.dataFim ?? undefined,
        dataProximaCobranca: data.dataProximaCobranca ?? undefined,
        nomeUsuario: data.nome ?? undefined,
        email: data.email ?? email.trim().toLowerCase(),
      });

      // Planos gratuitos vão direto para seleção de upgrade
      if (PLANOS_GRATUITOS.includes(planoTipo)) {
        setModo("upgrade");
        setMostrarUpgrades(true);
      }

      setEtapa("escolha");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar assinatura.";
      setErroEmail(msg);
    } finally {
      setBuscando(false);
    }
  };

  const selecionarModo = (m: "renovar" | "upgrade") => {
    setModo(m);
    if (m === "renovar" && dados) {
      setPlanoSelecionado(dados.planoTipo);
      setMostrarUpgrades(false);
    } else {
      setPlanoSelecionado(null);
      setMostrarUpgrades(true);
    }
  };

  const handleSucesso = () => {
    setAbrirCartao(false);
    setAbrirPix(false);
    setEtapa("sucesso");
  };

  const planoAtualInfo = dados ? PLANOS[dados.planoTipo] : null;
  const planoSelecionadoInfo = planoSelecionado ? PLANOS[planoSelecionado] : null;
  const upgradesDisponiveis = dados ? getUpgradePlanos(dados.planoTipo) : [];
  const isPlanoGratuito = dados ? PLANOS_GRATUITOS.includes(dados.planoTipo) : false;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start py-8 px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Logo */}
      <div className="mb-8 flex-shrink-0">
        <img src={logoMec} alt="Méc" className="h-10" />
      </div>

      {/* ── ETAPA 1: Email ─────────────────────────────────────────────────── */}
      {etapa === "email" && (
        <div className="w-full max-w-[420px] space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-600/20 border border-blue-500/30 mb-4">
              <RefreshCw className="h-6 w-6 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white leading-tight">Renovar assinatura</h1>
            <p className="text-sm text-slate-400 mt-2">
              Digite seu email de cadastro para verificarmos sua assinatura.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl p-6 space-y-4 shadow-[0_0_40px_-10px_rgba(59,130,246,0.2)]">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Email de cadastro</Label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErroEmail(null); }}
                onKeyDown={(e) => e.key === "Enter" && buscarAssinatura()}
                className="bg-slate-800/60 border-white/10 text-white placeholder:text-slate-600 h-11 rounded-xl"
                autoFocus
              />
              {erroEmail && (
                <div className="flex items-center gap-2 mt-1">
                  <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400">{erroEmail}</p>
                </div>
              )}
            </div>

            <Button
              onClick={buscarAssinatura}
              disabled={!email.trim() || buscando}
              className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 font-semibold rounded-xl gap-2 shadow-[0_0_24px_-6px_rgba(59,130,246,0.5)] disabled:opacity-40"
            >
              {buscando ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Buscando...</>
              ) : (
                <><Search className="h-4 w-4" />Verificar assinatura</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── ETAPA 2: Escolha ───────────────────────────────────────────────── */}
      {etapa === "escolha" && dados && (
        <div className="w-full max-w-[440px] space-y-4">
          <div className="text-center">
            <p className="text-xs text-blue-400 font-mono uppercase tracking-widest mb-1">Assinatura encontrada</p>
            <h1 className="text-2xl font-bold text-white leading-tight">
              {dados.nomeUsuario ? `Olá, ${dados.nomeUsuario.split(" ")[0]}!` : "Assinatura encontrada!"}
            </h1>
            <p className="text-sm text-slate-400 mt-1.5">{dados.email}</p>
          </div>

          {/* Card resumo da assinatura atual */}
          <div className="rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl overflow-hidden shadow-[0_0_40px_-10px_rgba(59,130,246,0.15)]">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider font-mono mb-0.5">Plano atual</p>
                <p className="text-base font-bold text-white">
                  {planoAtualInfo?.nome ?? LABEL_PLANO[dados.planoTipo] ?? dados.planoTipo}
                </p>
              </div>
              <Badge className={`text-[11px] ${corStatus(dados.status)}`}>
                {labelStatus(dados.status)}
              </Badge>
            </div>

            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              {planoAtualInfo && (
                <div className="rounded-xl bg-slate-800/60 border border-white/10 p-3 text-center">
                  <p className="text-[10px] text-slate-500 mb-1">Valor</p>
                  <p className="text-sm font-bold text-white">
                    R$ {planoAtualInfo.preco.toFixed(2).replace(".", ",")}
                    <span className="text-xs text-slate-500 font-normal">{planoAtualInfo.periodo}</span>
                  </p>
                </div>
              )}
              {dados.dataProximaCobranca && (
                <div className="rounded-xl bg-slate-800/60 border border-white/10 p-3 text-center">
                  <p className="text-[10px] text-slate-500 mb-1">Próxima cobrança</p>
                  <p className="text-sm font-bold text-white">
                    {new Date(dados.dataProximaCobranca).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              )}
              {dados.dataFim && !dados.dataProximaCobranca && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-center">
                  <p className="text-[10px] text-red-400 mb-1">Válido até</p>
                  <p className="text-sm font-bold text-red-300">
                    {new Date(dados.dataFim).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Opções: renovar ou upgrade */}
          {isPlanoGratuito ? (
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-center">
              <p className="text-sm text-blue-300">Seu plano atual é gratuito. Escolha um plano pago abaixo para assinar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => selecionarModo("renovar")}
                className={`rounded-2xl border-2 p-4 text-left transition-all ${
                  modo === "renovar"
                    ? "border-blue-500 bg-blue-500/10 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]"
                    : "border-white/10 bg-slate-900/50 hover:border-white/20"
                }`}
              >
                <RefreshCw className={`h-5 w-5 mb-2 ${modo === "renovar" ? "text-blue-400" : "text-slate-400"}`} />
                <p className="text-sm font-bold text-white">Renovar plano</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">Manter o plano atual</p>
              </button>

              <button
                onClick={() => selecionarModo("upgrade")}
                className={`rounded-2xl border-2 p-4 text-left transition-all ${
                  modo === "upgrade"
                    ? "border-violet-500 bg-violet-500/10 shadow-[0_0_20px_-5px_rgba(139,92,246,0.3)]"
                    : "border-white/10 bg-slate-900/50 hover:border-white/20"
                }`}
              >
                <TrendingUp className={`h-5 w-5 mb-2 ${modo === "upgrade" ? "text-violet-400" : "text-slate-400"}`} />
                <p className="text-sm font-bold text-white">Fazer upgrade</p>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">Mudar para plano superior</p>
              </button>
            </div>
          )}

          {/* ── Renovar mesmo plano ── */}
          {modo === "renovar" && planoSelecionadoInfo && (
            <div className="rounded-2xl bg-slate-900/80 border border-blue-500/20 backdrop-blur-xl overflow-hidden shadow-[0_0_30px_-10px_rgba(59,130,246,0.2)]">
              <div className="px-5 py-4 border-b border-white/10">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-mono mb-1">Renovando</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-black text-white">
                    R$ {planoSelecionadoInfo.preco.toFixed(2).replace(".", ",")}
                  </p>
                  <span className="text-xs text-slate-400">{planoSelecionadoInfo.periodo}</span>
                </div>
                <p className="text-sm text-slate-300 mt-0.5">{planoSelecionadoInfo.nome}</p>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 gap-2 border-b border-white/10">
                {planoSelecionadoInfo.recursos.slice(0, 4).map((r) => (
                  <div key={r} className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-blue-400 flex-shrink-0" />
                    <span className="text-[11px] text-slate-300 truncate">{r}</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 space-y-2">
                <p className="text-[11px] text-slate-400 text-center mb-2">Como quer pagar?</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => setAbrirCartao(true)}
                    className="h-10 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 rounded-xl gap-1.5 font-semibold text-sm"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Cartão
                  </Button>
                  <Button
                    onClick={() => setAbrirPix(true)}
                    className="h-10 bg-slate-700 hover:bg-slate-600 text-white border-0 rounded-xl gap-1.5 font-semibold text-sm"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    Pix
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Upgrade ── */}
          {modo === "upgrade" && (
            <div className="space-y-3">
              {upgradesDisponiveis.length === 0 ? (
                <div className="rounded-xl bg-slate-800/50 border border-white/10 px-4 py-3 text-center">
                  <p className="text-sm text-slate-400">Você já está no plano mais alto disponível.</p>
                </div>
              ) : (
                <GruposUpgrade
                  disponiveis={upgradesDisponiveis}
                  planoSelecionado={planoSelecionado}
                  onSelecionar={setPlanoSelecionado}
                />
              )}

              {/* Botões de pagamento */}
              {planoSelecionado && planoSelecionadoInfo && (
                <div className="rounded-2xl bg-slate-900/80 border border-violet-500/20 overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10">
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-mono mb-1">
                      {isPlanoGratuito ? "Assinar" : "Upgrade para"}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl font-black text-white">
                        R$ {planoSelecionadoInfo.preco.toFixed(2).replace(".", ",")}
                      </p>
                      <span className="text-xs text-slate-400">{planoSelecionadoInfo.periodo}</span>
                    </div>
                    <p className="text-sm text-slate-300 mt-0.5">{planoSelecionadoInfo.nome}</p>
                  </div>
                  <div className="px-5 py-4 space-y-2">
                    <p className="text-[11px] text-slate-400 text-center mb-2">Como quer pagar?</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => setAbrirCartao(true)}
                        className="h-10 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white border-0 rounded-xl gap-1.5 font-semibold text-sm"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Cartão
                      </Button>
                      <Button
                        onClick={() => setAbrirPix(true)}
                        className="h-10 bg-slate-700 hover:bg-slate-600 text-white border-0 rounded-xl gap-1.5 font-semibold text-sm"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Pix
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => { setEtapa("email"); setModo(null); setPlanoSelecionado(null); }}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
          >
            ← Usar outro email
          </button>
        </div>
      )}

      {/* ── ETAPA 3: Sucesso ───────────────────────────────────────────────── */}
      {etapa === "sucesso" && (
        <div className="w-full max-w-[400px] text-center space-y-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Assinatura renovada!</h1>
            <p className="text-sm text-slate-400 mt-2">
              Seu acesso ao AppMec foi renovado com sucesso. Você já pode continuar usando normalmente.
            </p>
          </div>
          <Button
            onClick={() => window.location.href = "/"}
            className="w-full h-11 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white border-0 font-semibold rounded-xl gap-2"
          >
            Acessar o sistema
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Dialogs de checkout */}
      {planoSelecionado && planoSelecionadoInfo && (
        <>
          <CartaoCheckoutDialog
            open={abrirCartao}
            onOpenChange={setAbrirCartao}
            planoKey={planoSelecionado}
            planoNome={planoSelecionadoInfo.nome}
            planoPreco={planoSelecionadoInfo.preco}
            onSuccess={handleSucesso}
          />
          <PixCheckoutDialog
            open={abrirPix}
            onOpenChange={setAbrirPix}
            planoKey={planoSelecionado}
            planoNome={planoSelecionadoInfo.nome}
            planoPreco={planoSelecionadoInfo.preco}
            onSuccess={handleSucesso}
          />
        </>
      )}
    </div>
  );
}
