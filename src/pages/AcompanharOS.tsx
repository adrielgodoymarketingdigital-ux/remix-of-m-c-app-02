import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Smartphone, Wrench, CalendarDays, DollarSign, AlertCircle,
  CheckCircle2, Clock, PackageSearch, XCircle, ClipboardList,
} from "lucide-react";
import { TrackingPageConfig, TRACKING_CONFIG_PADRAO } from "@/types/configuracao-loja";

// Mapeamento de status do sistema → label/ícone de exibição
const STATUS_CONFIG: Record<string, {
  label: string;
  emoji: string;
  icon: typeof CheckCircle2;
}> = {
  aberta:              { label: "Recebida",          emoji: "📋", icon: ClipboardList },
  aguardando_aprovacao:{ label: "Aguard. Aprovação", emoji: "⏳", icon: Clock },
  em_andamento:        { label: "Em Reparo",         emoji: "🔧", icon: Wrench },
  aguardando_peca:     { label: "Aguardando Peça",   emoji: "📦", icon: PackageSearch },
  finalizado:          { label: "Finalizado",        emoji: "✔️", icon: CheckCircle2 },
  aguardando_retirada: { label: "Pronto p/ Retirada",emoji: "✅", icon: CheckCircle2 },
  entregue:            { label: "Entregue",          emoji: "🎉", icon: CheckCircle2 },
  cancelada:           { label: "Cancelada",         emoji: "❌", icon: XCircle },
  garantia:            { label: "Em Garantia",       emoji: "🛡️", icon: CheckCircle2 },
};

const ETAPAS = [
  { key: "aberta",               label: "Recebida" },
  { key: "em_andamento",         label: "Em Reparo" },
  { key: "aguardando_peca",      label: "Aguard. Peça" },
  { key: "aguardando_retirada",  label: "Pronto" },
  { key: "entregue",             label: "Entregue" },
];

