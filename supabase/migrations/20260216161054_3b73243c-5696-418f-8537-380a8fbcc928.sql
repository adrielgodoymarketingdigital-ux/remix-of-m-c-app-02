
-- 1. Adicionar coluna is_teste em ordens_servico
ALTER TABLE public.ordens_servico ADD COLUMN is_teste boolean NOT NULL DEFAULT false;

-- 2. Adicionar coluna objetivo_onboarding em user_onboarding
ALTER TABLE public.user_onboarding ADD COLUMN objetivo_onboarding text;

-- 3. Atualizar funcao count_user_orders para excluir OS de teste
CREATE OR REPLACE FUNCTION public.count_user_orders(_user_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.ordens_servico
  WHERE user_id = _user_id
    AND is_teste = false
$$;
