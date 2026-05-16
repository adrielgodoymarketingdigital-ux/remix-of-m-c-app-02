-- Corrige get_loja_owner_id para cobrir gerentes de filial.
-- Antes só cobria loja_funcionarios; gerentes retornavam auth.uid() e
-- o UPDATE falhava porque a OS tem user_id = proprietario_id.

CREATE OR REPLACE FUNCTION public.get_loja_owner_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
BEGIN
  -- Verifica se é funcionário da loja
  SELECT loja_user_id INTO owner_id
  FROM public.loja_funcionarios
  WHERE funcionario_user_id = auth.uid()
    AND ativo = true
  LIMIT 1;

  IF owner_id IS NOT NULL THEN
    RETURN owner_id;
  END IF;

  -- Verifica se é gerente de filial
  SELECT proprietario_id INTO owner_id
  FROM public.empresa_usuarios
  WHERE gerente_id = auth.uid()
  LIMIT 1;

  IF owner_id IS NOT NULL THEN
    RETURN owner_id;
  END IF;

  -- É o próprio proprietário
  RETURN auth.uid();
END;
$$;
