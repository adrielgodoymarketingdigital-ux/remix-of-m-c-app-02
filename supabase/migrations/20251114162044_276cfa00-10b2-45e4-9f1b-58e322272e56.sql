-- Limpar configurações duplicadas, mantendo apenas a mais recente por user_id
DELETE FROM configuracoes_loja
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM configuracoes_loja
  ORDER BY user_id, created_at DESC
);

-- Adicionar constraint UNIQUE para prevenir duplicatas futuras
ALTER TABLE configuracoes_loja
ADD CONSTRAINT configuracoes_loja_user_id_unique UNIQUE (user_id);