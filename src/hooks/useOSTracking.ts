import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export function useOSTracking() {
  const [gerando, setGerando] = useState(false);

  const gerarLink = useCallback(async (osId: string) => {
    setGerando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Se já existe link ativo para essa OS, reutiliza sem consumir cota
      const { data: existente } = await supabase
        .from('os_tracking_links')
        .select('token')
        .eq('os_id', osId)
        .eq('user_id', user.id)
        .eq('ativo', true)
        .maybeSingle();

      if (existente) {
        return `${window.location.origin}/acompanhar/${existente.token}`;
      }

      // Verificar plano do usuário
      const [{ data: assinatura }, { data: adminRole }] = await Promise.all([
        supabase
          .from('assinaturas')
          .select('plano_tipo')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle(),
      ]);

      const plano = adminRole ? 'admin' : (assinatura?.plano_tipo || 'free');
      const limite = LIMITES_PLANO[plano] ?? 0;

      if (limite === 0) {
        toast.error("Seu plano não inclui compartilhamento de OS. Faça upgrade para o Plano Intermediário ou superior.");
        return null;
      }

      // Verificar uso do mês atual
      const agora = new Date();
      const mes = agora.getMonth() + 1;
      const ano = agora.getFullYear();

      const { data: uso } = await supabase
        .from('os_tracking_uso')
        .select('total_compartilhamentos')
        .eq('user_id', user.id)
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
        .from('os_tracking_links')
        .insert({
          os_id: osId,
          user_id: user.id,
        })
        .select('token')
        .single();

      if (error) throw error;

      // Incrementar contador de uso
      await supabase
        .from('os_tracking_uso')
        .upsert({
          user_id: user.id,
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

      return `${window.location.origin}/acompanhar/${data.token}`;
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar link de acompanhamento");
      return null;
    } finally {
      setGerando(false);
    }
  }, []);

  const compartilharWhatsApp = useCallback(async (
    osId: string,
    celularCliente: string,
    nomeCliente: string,
    numeroOS: string,
    status: string
  ) => {
    const link = await gerarLink(osId);
    if (!link) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { data: config } = await supabase
      .from('configuracoes_loja')
      .select('mensagens_whatsapp')
      .eq('user_id', user?.id)
      .maybeSingle();

    const mensagens = (config?.mensagens_whatsapp as Record<string, string>) || {};
    let mensagem = mensagens.os_tracking ||
      `Olá ${nomeCliente}! Acompanhe sua OS #${numeroOS} em tempo real:\n${link}`;

    mensagem = mensagem
      .replace('{{cliente_nome}}', nomeCliente)
      .replace('{{numero_os}}', numeroOS)
      .replace('{{status}}', status)
      .replace('{{link}}', link);

    const celular = celularCliente.replace(/\D/g, '');
    window.open(`https://wa.me/55${celular}?text=${encodeURIComponent(mensagem)}`, '_blank');
  }, [gerarLink]);

  return { gerarLink, compartilharWhatsApp, gerando };
}
