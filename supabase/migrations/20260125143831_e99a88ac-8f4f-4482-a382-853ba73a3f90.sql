-- Remover a view antiga e recriar com security_invoker
DROP VIEW IF EXISTS public.onboarding_config_public;

-- Recriar view com security_invoker para evitar problema de security definer
CREATE VIEW public.onboarding_config_public
WITH (security_invoker = on) AS
SELECT 
  ativo,
  publico_alvo,
  mostrar_para_usuarios_ativos,
  config_passos,
  textos_personalizados
FROM public.onboarding_config
LIMIT 1;

-- Adicionar política para usuários autenticados poderem ler a tabela original (apenas para a view funcionar)
CREATE POLICY "Usuarios autenticados podem ler config onboarding"
  ON public.onboarding_config FOR SELECT
  TO authenticated
  USING (true);