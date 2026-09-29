import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, ArrowLeft, ChevronRight, ClipboardList, Download, Loader2, Search, X } from "lucide-react";
import { TrackingPageConfig, TRACKING_CONFIG_PADRAO } from "@/types/configuracao-loja";
import {
  CardStatusOS, OSTrackingCardData, STATUS_CONFIG, formatCurrency, formatDate, lighten, nomeStatusOS,
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
  dispositivo_imei: string | null;
  /** Nome configurado pela loja (os_status_config) — nulo antes da migration 20260929120000. */
  status_nome?: string | null;
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
        dispositivo_imei: l.dispositivo_imei,
        status_nome: l.status_nome ?? null,
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

// Ordem de exibição do filtro de status — mesmas 9 chaves de STATUS_CONFIG (CardStatusOS.tsx),
// única fonte de verdade dos status reais usados em ordens_servico.
const STATUS_FILTRO_ORDEM = [
  "aberta", "aguardando_aprovacao", "em_andamento", "aguardando_peca",
  "finalizado", "aguardando_retirada", "entregue", "garantia", "cancelada",
];

interface FiltrosOSState {
  busca: string; // IMEI, modelo ou nome do cliente
  status: string; // "todos" ou uma chave de STATUS_CONFIG
  campoData: "entrada" | "saida";
  dataDe: string | null; // yyyy-mm-dd
  dataAte: string | null; // yyyy-mm-dd
}

const paraYMDLocal = (d: Date) => {
  const semFuso = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return semFuso.toISOString().slice(0, 10);
};
const hojeYMD = () => paraYMDLocal(new Date());
const diasAtrasYMD = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return paraYMDLocal(d);
};

const FILTRO_PADRAO = (): FiltrosOSState => ({
  busca: "",
  status: "todos",
  campoData: "entrada",
  dataDe: diasAtrasYMD(30),
  dataAte: hojeYMD(),
});

// Minúsculas e sem acento: "iphone" acha "iPhone", "joao" acha "João".
const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const osNaBusca = (os: OSResumo, busca: string, clienteNome: string | null): boolean => {
  const termo = normalizar(busca);
  if (!termo) return true;
  const texto = normalizar(
    [os.numero_os, os.dispositivo_marca, os.dispositivo_modelo, os.dispositivo_imei, clienteNome].filter(Boolean).join(" "),
  );
  if (texto.includes(termo)) return true;
  // IMEI digitado com espaço/traço/barra ("35 123456-789012")
  const digitos = termo.replace(/\D/g, "");
  return digitos.length >= 4 && (os.dispositivo_imei ?? "").replace(/\D/g, "").includes(digitos);
};

// Opções do filtro de status: os slugs padrão + qualquer status personalizado
// que apareça nas OS carregadas, sempre com o nome que a loja configurou
// (status_nome) quando alguma OS já trouxe esse nome.
const opcoesStatusFiltro = (osList: OSResumo[]): { slug: string; nome: string }[] => {
  const nomes = new Map<string, string>();
  osList.forEach((os) => {
    if (os.status && !nomes.has(os.status) && os.status_nome) nomes.set(os.status, os.status_nome);
  });
  const slugs = [...STATUS_FILTRO_ORDEM];
  osList.forEach((os) => {
    if (os.status && !slugs.includes(os.status)) slugs.push(os.status);
  });
  return slugs.map((slug) => ({ slug, nome: nomeStatusOS({ status: slug, status_nome: nomes.get(slug) }) }));
};

const osNoFiltro = (os: OSResumo, filtro: FiltrosOSState, clienteNome: string | null): boolean => {
  if (!osNaBusca(os, filtro.busca, clienteNome)) return false;
  if (filtro.status !== "todos" && os.status !== filtro.status) return false;
  if (filtro.dataDe || filtro.dataAte) {
    const dataRef = filtro.campoData === "entrada" ? os.created_at : os.data_saida;
    if (!dataRef) return false; // sem data nesse campo (ex.: saída de OS ainda em andamento) = fora do range
    const d = new Date(dataRef);
    if (filtro.dataDe && d < new Date(`${filtro.dataDe}T00:00:00`)) return false;
    if (filtro.dataAte && d > new Date(`${filtro.dataAte}T23:59:59.999`)) return false;
  }
  return true;
};

