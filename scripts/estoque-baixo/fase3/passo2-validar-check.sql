-- =====================================================================
-- Estoque mínimo por item — PASSO 2 (rodar DEPOIS da migration
-- 20261103120000, num envio separado no SQL Editor).
--
-- Valida o CHECK de 0 a 1000 nas linhas antigas. VALIDATE CONSTRAINT usa
-- SHARE UPDATE EXCLUSIVE: o app continua lendo e gravando produtos e peças
-- enquanto ele lê a tabela. Como a coluna nasceu nula, nada falha.
-- Pode ser rodado de novo (validar o que já está validado não faz nada).
-- Se o lock_timeout estourar (alguém fazendo ALTER/VACUUM FULL ao mesmo
-- tempo), é só rodar de novo.
-- =====================================================================
SET lock_timeout = '3s';
SET statement_timeout = '120s';

ALTER TABLE public.produtos VALIDATE CONSTRAINT produtos_estoque_minimo_check;
ALTER TABLE public.pecas    VALIDATE CONSTRAINT pecas_estoque_minimo_check;

RESET lock_timeout;
RESET statement_timeout;

SELECT conrelid::regclass AS tabela, conname, convalidated
  FROM pg_constraint
 WHERE conname IN ('produtos_estoque_minimo_check', 'pecas_estoque_minimo_check')
 ORDER BY 1;