const PROGRESSO: Record<string, number> = {
  aberta: 1,
  aguardando_aprovacao: 1,
  em_andamento: 2,
  aguardando_peca: 3,
  finalizado: 3,
  aguardando_retirada: 4,
  entregue: 5,
  cancelada: 0,
  garantia: 4,
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
    tracking_config: TrackingPageConfig | null;
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
          .from("os_tracking_links")
          .select("os_id, user_id, visualizacoes")
          .eq("token", token)
          .eq("ativo", true)
          .maybeSingle();

        if (linkError || !linkData) { setErro(true); return; }

        await supabase
          .from("os_tracking_links")
          .update({ visualizacoes: (linkData.visualizacoes || 0) + 1 })
          .eq("token", token);

        const { data: osData } = await supabase
          .from("ordens_servico")
          .select(`
            numero_os, status, defeito_relatado,
            total, created_at, data_saida,
            dispositivo_marca, dispositivo_modelo,
            cliente:clientes(nome, telefone)
          `)
          .eq("id", linkData.os_id)
          .maybeSingle();

        const { data: lojaData } = await supabase
          .from("configuracoes_loja")
          .select("nome_loja, logo_url, cor_primaria, telefone, endereco, cores_personalizadas")
          .eq("user_id", linkData.user_id)
          .maybeSingle();

        // tracking_config fica dentro de cores_personalizadas no banco
        const coresPersonalizadas = (lojaData?.cores_personalizadas as Record<string, unknown> | null) || {};
        const trackingConfig = (coresPersonalizadas.tracking_config as TrackingPageConfig | undefined) || null;

        setDados({
          os: osData as TrackingDados["os"],
          loja: lojaData ? {
            nome_loja: lojaData.nome_loja,
            logo_url: lojaData.logo_url,
            cor_primaria: lojaData.cor_primaria,
            telefone: lojaData.telefone,
            endereco: lojaData.endereco,
            tracking_config: trackingConfig,
          } : null,
        });
      } catch {
        setErro(true);
      } finally {
        setLoading(false);
      }
    };

    buscarDados();

    const channel = supabase
      .channel(`os-tracking-${token}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ordens_servico" }, (payload) => {
        setDados((prev) =>
          prev ? { ...prev, os: prev.os ? { ...prev.os, status: payload.new.status } : prev.os } : prev
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [token]);

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f1e" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
          <div className="absolute inset-1 rounded-full border-2 border-t-blue-400 border-r-blue-400 border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-slate-500 text-xs tracking-widest uppercase">Carregando</p>
      </div>
    </div>
  );

  // ── Erro ─────────────────────────────────────────────────────────
  if (erro || !dados) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0a0f1e" }}>
      <div className="max-w-sm w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-slate-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">Link não encontrado</h2>
        <p className="text-slate-500 text-sm">Este link de acompanhamento é inválido ou expirou.</p>
      </div>
    </div>
  );

  const { os, loja } = dados;

  // Resolver config de cores — tracking_config salvo > cor_primaria da loja > padrão
  const tc: TrackingPageConfig = {
    ...TRACKING_CONFIG_PADRAO,
    ...(loja?.tracking_config || {}),
    // Se não tem tracking_config, usa a cor_primaria da loja como destaque
    cor_primaria: loja?.tracking_config?.cor_primaria || loja?.cor_primaria || TRACKING_CONFIG_PADRAO.cor_primaria,
  };

  const statusKey = os?.status ?? "";
  const statusCfg = STATUS_CONFIG[statusKey] ?? {
    label: os?.status ?? "Desconhecido", emoji: "❓", icon: ClipboardList,
  };
  const StatusIcon = statusCfg.icon;
  const cancelada = statusKey === "cancelada";
  const etapaAtual = PROGRESSO[statusKey] || 0;
  const prim = tc.cor_primaria;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

  return (
    <div
      className="min-h-screen flex flex-col items-center p-4 py-8"
      style={{ background: `radial-gradient(ellipse at 50% 0%, ${lighten(tc.cor_fundo, 0.05)} 0%, ${tc.cor_fundo} 65%)` }}
    >
      {/* Badge tempo real */}
      <div className="mb-6 flex items-center gap-2 rounded-full px-4 py-1.5 border"
        style={{ background: `${prim}15`, borderColor: `${prim}30` }}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: prim }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: prim }} />
        </span>
        <span className="text-xs font-medium" style={{ color: prim }}>Atualização em tempo real</span>
      </div>

      {/* Card central */}
      <div className="w-full max-w-md">
        <div
          className="relative rounded-3xl border overflow-hidden"
          style={{
            background: tc.cor_card,
            borderColor: `${prim}25`,
            boxShadow: `0 0 80px ${prim}18, 0 25px 60px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Linha colorida topo */}
          <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${prim}, ${prim}55)` }} />

          {/* Brilho de canto */}
          <div className="absolute top-0 right-0 w-40 h-40 opacity-5 pointer-events-none"
            style={{ background: `radial-gradient(circle at 100% 0%, ${prim} 0%, transparent 70%)` }} />

          <div className="p-6">
            {/* ── Header Loja ─────────────────────────────────── */}
            {tc.mostrar_logo && (
              <div className="flex items-center gap-4 mb-6 pb-5"
                style={{ borderBottom: `1px solid ${prim}18` }}>
                {loja?.logo_url ? (
                  <div className="h-14 w-14 rounded-2xl overflow-hidden shrink-0 border flex items-center justify-center"
                    style={{ background: `${prim}10`, borderColor: `${prim}30` }}>
                    <img
                      src={loja.logo_url}
                      alt={loja.nome_loja ?? ""}
                      className="h-full w-full object-contain p-1.5"
                    />
                  </div>
                ) : (
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 border"
                    style={{ background: `${prim}15`, borderColor: `${prim}35` }}>
                    <Wrench className="h-6 w-6" style={{ color: prim }} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-base leading-tight truncate" style={{ color: tc.cor_texto }}>
                    {loja?.nome_loja || "Assistência Técnica"}
                  </p>
                  {loja?.telefone && (
                    <p className="text-sm mt-0.5" style={{ color: tc.cor_texto_secundario }}>
                      {loja.telefone}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Número OS + Status ───────────────────────────── */}
            <div className="flex items-start justify-between mb-6 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: tc.cor_texto_secundario }}>
                  Ordem de Serviço
                </p>
                <h2 className="text-5xl font-black leading-none" style={{ color: tc.cor_texto }}>
                  #{os?.numero_os}
                </h2>
                {os?.cliente?.nome && (
                  <p className="text-sm mt-2 font-medium" style={{ color: tc.cor_texto_secundario }}>
                    {os.cliente.nome}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border shrink-0"
                style={{ color: prim, borderColor: `${prim}40`, background: `${prim}12` }}>
                <StatusIcon className="h-4 w-4 shrink-0" />
                <span className="text-xs font-semibold whitespace-nowrap">{statusCfg.label}</span>
              </div>
            </div>

            {/* ── Timeline ─────────────────────────────────────── */}
            {!cancelada && (
              <div className="mb-6">
                <div className="flex items-center justify-between relative">
                  <div className="absolute left-0 right-0 top-3.5 h-px z-0"
                    style={{ background: `${tc.cor_texto_secundario}20` }} />
                  <div
                    className="absolute left-0 top-3.5 h-px z-0 transition-all duration-700"
                    style={{
                      width: etapaAtual >= ETAPAS.length ? "100%" : `${((etapaAtual - 1) / (ETAPAS.length - 1)) * 100}%`,
                      background: `linear-gradient(90deg, ${prim}, ${prim}88)`,
                    }}
                  />
                  {ETAPAS.map((etapa, i) => {
                    const concluida = etapaAtual > i + 1;
                    const atual = etapaAtual === i + 1;
                    return (
                      <div key={etapa.key} className="flex flex-col items-center gap-1.5 z-10">
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center transition-all duration-300"
                          style={
                            concluida || atual
                              ? { background: prim, boxShadow: atual ? `0 0 12px ${prim}` : "none" }
                              : { background: tc.cor_card, border: `1px solid ${tc.cor_texto_secundario}30` }
                          }
                        >
                          {concluida ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                          ) : atual ? (
                            <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                          ) : (
                            <div className="h-2 w-2 rounded-full" style={{ background: tc.cor_texto_secundario + "40" }} />
                          )}
                        </div>
                        <span
                          className="text-[9px] text-center leading-tight max-w-[46px]"
                          style={{
                            color: atual ? tc.cor_texto : concluida ? tc.cor_texto_secundario : tc.cor_texto_secundario + "50",
                            fontWeight: atual ? 700 : 400,
                          }}
                        >
                          {etapa.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cancelada */}
            {cancelada && (
              <div className="mb-6 flex items-center gap-2 rounded-xl px-4 py-3 border"
                style={{ background: "#ef444410", borderColor: "#ef444430" }}>
                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-red-300 text-sm">Esta ordem de serviço foi cancelada.</p>
              </div>
            )}

            {/* Separador */}
            <div className="mb-5" style={{ borderTop: `1px solid ${prim}15` }} />

            {/* ── Informações ──────────────────────────────────── */}
            <div className="space-y-3.5">
              {(os?.dispositivo_marca || os?.dispositivo_modelo) && (
                <InfoRow
                  icon={<Smartphone className="h-4 w-4" />}
                  label="Dispositivo"
                  value={`${os?.dispositivo_marca || ""} ${os?.dispositivo_modelo || ""}`.trim()}
                  tc={tc}
                />
              )}

              {tc.mostrar_defeito && os?.defeito_relatado && (
                <InfoRow
                  icon={<AlertCircle className="h-4 w-4" />}
                  label="Problema Relatado"
                  value={os.defeito_relatado}
                  tc={tc}
                />
              )}

              {tc.mostrar_valor && os?.total != null && os.total > 0 && (
                <InfoRow
                  icon={<DollarSign className="h-4 w-4" />}
                  label="Valor do Serviço"
                  value={formatCurrency(os.total)}
                  tc={tc}
                  destaque
                />
              )}

              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: tc.cor_texto_secundario + "12", color: tc.cor_texto_secundario }}>
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: tc.cor_texto_secundario + "80" }}>
                    Datas
                  </p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[10px]" style={{ color: tc.cor_texto_secundario + "60" }}>Entrada</p>
                      <p className="text-sm font-medium" style={{ color: tc.cor_texto }}>
                        {os?.created_at ? formatDate(os.created_at) : "—"}
                      </p>
                    </div>
                    {os?.data_saida && (
                      <>
                        <span style={{ color: tc.cor_texto_secundario + "40" }}>→</span>
                        <div>
                          <p className="text-[10px]" style={{ color: tc.cor_texto_secundario + "60" }}>Prev. entrega</p>
                          <p className="text-sm font-medium" style={{ color: tc.cor_texto }}>{formatDate(os.data_saida)}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Separador rodapé */}
            <div className="mt-5 pt-4 flex items-center justify-between"
              style={{ borderTop: `1px solid ${prim}15` }}>
              <div className="flex items-center gap-1.5" style={{ color: tc.cor_texto_secundario + "60" }}>
                <Clock className="h-3 w-3" />
                <span className="text-[10px]">Atualizado agora</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: prim }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: prim }} />
                </span>
                <span className="text-[10px] font-medium" style={{ color: prim }}>Ao vivo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] mt-5" style={{ color: tc.cor_texto_secundario + "50" }}>
          {tc.mensagem_rodape || `Powered by Méc App`}
        </p>
      </div>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────

function InfoRow({
  icon, label, value, tc, destaque,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tc: TrackingPageConfig;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: tc.cor_texto_secundario + "12", color: tc.cor_texto_secundario }}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider" style={{ color: tc.cor_texto_secundario + "80" }}>{label}</p>
        <p
          className="text-sm mt-0.5"
          style={{ color: destaque ? tc.cor_primaria : tc.cor_texto, fontWeight: destaque ? 700 : 400, fontSize: destaque ? "1.1rem" : undefined }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// Clareamento leve de hex para o radial-gradient do fundo
function lighten(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return hex;
  const r = Math.min(255, Math.round(parseInt(c.slice(0, 2), 16) + 255 * amount));
  const g = Math.min(255, Math.round(parseInt(c.slice(2, 4), 16) + 255 * amount));
  const b = Math.min(255, Math.round(parseInt(c.slice(4, 6), 16) + 255 * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
