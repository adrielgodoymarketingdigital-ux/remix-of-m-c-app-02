-- Card "Primeiros Passos" do Dashboard: user_onboarding.tipo_negocio passa a
-- carregar 4 perfis em vez de 2.
--
-- Antes: coluna `text` livre, sem constraint. Valores já gravados no banco:
-- apenas 'assistencia' (17 linhas) e NULL (813). O fluxo legado que escrevia
-- 'assistencia'|'vendas' (OnboardingModal) está morto — não há linha com
-- 'vendas', então o CHECK abaixo não quebra nenhum registro existente.
--
-- Novos slugs: assistencia | produtos | dispositivos | tudo
--   ('vendas' antigo vira 'produtos'/'dispositivos'/'tudo' no card novo)

ALTER TABLE public.user_onboarding
  DROP CONSTRAINT IF EXISTS user_onboarding_tipo_negocio_check;

ALTER TABLE public.user_onboarding
  ADD CONSTRAINT user_onboarding_tipo_negocio_check
  CHECK (
    tipo_negocio IS NULL
    OR tipo_negocio IN ('assistencia', 'produtos', 'dispositivos', 'tudo')
  );

COMMENT ON COLUMN public.user_onboarding.tipo_negocio IS
  'Perfil do negócio escolhido no card "Primeiros Passos": assistencia | produtos | dispositivos | tudo. NULL = ainda não respondeu.';
