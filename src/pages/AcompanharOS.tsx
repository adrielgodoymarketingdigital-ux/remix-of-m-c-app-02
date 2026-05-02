import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, Wrench, CalendarDays, DollarSign, AlertCircle, CheckCircle2, Clock, PackageSearch, XCircle, ClipboardList } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; cor: string; textCor: string; borderCor: string; bgGlow: string; emoji: string; icon: typeof CheckCircle2 }> = {
  aberta:              { label: "Aberta",               cor: "from-blue-500/20 to-blue-600/10",    textCor: "text-blue-300",   borderCor: "border-blue-500/40",   bgGlow: "rgba(59,130,246,0.12)",  emoji: "📋", icon: ClipboardList },
  em_andamento:        { label: "Em Andamento",          cor: "from-amber-500/20 to-amber-600/10",  textCor: "text-amber-300",  borderCor: "border-amber-500/40",  bgGlow: "rgba(245,158,11,0.12)", emoji: "🔧", icon: Wrench },
  aguardando_peca:     { label: "Aguardando Peça",       cor: "from-orange-500/20 to-orange-600/10",textCor: "text-orange-300", borderCor: "border-orange-500/40", bgGlow: "rgba(249,115,22,0.12)", emoji: "⏳", icon: PackageSearch },
  aguardando_retirada: { label: "Pronto p/ Retirada",    cor: "from-green-500/20 to-green-600/10",  textCor: "text-green-300",  borderCor: "border-green-500/40",  bgGlow: "rgba(34,197,94,0.12)",  emoji: "✅", icon: CheckCircle2 },
  entregue:            { label: "Entregue",              cor: "from-slate-500/20 to-slate-600/10",  textCor: "text-slate-300",  borderCor: "border-slate-500/40",  bgGlow: "rgba(100,116,139,0.1)", emoji: "📦", icon: CheckCircle2 },
  cancelada:           { label: "Cancelada",             cor: "from-red-500/20 to-red-600/10",      textCor: "text-red-300",    borderCor: "border-red-500/40",    bgGlow: "rgba(239,68,68,0.12)",  emoji: "❌", icon: XCircle },
};

const ETAPAS = [
  { key: "aberta",              label: "Recebida" },
  { key: "em_andamento",        label: "Em Reparo" },
  { key: "aguardando_peca",     label: "Aguard. Peça" },
  { key: "aguardando_retirada", label: "Pronto" },
  { key: "entregue",            label: "Entregue" },
];

const PROGRESSO: Record<string, number> = {
  aberta: 1, em_andamento: 2, aguardando_peca: 3, aguardando_retirada: 4, entregue: 5, cancelada: 0,
};

interface TrackingDados {
  os: {
    numero_os: string;
    status: string | null;
    defeito_relatado: string | null;
    total: number | null;
    created_at: string;
    data_saida: string | null;
    dispositivo_marca: string | null;
    dispositivo_modelo: string | null;
    cliente: { nome: string; telefone: string | null } | null;
  } | null;
  loja: {
    nome_loja: string | null;
    logo_url: string | null;
    cor_primaria: string | null;
    telefone: string | null;
    endereco: string | null;
  } | null;
}

