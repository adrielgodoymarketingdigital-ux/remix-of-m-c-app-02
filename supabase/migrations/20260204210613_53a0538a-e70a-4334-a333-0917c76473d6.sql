
-- Adicionar condição faltante: trial_sem_cartao_expirado
INSERT INTO public.crm_automacoes (condicao, condicao_label, estagio_destino_id, ativo, prioridade)
VALUES (
  'trial_sem_cartao_expirado',
  'Trial Expirado (Sem Cartão)',
  NULL,
  true,
  2
)
ON CONFLICT (condicao) DO NOTHING;

-- Ajustar prioridades para manter ordem lógica (sem cartão expirado deve vir após sem cartão ativo)
UPDATE public.crm_automacoes
SET prioridade = 2
WHERE condicao = 'trial_sem_cartao_expirado';
