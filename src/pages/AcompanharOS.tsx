import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle } from "lucide-react";
import { TrackingPageConfig, TRACKING_CONFIG_PADRAO } from "@/types/configuracao-loja";
import { CardStatusOS, OSTrackingCardData, lighten } from "@/components/tracking/CardStatusOS";
import { HeaderLojaTracking } from "@/components/tracking/HeaderLojaTracking";

interface TrackingDados {
  os: (OSTrackingCardData & {
    cliente: { nome: string; telefone: string | null } | null;
  }) | null;
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

    type LinhaTracking = {
      numero_os: string;
      status: string | null;
      defeito_relatado: string | null;
      total: number | null;
      os_created_at: string;
      data_saida: string | null;
      dispositivo_marca: string | null;
      dispositivo_modelo: string | null;
      cliente_nome: string | null;
      cliente_telefone: string | null;
      nome_loja: string | null;
      logo_url: string | null;
      cor_primaria: string | null;
      loja_telefone: string | null;
      loja_endereco: string | null;
      cores_personalizadas: Record<string, unknown> | null;
      /** Nome configurado pela loja (os_status_config) — nulo antes da migration 20260929120000. */
      status_nome?: string | null;
    };

    const mapearLinha = (linha: LinhaTracking): TrackingDados => {
      const coresPersonalizadas = linha.cores_personalizadas || {};
      const trackingConfig = (coresPersonalizadas.tracking_config as TrackingPageConfig | undefined) || null;

      return {
        os: {
          numero_os: linha.numero_os,
          status: linha.status,
          defeito_relatado: linha.defeito_relatado,
          total: linha.total,
          created_at: linha.os_created_at,
          data_saida: linha.data_saida,
          dispositivo_marca: linha.dispositivo_marca,
          dispositivo_modelo: linha.dispositivo_modelo,
          status_nome: linha.status_nome ?? null,
          cliente: linha.cliente_nome ? { nome: linha.cliente_nome, telefone: linha.cliente_telefone } : null,
        },
        loja: {
          nome_loja: linha.nome_loja,
          logo_url: linha.logo_url,
          cor_primaria: linha.cor_primaria,
          telefone: linha.loja_telefone,
          endereco: linha.loja_endereco,
          tracking_config: trackingConfig,
        },
      };
    };

    // Carga inicial: incrementa visualizacoes uma unica vez.
    const carregarInicial = async () => {
      try {
        const { data, error } = await supabase.rpc("get_os_tracking", { p_token: token });
        const linha = data?.[0];
        if (error || !linha) { setErro(true); return; }
        setDados(mapearLinha(linha as LinhaTracking));
      } catch {
        setErro(true);
      } finally {
        setLoading(false);
      }
    };

    // Polling: so leitura, nao incrementa visualizacoes.
    const atualizarStatus = async () => {
      const { data, error } = await supabase.rpc("get_os_tracking_status", { p_token: token });
      const linha = data?.[0];
      if (error || !linha) return;
      setDados(mapearLinha(linha as LinhaTracking));
    };

    carregarInicial();
    const intervalo = setInterval(atualizarStatus, 15000);
    return () => clearInterval(intervalo);
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
  if (erro || !dados || !dados.os) return (
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

      <CardStatusOS os={os} tc={tc} nomeLoja={loja?.nome_loja ?? null} clienteNome={os.cliente?.nome ?? null} />

      {/* Footer */}
      <p className="text-center text-[11px] mt-5" style={{ color: tc.cor_texto_secundario + "50" }}>
        {tc.mensagem_rodape || `Powered by Méc App`}
      </p>
    </div>
  );
}
