
-- Definir um destino padrão para 'trial_sem_cartao_expirado'
-- (se o admin já configurou 'trial_com_cartao_expirado', reutilizar o mesmo estágio)
UPDATE public.crm_automacoes
SET estagio_destino_id = (
  SELECT estagio_destino_id
  FROM public.crm_automacoes
  WHERE condicao = 'trial_com_cartao_expirado'
  LIMIT 1
)
WHERE condicao = 'trial_sem_cartao_expirado'
  AND estagio_destino_id IS NULL;
