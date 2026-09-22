import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, ArrowLeft, ChevronRight, ClipboardList } from "lucide-react";
import { TrackingPageConfig, TRACKING_CONFIG_PADRAO } from "@/types/configuracao-loja";
import {
  CardStatusOS, OSTrackingCardData, STATUS_CONFIG, formatCurrency, formatDate, lighten,
} from "@/components/tracking/CardStatusOS";
import { HeaderLojaTracking } from "@/components/tracking/HeaderLojaTracking";
import { useIsMobile } from "@/hooks/use-mobile";

interface ClienteTrackingDados {
  clienteNome: string | null;
  osList: (OSTrackingCardData & { os_id: string })[];
  loja: {
    nome_loja: string | null;
    logo_url: string | null;
    cor_primaria: string | null;
    telefone: string | null;
    endereco: string | null;
    tracking_config: TrackingPageConfig | null;
  } | null;
}

type LinhaClienteTracking = {
  cliente_nome: string | null;
  nome_loja: string | null;
  logo_url: string | null;
  cor_primaria: string | null;
  loja_telefone: string | null;
  loja_endereco: string | null;
  cores_personalizadas: Record<string, unknown> | null;
  os_id: string | null;
  numero_os: string | null;
  status: string | null;
  defeito_relatado: string | null;
  total: number | null;
  os_created_at: string | null;
  data_saida: string | null;
  dispositivo_marca: string | null;
  dispositivo_modelo: string | null;
};

// Uma linha por OS (LEFT JOIN no RPC) — cliente sem nenhuma OS ainda vem como
// 1 linha com os_id nulo, que aqui vira "nenhuma OS" em vez de um card vazio.
const mapearLinhas = (linhas: LinhaClienteTracking[]): ClienteTrackingDados => {
  const primeira = linhas[0];
  const coresPersonalizadas = primeira?.cores_personalizadas || {};
  const trackingConfig = (coresPersonalizadas.tracking_config as TrackingPageConfig | undefined) || null;

  return {
    clienteNome: primeira?.cliente_nome ?? null,
    osList: linhas
      .filter((l): l is LinhaClienteTracking & { os_id: string; numero_os: string; os_created_at: string } =>
        !!l.os_id && !!l.numero_os && !!l.os_created_at)
      .map((l) => ({
        os_id: l.os_id,
        numero_os: l.numero_os,
        status: l.status,
        defeito_relatado: l.defeito_relatado,
        total: l.total,
        created_at: l.os_created_at,
        data_saida: l.data_saida,
        dispositivo_marca: l.dispositivo_marca,
        dispositivo_modelo: l.dispositivo_modelo,
      })),
    loja: primeira ? {
      nome_loja: primeira.nome_loja,
      logo_url: primeira.logo_url,
      cor_primaria: primeira.cor_primaria,
      telefone: primeira.loja_telefone,
      endereco: primeira.loja_endereco,
      tracking_config: trackingConfig,
    } : null,
  };
};

type OSResumo = OSTrackingCardData & { os_id: string };

