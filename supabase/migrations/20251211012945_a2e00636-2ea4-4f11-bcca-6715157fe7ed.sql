-- Reforçar policy de SELECT na tabela profiles
-- Garantir que apenas usuários autenticados com sessão válida podem acessar

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  );

-- Adicionar comentário explicativo na tabela
COMMENT ON TABLE public.profiles IS 
  'Perfis de usuários - acesso restrito apenas ao próprio registro com sessão autenticada válida.';