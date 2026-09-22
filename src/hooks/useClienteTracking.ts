import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Mesmos limites/cota de useOSTracking.ts — o link de cliente usa a MESMA
// cota mensal (os_tracking_uso) do link de OS individual: é o mesmo recurso
// comercial (compartilhamento de acompanhamento), só um agregador diferente.
const LIMITES_PLANO: Record<string, number> = {
  basico_mensal: 0,
  basico_anual: 0,
  intermediario_mensal: 10,
  intermediario_anual: 10,
  profissional_mensal: 50,
  profissional_anual: 50,
  profissional_ultra_mensal: Infinity,
  profissional_ultra_anual: Infinity,
  admin: Infinity,
};

export function useClienteTracking() {
  const [gerando, setGerando] = useState(false);

  const gerarLink = useCallback(async (clienteId: string, lojaUserId?: string) => {
    setGerando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sessão expirada. Faça login novamente para gerar o link.");
        return null;
      }

      // Dono da loja: usado para resolver o plano e a cota, mesmo quando quem
      // compartilha é um funcionário (funcionário não tem assinatura própria)
      const donoId = lojaUserId ?? user.id;

      // Se já existe link ativo para esse cliente, reutiliza sem consumir cota
      const { data: existente } = await supabase
        .from('cliente_tracking_links')
        .select('token')
        .eq('cliente_id', clienteId)
        .eq('user_id', donoId)
        .eq('ativo', true)
        .maybeSingle();

      if (existente) {
        return `${window.location.origin}/acompanhar-cliente/${existente.token}`;
      }

      // Verificar plano do dono da loja
      const [{ data: assinatura }, { data: adminRole }] = await Promise.all([
        supabase
          .from('assinaturas')
          .select('plano_tipo, status, free_trial_ends_at, trial_end_at, data_fim')
          .eq('user_id', donoId)
          .in('status', ['active', 'trialing'])
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', donoId)
          .eq('role', 'admin')
          .maybeSingle(),
      ]);

      const a = assinatura as any;
      const freeTrialAtivo = !!a?.free_trial_ends_at && new Date(a.free_trial_ends_at) > new Date();
      const trialComCartaoAtivo = a?.plano_tipo === 'trial' &&
        new Date(a?.trial_end_at || a?.data_fim || 0) > new Date();
      const trialAtivo = freeTrialAtivo || trialComCartaoAtivo;

      const plano = adminRole ? 'admin' : (assinatura?.plano_tipo || 'free');
      const limite = trialAtivo ? Infinity : (LIMITES_PLANO[plano] ?? 0);

      if (limite === 0) {
        toast.error("Seu plano não inclui compartilhamento de acompanhamento. Faça upgrade para o Plano Intermediário ou superior.");
        return null;
      }

      // Verificar uso do mês atual — MESMA tabela/contador de useOSTracking (os_tracking_uso):
      // gerar link de cliente e gerar link de OS consomem a mesma cota mensal.
      const agora = new Date();
      const mes = agora.getMonth() + 1;
      const ano = agora.getFullYear();

      const { data: uso } = await supabase
        .from('os_tracking_uso')
        .select('total_compartilhamentos')
        .eq('user_id', donoId)
        .eq('mes', mes)
        .eq('ano', ano)
        .maybeSingle();

      const totalUsado = uso?.total_compartilhamentos || 0;

      if (limite !== Infinity && totalUsado >= limite) {
        toast.error(`Você atingiu o limite de ${limite} compartilhamentos este mês. Faça upgrade para compartilhar mais.`);
        return null;
      }

      // Criar novo link
      const { data, error } = await supabase
        .from('cliente_tracking_links')
        .insert({
          cliente_id: clienteId,
          user_id: donoId,
        })
        .select('token')
        .single();

      if (error) throw error;

      // Incrementar o MESMO contador de uso do link de OS individual
      await supabase
        .from('os_tracking_uso')
        .upsert({
          user_id: donoId,
          mes,
          ano,
          total_compartilhamentos: totalUsado + 1,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,mes,ano' });

      // Avisar quando restam poucos compartilhamentos
      if (limite !== Infinity) {
        const restam = limite - totalUsado - 1;
        if (restam <= 3 && restam > 0) {
          toast.warning(`Você tem apenas ${restam} compartilhamento(s) restante(s) este mês.`);
        }
      }

      return `${window.location.origin}/acompanhar-cliente/${data.token}`;
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar link de acompanhamento do cliente");
      return null;
    } finally {
      setGerando(false);
    }
  }, []);

  const compartilharWhatsApp = useCallback(async (
    clienteId: string,
    celularCliente: string,
    nomeCliente: string,
    lojaUserId?: string,
  ) => {
    const link = await gerarLink(clienteId, lojaUserId);
    if (!link) return;

    const mensagem = `Olá ${nomeCliente}! Acompanhe todas as suas ordens de serviço em tempo real:\n${link}`;

    const celular = celularCliente.replace(/\D/g, '');
    window.open(`https://wa.me/55${celular}?text=${encodeURIComponent(mensagem)}`, '_blank');
  }, [gerarLink]);

  return { gerarLink, compartilharWhatsApp, gerando };
}