export default function AcompanharCliente() {
  const { token } = useParams<{ token: string }>();
  const [dados, setDados] = useState<ClienteTrackingDados | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [osSelecionada, setOsSelecionada] = useState<OSResumo | null>(null);
  const [filtro, setFiltro] = useState<FiltrosOSState>(FILTRO_PADRAO);
  const isMobile = useIsMobile();

  const atualizarFiltro = (novo: Partial<FiltrosOSState>) => setFiltro((f) => ({ ...f, ...novo }));
  const limparFiltro = () => setFiltro({ busca: "", status: "todos", campoData: "entrada", dataDe: null, dataAte: null });

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
  const osListFiltrada = osList.filter((os) => osNoFiltro(os, filtro, clienteNome));

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
      ) : (
        <>
          <FiltrosOS
            opcoesStatus={opcoesStatusFiltro(osList)}
            filtro={filtro}
            onChange={atualizarFiltro}
            onLimpar={limparFiltro}
            tc={tc}
            totalFiltrado={osListFiltrada.length}
            totalGeral={osList.length}
            onExportar={() => exportarOSParaExcel(osListFiltrada, clienteNome)}
          />
          {osListFiltrada.length === 0 ? (
            <div className="w-full max-w-4xl rounded-2xl border p-8 text-center"
              style={{ background: tc.cor_card, borderColor: `${prim}25` }}>
              <p className="text-sm" style={{ color: tc.cor_texto_secundario }}>
                Nenhuma ordem de serviço encontrada com os filtros aplicados.
              </p>
            </div>
          ) : isMobile ? (
            <ListaOSResumoMobile osList={osListFiltrada} tc={tc} onSelecionar={setOsSelecionada} />
          ) : (
            <TabelaOSResumo osList={osListFiltrada} tc={tc} onSelecionar={setOsSelecionada} />
          )}
        </>
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

// Exporta exatamente a lista exibida (busca + status + datas já aplicados), na
// mesma ordem da tela. xlsx carregado só no clique: esta página é pública e
// abre no celular do cliente, não vale pesar o bundle dela pra todo mundo.
async function exportarOSParaExcel(osList: OSResumo[], clienteNome: string | null) {
  const XLSX = await import("xlsx");
  const linhas = osList.map((os) => ({
    "OS": os.numero_os,
    "Cliente": clienteNome ?? "",
    "Status": nomeStatusOS(os),
    "Modelo": formatModelo(os) === "—" ? "" : formatModelo(os),
    // String, não número: IMEI tem 15 dígitos e o Excel viraria notação científica
    "IMEI": os.dispositivo_imei ?? "",
    "Data de Entrada": os.created_at ? formatDate(os.created_at) : "",
    "Data de Saída": formatDataSaidaResumo(os.data_saida),
    "Valor": os.total != null && os.total > 0 ? os.total : null,
  }));
  const ws = XLSX.utils.json_to_sheet(linhas);
  // Coluna Valor (H) como moeda
  for (let r = 1; r <= linhas.length; r++) {
    const cel = ws[`H${r + 1}`];
    if (cel && typeof cel.v === "number") cel.z = '"R$" #,##0.00';
  }
  ws["!cols"] = [{ wch: 8 }, { wch: 28 }, { wch: 22 }, { wch: 26 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Acompanhamento");
  const d = new Date();
  const dataArquivo = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  XLSX.writeFile(wb, `acompanhamento-os-${dataArquivo}.xlsx`);
}

interface FiltrosOSProps {
  filtro: FiltrosOSState;
  onChange: (novo: Partial<FiltrosOSState>) => void;
  onLimpar: () => void;
  tc: TrackingPageConfig;
  totalFiltrado: number;
  totalGeral: number;
  onExportar: () => Promise<void>;
  opcoesStatus: { slug: string; nome: string }[];
}

function FiltrosOS({ filtro, onChange, onLimpar, tc, totalFiltrado, totalGeral, onExportar, opcoesStatus }: FiltrosOSProps) {
  const prim = tc.cor_primaria;
  const [exportando, setExportando] = useState(false);
  const filtroAtivo = !!filtro.busca.trim() || filtro.status !== "todos" || !!filtro.dataDe || !!filtro.dataAte;

  const handleExportar = async () => {
    setExportando(true);
    try {
      await onExportar();
    } catch (e) {
      console.error("Erro ao exportar planilha:", e);
    } finally {
      setExportando(false);
    }
  };
  const campoStyle = {
    background: tc.cor_fundo,
    borderColor: `${prim}30`,
    color: tc.cor_texto,
    colorScheme: "light" as const,
  };
  const labelClass = "text-[10px] uppercase tracking-wider font-medium";
  const labelStyle = { color: tc.cor_texto_secundario + "80" };

  return (
    <div className="w-full max-w-4xl rounded-2xl border p-4 mb-4 space-y-3" style={{ background: tc.cor_card, borderColor: `${prim}25` }}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: tc.cor_texto_secundario }} />
          <input
            type="search"
            value={filtro.busca}
            onChange={(e) => onChange({ busca: e.target.value })}
            placeholder="Buscar por IMEI, modelo ou cliente"
            className="w-full text-xs rounded-lg border pl-8 pr-8 py-2 outline-none [&::-webkit-search-cancel-button]:hidden"
            style={campoStyle}
          />
          {filtro.busca && (
            <button
              type="button"
              onClick={() => onChange({ busca: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ color: tc.cor_texto_secundario }}
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleExportar}
          disabled={exportando || totalFiltrado === 0}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 transition-opacity disabled:opacity-40"
          style={{ background: prim, color: "#fff" }}
        >
          {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Exportar
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass} style={labelStyle}>Status</label>
          <select
            value={filtro.status}
            onChange={(e) => onChange({ status: e.target.value })}
            className="text-xs rounded-lg border px-2.5 py-1.5 outline-none"
            style={campoStyle}
          >
            <option value="todos">Todos</option>
            {opcoesStatus.map((o) => (
              <option key={o.slug} value={o.slug}>{o.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass} style={labelStyle}>Filtrar por</label>
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: `${prim}30` }}>
            {(["entrada", "saida"] as const).map((campo) => (
              <button
                key={campo}
                type="button"
                onClick={() => onChange({ campoData: campo })}
                className="text-xs px-2.5 py-1.5 transition-colors whitespace-nowrap"
                style={{
                  background: filtro.campoData === campo ? prim : "transparent",
                  color: filtro.campoData === campo ? "#fff" : tc.cor_texto_secundario,
                }}
              >
                {campo === "entrada" ? "Data de Entrada" : "Data de Saída"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass} style={labelStyle}>De</label>
          <input
            type="date"
            value={filtro.dataDe ?? ""}
            onChange={(e) => onChange({ dataDe: e.target.value || null })}
            className="text-xs rounded-lg border px-2.5 py-1.5 outline-none"
            style={campoStyle}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass} style={labelStyle}>Até</label>
          <input
            type="date"
            value={filtro.dataAte ?? ""}
            onChange={(e) => onChange({ dataAte: e.target.value || null })}
            className="text-xs rounded-lg border px-2.5 py-1.5 outline-none"
            style={campoStyle}
          />
        </div>

        {filtroAtivo && (
          <button
            type="button"
            onClick={onLimpar}
            className="text-xs font-medium underline underline-offset-2 ml-auto"
            style={{ color: tc.cor_texto_secundario }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <p className="text-xs" style={{ color: tc.cor_texto_secundario }}>
        Mostrando <span style={{ color: tc.cor_texto, fontWeight: 600 }}>{totalFiltrado}</span> de {totalGeral} ordens de serviço
      </p>
    </div>
  );
}

function BadgeStatus({ os, tc }: { os: OSResumo; tc: TrackingPageConfig }) {
  const Icon = STATUS_CONFIG[os.status ?? ""]?.icon ?? ClipboardList;
  const prim = tc.cor_primaria;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ color: prim, background: `${prim}12` }}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {nomeStatusOS(os)}
    </span>
  );
}

interface ListaResumoProps {
  osList: OSResumo[];
  tc: TrackingPageConfig;
  onSelecionar: (os: OSResumo) => void;
}

// data_saida só é preenchida quando a OS já foi entregue — nula = ainda em andamento.
const formatDataSaidaResumo = (d: string | null) => (d ? formatDate(d) : "Em andamento");

// Mesmo formato usado no card de detalhe (CardStatusOS): marca + modelo, "—" se os dois faltarem.
const formatModelo = (os: OSResumo) => {
  const texto = `${os.dispositivo_marca || ""} ${os.dispositivo_modelo || ""}`.trim();
  return texto || "—";
};

function TabelaOSResumo({ osList, tc, onSelecionar }: ListaResumoProps) {
  const prim = tc.cor_primaria;
  return (
    <div className="w-full max-w-4xl rounded-2xl border overflow-hidden overflow-x-auto" style={{ background: tc.cor_card, borderColor: `${prim}25` }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: `1px solid ${prim}15` }}>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-medium" style={{ color: tc.cor_texto_secundario + "80" }}>Status</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-medium" style={{ color: tc.cor_texto_secundario + "80" }}>Modelo</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-medium" style={{ color: tc.cor_texto_secundario + "80" }}>IMEI</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-medium" style={{ color: tc.cor_texto_secundario + "80" }}>Data de Entrada</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-medium" style={{ color: tc.cor_texto_secundario + "80" }}>Data de Saída</th>
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
                  <BadgeStatus os={os} tc={tc} />
                </div>
              </td>
              <td className="px-4 py-3" style={{ color: tc.cor_texto }}>
                {formatModelo(os)}
              </td>
              <td className="px-4 py-3 font-mono text-xs" style={{ color: tc.cor_texto_secundario }}>
                {os.dispositivo_imei || "—"}
              </td>
              <td className="px-4 py-3" style={{ color: tc.cor_texto }}>
                {os.created_at ? formatDate(os.created_at) : "—"}
              </td>
              <td className="px-4 py-3" style={{ color: os.data_saida ? tc.cor_texto : tc.cor_texto_secundario }}>
                {formatDataSaidaResumo(os.data_saida)}
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
              <BadgeStatus os={os} tc={tc} />
            </div>
            {(os.dispositivo_marca || os.dispositivo_modelo || os.dispositivo_imei) && (
              <div className="text-xs" style={{ color: tc.cor_texto_secundario }}>
                {formatModelo(os)}
                {os.dispositivo_imei && (
                  <span className="font-mono"> · IMEI: {os.dispositivo_imei}</span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" style={{ color: tc.cor_texto_secundario }}>
              <span>Entrada: {os.created_at ? formatDate(os.created_at) : "—"}</span>
              <span style={{ color: os.data_saida ? tc.cor_texto_secundario : tc.cor_texto_secundario + "80" }}>
                Saída: {formatDataSaidaResumo(os.data_saida)}
              </span>
            </div>
            {os.total != null && os.total > 0 && (
              <span className="block text-xs font-semibold" style={{ color: tc.cor_texto }}>{formatCurrency(os.total)}</span>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: tc.cor_texto_secundario }} />
        </button>
      ))}
    </div>
  );
}
