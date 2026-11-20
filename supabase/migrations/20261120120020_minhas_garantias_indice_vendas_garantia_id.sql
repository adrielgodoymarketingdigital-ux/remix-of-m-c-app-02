-- "Minhas garantias" — FASE A: índice de vendas.garantia_id (CONCURRENTLY).
-- Roda DEPOIS de 20261120120000 (estrutura). Quem aplica é o Adriel, no SQL
-- Editor, SOZINHO (este arquivo tem um comando só: CONCURRENTLY não roda
-- dentro de transação, nem junto com outros comandos). NUNCA `db push`.
--
-- CONCURRENTLY não bloqueia INSERT/UPDATE/DELETE em vendas: constrói o índice
-- enquanto o PDV trabalha (demora mais, espera vendas em andamento terminarem).
-- Parcial (só linhas com garantia_id): hoje fica praticamente vazio.
-- Serve à FK ON DELETE SET NULL e às leituras das fases B/C.
--
-- Idempotente (IF NOT EXISTS). Se a criação for interrompida, o índice fica
-- INVÁLIDO e o IF NOT EXISTS não o refaz: 1b-verificar-validacao-indices.sql
-- mostra; aí rodar, sozinho, `DROP INDEX CONCURRENTLY public.idx_vendas_garantia_id;`
-- e este arquivo de novo.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendas_garantia_id
  ON public.vendas (garantia_id) WHERE garantia_id IS NOT NULL;
