-- Corrigir data_fim de assinaturas trial com datas incorretas
-- A regra é: data_fim deve ser exatamente data_inicio + 7 dias
UPDATE assinaturas 
SET data_fim = data_inicio + INTERVAL '7 days'
WHERE plano_tipo = 'trial'
  AND data_fim IS NOT NULL
  AND data_inicio IS NOT NULL
  AND ABS(EXTRACT(EPOCH FROM (data_fim - (data_inicio + INTERVAL '7 days')))) / 86400 > 1;