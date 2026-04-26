-- Etapa 1: Criar tabela de contadores por usuário
CREATE TABLE public.user_os_counters (
  user_id UUID PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.user_os_counters ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own counter"
ON public.user_os_counters
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own counter"
ON public.user_os_counters
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own counter"
ON public.user_os_counters
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Etapa 2: Migrar dados existentes - inicializar contadores com o maior número de OS de cada usuário
INSERT INTO public.user_os_counters (user_id, ultimo_numero)
SELECT 
  user_id, 
  COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(numero_os, '[^0-9]', '', 'g'), '') AS INTEGER)), 0)
FROM public.ordens_servico
WHERE user_id IS NOT NULL
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE SET
  ultimo_numero = GREATEST(user_os_counters.ultimo_numero, EXCLUDED.ultimo_numero);

-- Etapa 3: Recriar função generate_os_number para receber user_id
CREATE OR REPLACE FUNCTION public.generate_os_number(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_os_number TEXT;
  tentativas INTEGER := 0;
  max_tentativas CONSTANT INTEGER := 100;
BEGIN
  LOOP
    -- Buscar ou criar contador do usuário com lock
    INSERT INTO user_os_counters (user_id, ultimo_numero)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Incrementar atomicamente e retornar o novo valor
    UPDATE user_os_counters 
    SET ultimo_numero = ultimo_numero + 1,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING ultimo_numero INTO next_number;
    
    -- Formata como OS-XXXXXX
    new_os_number := 'OS-' || LPAD(next_number::TEXT, 6, '0');
    
    -- Verifica se este número já existe para este usuário (segurança extra)
    IF NOT EXISTS (
      SELECT 1 FROM ordens_servico 
      WHERE numero_os = new_os_number AND user_id = p_user_id
    ) THEN
      RETURN new_os_number;
    END IF;
    
    -- Proteção contra loop infinito
    tentativas := tentativas + 1;
    IF tentativas >= max_tentativas THEN
      RAISE EXCEPTION 'Falha ao gerar número único de OS após % tentativas', max_tentativas;
    END IF;
  END LOOP;
END;
$$;

-- Etapa 4: Atualizar função get_next_os_number para receber user_id
CREATE OR REPLACE FUNCTION public.get_next_os_number(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_number INTEGER;
BEGIN
  -- Se p_user_id for NULL, usa auth.uid()
  IF p_user_id IS NULL THEN
    p_user_id := auth.uid();
  END IF;
  
  -- Buscar contador atual do usuário
  SELECT ultimo_numero INTO current_number
  FROM user_os_counters
  WHERE user_id = p_user_id;
  
  -- Se não existir, retorna 1 (próximo número será 1)
  IF current_number IS NULL THEN
    RETURN 1;
  END IF;
  
  RETURN current_number + 1;
END;
$$;

-- Etapa 5: Atualizar função set_os_sequence_start para receber user_id
CREATE OR REPLACE FUNCTION public.set_os_sequence_start(p_user_id UUID, novo_inicio INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_existente INTEGER;
BEGIN
  -- Verifica o maior número de OS existente para este usuário
  SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(numero_os, '[^0-9]', '', 'g'), '') AS INTEGER)), 0)
  INTO max_existente
  FROM ordens_servico
  WHERE user_id = p_user_id;
  
  -- Verifica se o novo início é maior que o máximo atual
  IF novo_inicio <= max_existente THEN
    RAISE EXCEPTION 'O número inicial deve ser maior que o último número de OS existente (%)' , max_existente;
  END IF;
  
  -- Atualiza ou cria o contador do usuário
  INSERT INTO user_os_counters (user_id, ultimo_numero, updated_at)
  VALUES (p_user_id, novo_inicio - 1, now())
  ON CONFLICT (user_id) DO UPDATE SET
    ultimo_numero = novo_inicio - 1,
    updated_at = now();
END;
$$;

-- Manter a função antiga sem parâmetros para backward compatibility (usa auth.uid())
CREATE OR REPLACE FUNCTION public.generate_os_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN generate_os_number(auth.uid());
END;
$$;