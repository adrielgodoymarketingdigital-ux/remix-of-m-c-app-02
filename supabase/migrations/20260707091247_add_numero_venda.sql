-- Numeração automática de vendas do PDV (padrão VD-000001), análogo a numero_os.
-- Cada carrinho do PDV gera múltiplas linhas em `vendas` (uma por item/parcela)
-- compartilhando o mesmo grupo_venda. O trigger reaproveita o numero_venda já
-- atribuído à primeira linha do grupo, em vez de gerar um número por linha.

ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS numero_venda TEXT;

CREATE TABLE IF NOT EXISTS public.user_venda_counters (
  user_id UUID NOT NULL PRIMARY KEY,
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_venda_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own venda counter"
ON public.user_venda_counters FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own venda counter"
ON public.user_venda_counters FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update own venda counter"
ON public.user_venda_counters FOR UPDATE
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.generate_venda_number_safe(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_venda_number TEXT;
BEGIN
  INSERT INTO user_venda_counters (user_id, ultimo_numero)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE user_venda_counters
  SET ultimo_numero = ultimo_numero + 1,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING ultimo_numero INTO next_number;

  new_venda_number := 'VD-' || LPAD(next_number::TEXT, 6, '0');

  RETURN new_venda_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_venda_number_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  numero_existente TEXT;
BEGIN
  IF NEW.numero_venda IS NOT NULL AND NEW.numero_venda <> '' THEN
    RETURN NEW;
  END IF;

  IF NEW.grupo_venda IS NOT NULL THEN
    SELECT numero_venda INTO numero_existente
    FROM public.vendas
    WHERE grupo_venda = NEW.grupo_venda
      AND numero_venda IS NOT NULL
    LIMIT 1;

    IF numero_existente IS NOT NULL THEN
      NEW.numero_venda := numero_existente;
      RETURN NEW;
    END IF;
  END IF;

  NEW.numero_venda := public.generate_venda_number_safe(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_venda_number_trigger
BEFORE INSERT ON public.vendas
FOR EACH ROW
EXECUTE FUNCTION public.assign_venda_number_on_insert();
