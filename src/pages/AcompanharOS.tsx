import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_CONFIG: Record<string, { label: string; cor: string; emoji: string }> = {
  aberta: { label: "Aberta", cor: "bg-blue-100 text-blue-800", emoji: "📋" },
  em_andamento: { label: "Em Andamento", cor: "bg-yellow-100 text-yellow-800", emoji: "🔧" },
  aguardando_peca: { label: "Aguardando Peça", cor: "bg-orange-100 text-orange-800", emoji: "⏳" },
  aguardando_retirada: { label: "Aguardando Retirada", cor: "bg-green-100 text-green-800", emoji: "✅" },
  entregue: { label: "Entregue", cor: "bg-gray-100 text-gray-800", emoji: "📦" },
  cancelada: { label: "Cancelada", cor: "bg-red-100 text-red-800", emoji: "❌" },
};

interface TrackingDados {
  os: {
    numero_os: string;
    status: string | null;
    descricao_problema: string | null;
    descricao_solucao: string | null;
    valor_total: number | null;
    created_at: string;
    data_saida: string | null;
    fotos: string[] | null;
    cliente: { nome: string; celular: string } | null;
    dispositivo: { marca: string; modelo: string } | null;
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
            numero_os, status, descricao_problema, descricao_solucao,
            valor_total, created_at, data_saida, fotos,
            cliente:clientes(nome, celular),
            dispositivo:dispositivos(marca, modelo)
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  if (erro || !dados) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-xl font-bold mb-2">Link não encontrado</h2>
          <p className="text-muted-foreground">
            Este link de acompanhamento é inválido ou expirou.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const { os, loja } = dados;
  const statusConfig = STATUS_CONFIG[os?.status ?? ''] ??
    { label: os?.status ?? 'Desconhecido', cor: 'bg-gray-100 text-gray-800', emoji: '❓' };
  const corPrimaria = loja?.cor_primaria || '#3b82f6';

  const STATUS_ORDEM = ['aberta', 'em_andamento', 'aguardando_peca', 'aguardando_retirada', 'entregue'];
  const STEPS_PROGRESSO = ['aberta', 'em_andamento', 'aguardando_retirada', 'entregue'];
  const indiceAtual = STATUS_ORDEM.indexOf(os?.status ?? '');

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className="w-full py-6 px-4 text-white text-center"
        style={{ backgroundColor: corPrimaria }}
      >
        {loja?.logo_url && (
          <img
            src={loja.logo_url}
            alt={loja?.nome_loja ?? ''}
            className="h-12 mx-auto mb-2 object-contain"
          />
        )}
        <h1 className="text-xl font-bold">{loja?.nome_loja || 'Assistência Técnica'}</h1>
        {loja?.telefone && (
          <p className="text-sm opacity-80 mt-1">{loja.telefone}</p>
        )}
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4 mt-4">
        <Card className="overflow-hidden">
          <div className="h-2 w-full" style={{ backgroundColor: corPrimaria }} />
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Ordem de Serviço</p>
                <h2 className="text-2xl font-bold">#{os?.numero_os}</h2>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-1">{statusConfig.emoji}</div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.cor}`}>
                  {statusConfig.label}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Progresso
              </p>
              <div className="flex items-center gap-1">
                {STEPS_PROGRESSO.map((s, i) => {
                  const indiceItem = STATUS_ORDEM.indexOf(s);
                  const ativo = indiceItem <= indiceAtual;
                  return (
                    <div key={s} className="flex items-center flex-1">
                      <div
                        className={`h-2 flex-1 rounded-full ${ativo ? '' : 'bg-gray-200'}`}
                        style={ativo ? { backgroundColor: corPrimaria } : {}}
                      />
                      {i < STEPS_PROGRESSO.length - 1 && (
                        <div
                          className={`h-2 w-2 rounded-full mx-0.5 ${ativo ? '' : 'bg-gray-200'}`}
                          style={ativo ? { backgroundColor: corPrimaria } : {}}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {(os?.dispositivo?.marca || os?.dispositivo?.modelo) && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Dispositivo</p>
              <p className="font-semibold">{os?.dispositivo?.marca} {os?.dispositivo?.modelo}</p>
            </CardContent>
          </Card>
        )}

        {os?.fotos && os.fotos.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Fotos do Aparelho
              </p>
              <div className="grid grid-cols-3 gap-2">
                {os.fotos.slice(0, 6).map((foto: string, i: number) => (
                  <img
                    key={i}
                    src={foto}
                    alt={`Foto ${i + 1}`}
                    className="w-full h-24 object-cover rounded-lg cursor-pointer"
                    onClick={() => window.open(foto, '_blank')}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {os?.descricao_problema && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Problema Relatado
              </p>
              <p className="text-sm">{os.descricao_problema}</p>
            </CardContent>
          </Card>
        )}

        {os?.descricao_solucao && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Solução Aplicada
              </p>
              <p className="text-sm">{os.descricao_solucao}</p>
            </CardContent>
          </Card>
        )}

        {os?.valor_total != null && os.valor_total > 0 && (
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Valor do Serviço</p>
              <p className="text-xl font-bold" style={{ color: corPrimaria }}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(os.valor_total)}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Entrada</span>
              <span>{os?.created_at ? new Date(os.created_at).toLocaleDateString('pt-BR') : '-'}</span>
            </div>
            {os?.data_saida && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entrega</span>
                <span>{new Date(os.data_saida).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-8">
          Acompanhamento em tempo real • Powered by Méc App
        </p>
      </div>
    </div>
  );
}
