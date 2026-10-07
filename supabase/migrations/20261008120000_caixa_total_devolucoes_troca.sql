-- =====================================================================
-- Troca de aparelho no PDV — FASE 2B: foto das devoluções no fechamento.
--
-- 100% ADITIVA — sem DROP de tabela/coluna/dado. Reexecutável.
-- Depende da migration 20261007120000_troca_devolucao_diferenca.sql (Fase 2A).
--
-- caixas.total_devolucoes_troca: total das devoluções de troca em DINHEIRO
-- (vendas_trocas.caixa_id = caixa, forma 'dinheiro') que o fechamento abateu
-- do dinheiro esperado. Gravado no fechamento (foto, como total_dinheiro) e
-- ajustado por "alterar data da venda" entre caixas fechados.
-- Caixas já existentes ficam com 0: até 08/10/2026 só havia uma devolução
-- (em Pix, num caixa ainda aberto), então nenhum caixa fechado precisa de ajuste.
-- RLS: coberta pelas policies atuais de caixas (nenhuma tabela nova).
-- Verificação: scripts/verificacao-troca/verificar-migration-fase2b.sql
-- =====================================================================

ALTER TABLE public.caixas
  ADD COLUMN IF NOT EXISTS total_devolucoes_troca numeric(12,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.caixas'::regclass
      AND conname = 'caixas_total_devolucoes_troca_nao_negativo'
  ) THEN
    ALTER TABLE public.caixas
      ADD CONSTRAINT caixas_total_devolucoes_troca_nao_negativo CHECK (total_devolucoes_troca >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.caixas.total_devolucoes_troca IS
  'Devoluções de troca em dinheiro abatidas do dinheiro esperado no fechamento (foto do fechamento). Pix não entra.';
