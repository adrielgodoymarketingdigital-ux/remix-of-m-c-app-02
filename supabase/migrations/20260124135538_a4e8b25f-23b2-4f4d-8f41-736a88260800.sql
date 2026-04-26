-- Criar função para definir o número inicial da sequence de OS
CREATE OR REPLACE FUNCTION public.set_os_sequence_start(novo_inicio INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verifica se o novo início é maior que o máximo atual
  IF novo_inicio <= COALESCE(
    (SELECT MAX(CAST(SUBSTRING(numero_os FROM 4) AS INTEGER)) FROM ordens_servico), 
    0
  ) THEN
    RAISE EXCEPTION 'O número inicial deve ser maior que o último número de OS existente';
  END IF;
  
  -- Define o novo valor da sequence (será o próximo número gerado)
  PERFORM setval('ordens_servico_numero_seq', novo_inicio - 1, true);
END;
$$;

-- Criar função para obter o próximo número de OS que será gerado
CREATE OR REPLACE FUNCTION public.get_next_os_number()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (SELECT last_value + 1 FROM ordens_servico_numero_seq);
END;
$$;