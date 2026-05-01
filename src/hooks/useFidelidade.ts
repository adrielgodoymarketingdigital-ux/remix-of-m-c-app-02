import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FidelidadeConfig, FidelidadeNivel, ClienteFidelidade } from "@/types/fidelidade";

export function useFidelidade() {
  const [config, setConfig] = useState<FidelidadeConfig | null>(null);
  const [niveis, setNiveis] = useState<FidelidadeNivel[]>([]);
  const [clientes, setClientes] = useState<ClienteFidelidade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const carregarDados = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: configData } = await supabase
        .from('fidelidade_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setConfig(configData);

      const { data: niveisData } = await supabase
        .from('fidelidade_niveis')
        .select('*')
        .eq('user_id', user.id)
        .order('pontos_minimos', { ascending: true });
      setNiveis(niveisData || []);

      const { data: pontosData } = await supabase
        .from('fidelidade_pontos')
        .select('cliente_id, pontos, tipo')
        .eq('user_id', user.id);

      const pontosMap: Record<string, number> = {};
      pontosData?.forEach(p => {
        if (!pontosMap[p.cliente_id]) pontosMap[p.cliente_id] = 0;
        pontosMap[p.cliente_id] += p.pontos;
      });

      const clienteIds = Object.keys(pontosMap);
      if (clienteIds.length === 0) {
        setClientes([]);
        setIsLoading(false);
        return;
      }

      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nome, celular, email')
        .in('id', clienteIds)
        .is('deleted_at', null);

      const { data: vendasData } = await supabase
        .from('vendas')
        .select('cliente_id, total, data')
        .in('cliente_id', clienteIds)
        .eq('cancelada', false)
        .is('deleted_at', null);

      const { data: osData } = await supabase
        .from('ordens_servico')
        .select('cliente_id, valor_total, created_at')
        .in('cliente_id', clienteIds)
        .is('deleted_at', null);

      const clientesFidelidade: ClienteFidelidade[] = (clientesData || []).map(c => {
        const totalPontos = pontosMap[c.id] || 0;
        const vendas = vendasData?.filter(v => v.cliente_id === c.id) || [];
        const os = osData?.filter(o => o.cliente_id === c.id) || [];
        const valorTotalGasto =
          vendas.reduce((sum, v) => sum + (v.total || 0), 0) +
          os.reduce((sum, o) => sum + (o.valor_total || 0), 0);

        const niveisOrdenados = [...(niveisData || [])].sort((a, b) => b.pontos_minimos - a.pontos_minimos);
        const nivel = niveisOrdenados.find(n => totalPontos >= n.pontos_minimos) || null;

        const datas = [
          ...vendas.map(v => v.data),
          ...os.map(o => o.created_at),
        ].filter(Boolean).sort().reverse();

        return {
          cliente_id: c.id,
          nome: c.nome,
          celular: c.celular,
          email: c.email,
          total_pontos: totalPontos,
          total_vendas: vendas.length,
          total_os: os.length,
          valor_total_gasto: valorTotalGasto,
          nivel,
          ultima_compra: datas[0] || null,
        };
      }).sort((a, b) => b.total_pontos - a.total_pontos);

      setClientes(clientesFidelidade);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados de fidelidade");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const salvarConfig = async (novaConfig: Partial<FidelidadeConfig>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('fidelidade_config')
      .upsert({ ...novaConfig, user_id: user.id, updated_at: new Date().toISOString() });
    if (error) { toast.error("Erro ao salvar configuração"); return; }
    toast.success("Configuração salva!");
    await carregarDados();
  };

  const salvarNivel = async (nivel: Partial<FidelidadeNivel>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = nivel.id
      ? await supabase.from('fidelidade_niveis').update(nivel).eq('id', nivel.id)
      : await supabase.from('fidelidade_niveis').insert({ ...nivel, user_id: user.id });
    if (error) { toast.error("Erro ao salvar nível"); return; }
    toast.success("Nível salvo!");
    await carregarDados();
  };

  const deletarNivel = async (id: string) => {
    const { error } = await supabase.from('fidelidade_niveis').delete().eq('id', id);
    if (error) { toast.error("Erro ao deletar nível"); return; }
    toast.success("Nível removido!");
    await carregarDados();
  };

  const adicionarPontos = async (
    clienteId: string,
    pontos: number,
    tipo: 'venda' | 'os' | 'resgate' | 'expiracao',
    descricao?: string,
    referenciaId?: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: cfg } = await supabase
      .from('fidelidade_config')
      .select('validade_pontos_dias')
      .eq('user_id', user.id)
      .maybeSingle();

    let expiresAt = null;
    if (cfg?.validade_pontos_dias) {
      const exp = new Date();
      exp.setDate(exp.getDate() + cfg.validade_pontos_dias);
      expiresAt = exp.toISOString();
    }

    await supabase.from('fidelidade_pontos').insert({
      user_id: user.id,
      cliente_id: clienteId,
      pontos,
      tipo,
      descricao,
      referencia_id: referenciaId || null,
      expires_at: expiresAt,
    });
    await carregarDados();
  };

  const resgatar = async (
    clienteId: string,
    pontosResgatados: number,
    tipoResgate: 'cupom' | 'valor' | 'manual',
    valorDesconto?: number,
    descricao?: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    let cupomCodigo: string | null = null;
    if (tipoResgate === 'cupom') {
      cupomCodigo = 'FID-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    await supabase.from('fidelidade_resgates').insert({
      user_id: user.id,
      cliente_id: clienteId,
      pontos_resgatados: pontosResgatados,
      tipo_resgate: tipoResgate,
      valor_desconto: valorDesconto || null,
      cupom_codigo: cupomCodigo,
      descricao,
    });

    await adicionarPontos(clienteId, -pontosResgatados, 'resgate', descricao || 'Resgate de pontos');

    toast.success(
      tipoResgate === 'cupom'
        ? `Cupom gerado: ${cupomCodigo}`
        : "Resgate realizado com sucesso!"
    );
    return cupomCodigo;
  };

  useEffect(() => { carregarDados(); }, [carregarDados]);

  return {
    config,
    niveis,
    clientes,
    isLoading,
    salvarConfig,
    salvarNivel,
    deletarNivel,
    adicionarPontos,
    resgatar,
    recarregar: carregarDados,
  };
}
