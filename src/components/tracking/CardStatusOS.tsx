import { useState } from "react";
import {
  Smartphone, Wrench, CalendarDays, DollarSign, AlertCircle,
  CheckCircle2, Clock, PackageSearch, XCircle, ClipboardList, Download, Loader2,
} from "lucide-react";
import { TrackingPageConfig } from "@/types/configuracao-loja";
import { downloadPDFAcompanhamentoPublico } from "@/lib/gerarOrdemServicoPDF";
import { toast } from "sonner";

// Mapeamento de status do sistema → label/ícone de exibição. Compartilhado entre
// a página de acompanhamento de uma OS (AcompanharOS) e a de um cliente
// (AcompanharCliente, uma lista de cards deste componente).
export const STATUS_CONFIG: Record<string, {
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

export interface OSTrackingCardData {
  numero_os: string;
  status: string | null;
  defeito_relatado: string | null;
  total: number | null;
  created_at: string;
  data_saida: string | null;
  dispositivo_marca: string | null;
  dispositivo_modelo: string | null;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

interface CardStatusOSProps {
  os: OSTrackingCardData;
  tc: TrackingPageConfig;
  nomeLoja: string | null;
  clienteNome: string | null;
  /** Mostra o nome do cliente dentro do card (link individual). No link por
   * cliente o nome já aparece uma vez no cabeçalho da página — omitir aqui. */
  mostrarNomeCliente?: boolean;
}

export function CardStatusOS({ os, tc, nomeLoja, clienteNome, mostrarNomeCliente = true }: CardStatusOSProps) {
  const [baixandoPDF, setBaixandoPDF] = useState(false);

  const statusKey = os.status ?? "";
  const statusCfg = STATUS_CONFIG[statusKey] ?? {
    label: os.status ?? "Desconhecido", emoji: "❓", icon: ClipboardList,
  };
  const StatusIcon = statusCfg.icon;
  const cancelada = statusKey === "cancelada";
  const etapaAtual = PROGRESSO[statusKey] || 0;
  const prim = tc.cor_primaria;

  const handleBaixarPDF = async () => {
    setBaixandoPDF(true);
    try {
      await downloadPDFAcompanhamentoPublico({
        numeroOS: os.numero_os,
        status: os.status,
        statusLabel: statusCfg.label,
        defeitoRelatado: os.defeito_relatado,
        total: os.total,
        createdAt: os.created_at,
        dataSaida: os.data_saida,
        dispositivoMarca: os.dispositivo_marca,
        dispositivoModelo: os.dispositivo_modelo,
        clienteNome,
        nomeLoja,
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar o PDF. Tente novamente.");
    } finally {
      setBaixandoPDF(false);
    }
  };

  return (
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
          {/* ── Número OS + Status ───────────────────────────── */}
          <div className="flex items-start justify-between mb-6 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: tc.cor_texto_secundario }}>
                Ordem de Serviço
              </p>
              <h2 className="text-5xl font-black leading-none" style={{ color: tc.cor_texto }}>
                #{os.numero_os}
              </h2>
              {mostrarNomeCliente && clienteNome && (
                <p className="text-sm mt-2 font-medium" style={{ color: tc.cor_texto_secundario }}>
                  {clienteNome}
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
            {(os.dispositivo_marca || os.dispositivo_modelo) && (
              <InfoRow
                icon={<Smartphone className="h-4 w-4" />}
                label="Dispositivo"
                value={`${os.dispositivo_marca || ""} ${os.dispositivo_modelo || ""}`.trim()}
                tc={tc}
              />
            )}

            {tc.mostrar_defeito && os.defeito_relatado && (
              <InfoRow
                icon={<AlertCircle className="h-4 w-4" />}
                label="Problema Relatado"
                value={os.defeito_relatado}
                tc={tc}
              />
            )}

            {tc.mostrar_valor && os.total != null && os.total > 0 && (
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
                      {os.created_at ? formatDate(os.created_at) : "—"}
                    </p>
                  </div>
                  {os.data_saida && (
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

      {/* Baixar PDF */}
      <button
        type="button"
        onClick={handleBaixarPDF}
        disabled={baixandoPDF}
        className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
        style={{ color: prim, borderColor: `${prim}40`, background: `${prim}10` }}
      >
        {baixandoPDF ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando PDF...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Baixar PDF da OS
          </>
        )}
      </button>
    </div>
  );
}

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

// Clareamento leve de hex para o radial-gradient do fundo — usado no fundo da
// página (AcompanharOS/AcompanharCliente), não dentro do card em si.
export function lighten(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return hex;
  const r = Math.min(255, Math.round(parseInt(c.slice(0, 2), 16) + 255 * amount));
  const g = Math.min(255, Math.round(parseInt(c.slice(2, 4), 16) + 255 * amount));
  const b = Math.min(255, Math.round(parseInt(c.slice(4, 6), 16) + 255 * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
