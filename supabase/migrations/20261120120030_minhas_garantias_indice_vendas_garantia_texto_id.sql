-- "Minhas garantias" — FASE A: índice de vendas.garantia_texto_id (CONCURRENTLY).
-- Roda DEPOIS de 20261120120020. Quem aplica é o Adriel, no SQL Editor,
-- SOZINHO (um comando só; CONCURRENTLY não roda dentro de transação). NUNCA `db push`.
--
-- Não bloqueia INSERT/UPDATE/DELETE em vendas. Parcial: hoje fica vazio.
-- Serve à FK ON DELETE RESTRICT e à reimpressão das fases B/C.
--
-- Idempotente (IF NOT EXISTS). Se ficar INVÁLIDO (criação interrompida), rodar
-- sozinho `DROP INDEX CONCURRENTLY public.idx_vendas_garantia_texto_id;` e este de novo.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendas_garantia_texto_id
  ON public.vendas (garantia_texto_id) WHERE garantia_texto_id IS NOT NULL;