export default function AcompanharCliente() {
  const { token } = useParams<{ token: string }>();
  const [dados, setDados] = useState<ClienteTrackingDados | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [osSelecionada, setOsSelecionada] = useState<OSResumo | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!token) return;

    // Carga inicial: incrementa visualizacoes uma unica vez.
    const carregarInicial = async () => {
      try {
        const { data, error } = await supabase.rpc("get_cliente_tracking", { p_token: token });
        if (error || !data || data.length === 0) { setErro(true); return; }
        setDados(mapearLinhas(data as LinhaClienteTracking[]));
      } catch {
        setErro(true);
      } finally {
        setLoading(false);
      }
    };

    // Polling: so leitura, nao incrementa visualizacoes.
    const atualizarStatus = async () => {
      const { data, error } = await supabase.rpc("get_cliente_tracking_status", { p_token: token });
      if (error || !data || data.length === 0) return;
      setDados(mapearLinhas(data as LinhaClienteTracking[]));
    };

    carregarInicial();
    const intervalo = setInterval(atualizarStatus, 15000);
    return () => clearInterval(intervalo);
  }, [token]);

  // Mantem o detalhe aberto em dia com o polling (status pode mudar enquanto o cliente olha).
  useEffect(() => {
    if (!osSelecionada || !dados) return;
    const atualizada = dados.osList.find((os) => os.os_id === osSelecionada.os_id);
    if (atualizada && atualizada !== osSelecionada) setOsSelecionada(atualizada);
  }, [dados, osSelecionada]);

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

  const { clienteNome, osList, loja } = dados;

  const tc: TrackingPageConfig = {
    ...TRACKING_CONFIG_PADRAO,
    ...(loja?.tracking_config || {}),
    cor_primaria: loja?.tracking_config?.cor_primaria || loja?.cor_primaria || TRACKING_CONFIG_PADRAO.cor_primaria,
  };
  const prim = tc.cor_primaria;

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

      <HeaderLojaTracking nomeLoja={loja?.nome_loja ?? null} logoUrl={loja?.logo_url ?? null} telefone={loja?.telefone ?? null} tc={tc} />

      {clienteNome && (
        <p className="w-full max-w-md text-sm font-medium mb-4 px-1" style={{ color: tc.cor_texto_secundario }}>
          Ordens de serviço de <span style={{ color: tc.cor_texto, fontWeight: 700 }}>{clienteNome}</span>
        </p>
      )}

      {osList.length === 0 ? (
        <div className="w-full max-w-md rounded-2xl border p-8 text-center"
          style={{ background: tc.cor_card, borderColor: `${prim}25` }}>
          <p className="text-sm" style={{ color: tc.cor_texto_secundario }}>
            Nenhuma ordem de serviço encontrada.
          </p>
        </div>
      ) : isMobile ? (
        <ListaOSResumoMobile osList={osList} tc={tc} onSelecionar={setOsSelecionada} />
      ) : (
        <TabelaOSResumo osList={osList} tc={tc} onSelecionar={setOsSelecionada} />
      )}

      {/* Footer */}
      <p className="text-center text-[11px] mt-5" style={{ color: tc.cor_texto_secundario + "50" }}>
        {tc.mensagem_rodape || `Powered by Méc App`}
      </p>

      {/* Detalhe completo de uma OS — mesmo CardStatusOS do link individual, só revelado sob clique aqui */}
      {osSelecionada && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-8 sm:items-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={() => setOsSelecionada(null)}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOsSelecionada(null)}
              className="mb-3 flex items-center gap-1.5 text-sm font-medium"
              style={{ color: tc.cor_texto_secundario }}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para a lista
            </button>
            <CardStatusOS
              os={osSelecionada}
              tc={tc}
              nomeLoja={loja?.nome_loja ?? null}
              clienteNome={clienteNome}
              mostrarNomeCliente={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Resumo por OS (status + data + valor) — desktop vira tabela, mobile vira lista de cards.
// Clicar numa linha/card abre o CardStatusOS completo (timeline, defeito, PDF) no modal acima.
// Nenhuma lógica de status/timeline é duplicada aqui: só rótulo/ícone de STATUS_CONFIG (já
// exportado por CardStatusOS.tsx) para o resumo — o detalhe em si é sempre o componente real.

function BadgeStatus({ status, tc }: { status: string | null; tc: TrackingPageConfig }) {
  const cfg = STATUS_CONFIG[status ?? ""] ?? { label: status ?? "Desconhecido", emoji: "❓", icon: ClipboardList };
  const Icon = cfg.icon;
  const prim = tc.cor_primaria;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ color: prim, background: `${prim}12` }}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {cfg.label}
    </span>
  );
}

interface ListaResumoProps {
  osList: OSResumo[];
  tc: TrackingPageConfig;
  onSelecionar: (os: OSResumo) => void;
}

function TabelaOSResumo({ osList, tc, onSelecionar }: ListaResumoProps) {
  const prim = tc.cor_primaria;
  return (
    <div className="w-full max-w-2xl rounded-2xl border overflow-hidden" style={{ background: tc.cor_card, borderColor: `${prim}25` }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: `1px solid ${prim}15` }}>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-medium" style={{ color: tc.cor_texto_secundario + "80" }}>Status</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-medium" style={{ color: tc.cor_texto_secundario + "80" }}>Data</th>
            <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider font-medium" style={{ color: tc.cor_texto_secundario + "80" }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {osList.map((os) => (
            <tr
              key={os.os_id}
              onClick={() => onSelecionar(os)}
              className="cursor-pointer transition-colors hover:brightness-110"
              style={{ borderBottom: `1px solid ${prim}10` }}
            >
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold" style={{ color: tc.cor_texto }}>#{os.numero_os}</span>
                  <BadgeStatus status={os.status} tc={tc} />
                </div>
              </td>
              <td className="px-4 py-3" style={{ color: tc.cor_texto }}>
                {os.created_at ? formatDate(os.created_at) : "—"}
              </td>
              <td className="px-4 py-3 text-right font-semibold" style={{ color: tc.cor_texto }}>
                {os.total != null && os.total > 0 ? formatCurrency(os.total) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListaOSResumoMobile({ osList, tc, onSelecionar }: ListaResumoProps) {
  const prim = tc.cor_primaria;
  return (
    <div className="w-full max-w-md space-y-2.5">
      {osList.map((os) => (
        <button
          key={os.os_id}
          type="button"
          onClick={() => onSelecionar(os)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-colors active:brightness-110"
          style={{ background: tc.cor_card, borderColor: `${prim}25` }}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: tc.cor_texto }}>#{os.numero_os}</span>
              <BadgeStatus status={os.status} tc={tc} />
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: tc.cor_texto_secundario }}>
              <span>{os.created_at ? formatDate(os.created_at) : "—"}</span>
              {os.total != null && os.total > 0 && (
                <span className="font-semibold" style={{ color: tc.cor_texto }}>{formatCurrency(os.total)}</span>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: tc.cor_texto_secundario }} />
        </button>
      ))}
    </div>
  );
}
