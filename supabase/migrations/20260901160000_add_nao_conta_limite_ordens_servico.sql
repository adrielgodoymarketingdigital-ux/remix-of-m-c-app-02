-- OS criada pelo card "Primeiros Passos" (item "Crie sua primeira OS"):
-- é uma OS REAL e visível em todas as listas/dashboard, mas NÃO entra na
-- cota mensal de OS do plano.
--
-- Diferente de `is_teste` — esse ESCONDE a OS das listas (useOrdensServico,
-- useDashboardResumo, etc. filtram is_teste=false). Aqui a OS aparece
-- normalmente; só o contador de limite (useAssinatura.podeCriarOrdemServico
-- e obterContagemOSMes) passa a ignorá-la.
--
-- Aditivo: NOT NULL DEFAULT false → todas as ~12k OS existentes continuam
-- contando exatamente como hoje.

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS nao_conta_limite boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ordens_servico.nao_conta_limite IS
  'true = OS não entra no limite mensal de OS do plano (ex.: primeira OS criada no card Primeiros Passos). Continua visível em listas e dashboard.';