export default function AcompanharOS() {
  const { token } = useParams<{ token: string }>();
  const [dados, setDados] = useState<TrackingDados | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!token) return;

    const buscarDados = async () => {
      try {
        const { data: linkData, error: linkError } = await supabase
          .from('os_tracking_links')
          .select('os_id, user_id, visualizacoes')
          .eq('token', token)
          .eq('ativo', true)
          .maybeSingle();

        if (linkError || !linkData) { setErro(true); return; }

        await supabase
          .from('os_tracking_links')
          .update({ visualizacoes: (linkData.visualizacoes || 0) + 1 })
          .eq('token', token);

        const { data: osData } = await supabase
          .from('ordens_servico')
          .select(`
            numero_os, status, defeito_relatado,
            total, created_at, data_saida,
            dispositivo_marca, dispositivo_modelo,
            cliente:clientes(nome, telefone)
          `)
          .eq('id', linkData.os_id)
          .maybeSingle();

        const { data: lojaData } = await supabase
          .from('configuracoes_loja')
          .select('nome_loja, logo_url, cor_primaria, telefone, endereco')
          .eq('user_id', linkData.user_id)
          .maybeSingle();

        setDados({ os: osData as TrackingDados['os'], loja: lojaData });
      } catch {
        setErro(true);
      } finally {
        setLoading(false);
      }
    };

    buscarDados();

    const channel = supabase
      .channel(`os-tracking-${token}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ordens_servico' }, (payload) => {
        setDados((prev) => prev ? {
          ...prev,
          os: prev.os ? { ...prev.os, status: payload.new.status } : prev.os
        } : prev);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
          <div className="absolute inset-1 rounded-full border-2 border-t-blue-400 border-r-blue-400 border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-slate-500 text-xs tracking-widest uppercase">Carregando</p>
      </div>
    </div>
  );

  if (erro || !dados) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] p-4">
      <div className="max-w-sm w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-slate-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">Link não encontrado</h2>
        <p className="text-slate-500 text-sm">Este link de acompanhamento é inválido ou expirou.</p>
      </div>
    </div>
  );

  const { os, loja } = dados;
  const statusKey = os?.status ?? '';
  const statusConfig = STATUS_CONFIG[statusKey] ??
    { label: os?.status ?? 'Desconhecido', cor: 'from-slate-500/20 to-slate-600/10', textCor: 'text-slate-300', borderCor: 'border-slate-500/40', bgGlow: 'rgba(100,116,139,0.1)', emoji: '❓', icon: ClipboardList };
  const corPrimaria = loja?.cor_primaria || '#3b82f6';
  const etapaAtual = PROGRESSO[statusKey] || 0;
  const cancelada = statusKey === 'cancelada';
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 py-10"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0d1a35 0%, #0a0f1e 60%)' }}
    >
      {/* Badge tempo real */}
      <div className="mb-6 flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="text-green-400 text-xs font-medium tracking-wide">Atualização em tempo real</span>
      </div>

      {/* Card central */}
      <div className="w-full max-w-md">
        <div
          className="relative rounded-3xl border border-slate-700/60 overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #111827 0%, #0d1220 100%)', boxShadow: `0 0 60px ${statusConfig.bgGlow}, 0 25px 50px rgba(0,0,0,0.5)` }}
        >
          {/* Linha colorida topo */}
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${corPrimaria}, ${corPrimaria}66)` }} />

          <div className="p-6">
            {/* Header loja */}
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-800">
              {loja?.logo_url ? (
                <img src={loja.logo_url} alt={loja?.nome_loja ?? ''} className="h-9 w-9 rounded-xl object-contain bg-slate-800 p-1" />
              ) : (
                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${corPrimaria}22`, border: `1px solid ${corPrimaria}44` }}>
                  <Wrench className="h-4 w-4" style={{ color: corPrimaria }} />
                </div>
              )}
              <div>
                <p className="text-white font-semibold text-sm leading-tight">{loja?.nome_loja || 'Assistência Técnica'}</p>
                {loja?.telefone && <p className="text-slate-500 text-xs">{loja.telefone}</p>}
              </div>
            </div>

            {/* Número OS + Status */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">Ordem de Serviço</p>
                <h2 className="text-5xl font-black text-white leading-none">#{os?.numero_os}</h2>
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border bg-gradient-to-br ${statusConfig.cor} ${statusConfig.borderCor}`}>
                <StatusIcon className={`h-4 w-4 ${statusConfig.textCor} shrink-0`} />
                <span className={`text-xs font-semibold ${statusConfig.textCor} whitespace-nowrap`}>{statusConfig.label}</span>
              </div>
            </div>

            {/* Timeline de etapas */}
            {!cancelada && (
              <div className="mb-6">
                <div className="flex items-center justify-between relative">
                  {/* linha de fundo */}
                  <div className="absolute left-0 right-0 top-3.5 h-px bg-slate-800 z-0" />
                  {/* linha de progresso */}
                  <div
                    className="absolute left-0 top-3.5 h-px z-0 transition-all duration-700"
                    style={{
                      width: etapaAtual >= ETAPAS.length ? '100%' : `${((etapaAtual - 1) / (ETAPAS.length - 1)) * 100}%`,
                      background: `linear-gradient(90deg, ${corPrimaria}, ${corPrimaria}88)`,
                    }}
                  />
                  {ETAPAS.map((etapa, i) => {
                    const concluida = etapaAtual > i + 1;
                    const atual = etapaAtual === i + 1;
                    return (
                      <div key={etapa.key} className="flex flex-col items-center gap-1.5 z-10">
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center transition-all duration-300"
                          style={concluida || atual
                            ? { background: corPrimaria, boxShadow: atual ? `0 0 10px ${corPrimaria}` : 'none' }
                            : { background: '#1e293b', border: '1px solid #334155' }
                          }
                        >
                          {concluida ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                          ) : atual ? (
                            <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-slate-600" />
                          )}
                        </div>
                        <span className={`text-[9px] text-center leading-tight max-w-[48px] ${atual ? 'text-white font-semibold' : concluida ? 'text-slate-400' : 'text-slate-600'}`}>
                          {etapa.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {cancelada && (
              <div className="mb-6 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-red-300 text-sm">Esta ordem de serviço foi cancelada.</p>
              </div>
            )}

            {/* Separador */}
            <div className="border-t border-slate-800 mb-5" />

            {/* Infos em grid */}
            <div className="space-y-3">
              {(os?.dispositivo_marca || os?.dispositivo_modelo) && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                    <Smartphone className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Dispositivo</p>
                    <p className="text-slate-200 text-sm font-medium">{os?.dispositivo_marca} {os?.dispositivo_modelo}</p>
                  </div>
                </div>
              )}

              {os?.defeito_relatado && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Problema Relatado</p>
                    <p className="text-slate-300 text-sm">{os.defeito_relatado}</p>
                  </div>
                </div>
              )}

              {os?.total != null && os.total > 0 && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                    <DollarSign className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Valor do Serviço</p>
                    <p className="text-white text-lg font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(os.total)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Datas</p>
                  <div className="flex items-center gap-4 mt-0.5">
                    <div>
                      <p className="text-[10px] text-slate-600">Entrada</p>
                      <p className="text-slate-300 text-sm">
                        {os?.created_at ? new Date(os.created_at).toLocaleDateString('pt-BR') : '-'}
                      </p>
                    </div>
                    {os?.data_saida && (
                      <>
                        <div className="text-slate-700">→</div>
                        <div>
                          <p className="text-[10px] text-slate-600">Entrega prevista</p>
                          <p className="text-slate-300 text-sm">{new Date(os.data_saida).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Separador */}
            <div className="border-t border-slate-800 mt-5 mb-4" />

            {/* Atualizado em */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Clock className="h-3 w-3" />
                <span className="text-[10px]">Atualizado agora</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                <span className="text-[10px] text-green-500">Ao vivo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-700 text-[10px] mt-6 tracking-wide">
          Powered by <span className="text-slate-500 font-medium">Méc App</span>
        </p>
      </div>
    </div>
  );
}
