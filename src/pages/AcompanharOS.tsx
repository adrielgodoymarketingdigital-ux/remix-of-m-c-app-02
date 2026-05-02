import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const STATUS_CONFIG: Record<string, { label: string; cor: string; emoji: string }> = {
  aberta: { label: "Aberta", cor: "bg-blue-500/20 text-blue-300 border border-blue-500/30", emoji: "📋" },
  em_andamento: { label: "Em Andamento", cor: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30", emoji: "🔧" },
  aguardando_peca: { label: "Aguardando Peça", cor: "bg-orange-500/20 text-orange-300 border border-orange-500/30", emoji: "⏳" },
  aguardando_retirada: { label: "Aguardando Retirada", cor: "bg-green-500/20 text-green-300 border border-green-500/30", emoji: "✅" },
  entregue: { label: "Entregue", cor: "bg-slate-500/20 text-slate-300 border border-slate-500/30", emoji: "📦" },
  cancelada: { label: "Cancelada", cor: "bg-red-500/20 text-red-300 border border-red-500/30", emoji: "❌" },
};

const PROGRESSO: Record<string, number> = {
  aberta: 10, em_andamento: 40, aguardando_peca: 55,
  aguardando_retirada: 80, entregue: 100, cancelada: 0,
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

        if (linkError || !linkData) {
          setErro(true);
          return;
        }

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
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ordens_servico',
      }, (payload) => {
        setDados((prev) => prev ? {
          ...prev,
          os: prev.os ? { ...prev.os, status: payload.new.status } : prev.os
        } : prev);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
    </div>
  );

  if (erro || !dados) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur p-8 text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h2 className="text-xl font-bold text-white mb-2">Link não encontrado</h2>
        <p className="text-slate-400">
          Este link de acompanhamento é inválido ou expirou.
        </p>
      </div>
    </div>
  );

  const { os, loja } = dados;
  const statusConfig = STATUS_CONFIG[os?.status ?? ''] ??
    { label: os?.status ?? 'Desconhecido', cor: 'bg-slate-500/20 text-slate-300 border border-slate-500/30', emoji: '❓' };
  const corPrimaria = loja?.cor_primaria || '#3b82f6';
  const progressoPercent = PROGRESSO[os?.status || ''] || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">

      {/* Badge tempo real */}
      <div className="flex justify-center pt-6 pb-2">
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-green-400 text-xs font-medium">Atualização em tempo real</span>
        </div>
      </div>

      {/* Header da loja */}
      <div className="text-center px-4 pb-6">
        {loja?.logo_url && (
          <img
            src={loja.logo_url}
            alt={loja?.nome_loja ?? ''}
            className="h-14 mx-auto mb-3 object-contain drop-shadow-lg"
          />
        )}
        <h1 className="text-xl font-bold text-white">{loja?.nome_loja || 'Assistência Técnica'}</h1>
        {loja?.telefone && (
          <p className="text-slate-400 text-sm mt-1">{loja.telefone}</p>
        )}
      </div>

      {/* Card principal de status */}
      <div className="mx-4 mb-4 relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur p-6">
        <div
          className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
          style={{ background: `linear-gradient(90deg, ${corPrimaria}, ${corPrimaria}88)` }}
        />

        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-1">
              Ordem de Serviço
            </p>
            <h2 className="text-4xl font-black text-white">#{os?.numero_os}</h2>
          </div>
          <div className="text-right">
            <div className="text-3xl mb-2">{statusConfig.emoji}</div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.cor}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Progresso do serviço</span>
            <span>{progressoPercent}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${progressoPercent}%`,
                background: `linear-gradient(90deg, ${corPrimaria}, ${corPrimaria}cc)`,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>Aberta</span>
            <span>Andamento</span>
            <span>Pronto</span>
            <span>Entregue</span>
          </div>
        </div>
      </div>

      {/* Dispositivo */}
      {(os?.dispositivo_marca || os?.dispositivo_modelo) && (
        <div className="mx-4 mb-4 rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur p-5">
          <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3">
            📱 Dispositivo
          </p>
          <p className="text-white font-semibold">{os?.dispositivo_marca} {os?.dispositivo_modelo}</p>
        </div>
      )}

      {/* Problema relatado */}
      {os?.defeito_relatado && (
        <div className="mx-4 mb-4 rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur p-5">
          <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3">
            🔍 Problema Relatado
          </p>
          <p className="text-slate-300 text-sm">{os.defeito_relatado}</p>
        </div>
      )}

      {/* Valor */}
      {os?.total != null && os.total > 0 && (
        <div className="mx-4 mb-4 rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur p-5">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">Valor do Serviço</p>
            <p className="text-white text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(os.total)}
            </p>
          </div>
        </div>
      )}

      {/* Datas */}
      <div className="mx-4 mb-4 rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur p-5">
        <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3">
          📅 Datas
        </p>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Entrada</span>
            <span className="text-slate-300">
              {os?.created_at ? new Date(os.created_at).toLocaleDateString('pt-BR') : '-'}
            </span>
          </div>
          {os?.data_saida && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Entrega</span>
              <span className="text-slate-300">
                {new Date(os.data_saida).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8 space-y-1">
        <p className="text-slate-500 text-xs">Powered by</p>
        <p className="text-slate-300 text-sm font-semibold">Méc App</p>
        <p className="text-slate-600 text-[10px]">
          Sistema de Gestão para Assistências Técnicas
        </p>
      </div>
    </div>
  );
}
