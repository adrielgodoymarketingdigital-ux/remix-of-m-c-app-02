-- Corrige função de geração de número de orçamento.
-- SUBSTRING FROM 5 FOR 6 pegava "2026-0" em vez do número sequencial.
-- O formato é ORC-2026-000001, então a sequência começa na posição 10.
-- Adicionado também regex guard para ignorar registros com formato inválido.
CREATE OR REPLACE FUNCTION public.generate_orcamento_number()
RETURNS TRIGGER AS $$
DECLARE
  ano TEXT;
  seq INTEGER;
BEGIN
  ano := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_orcamento FROM 10 FOR 6) AS INTEGER)), 0) + 1
  INTO seq
  FROM public.orcamentos
  WHERE numero_orcamento LIKE 'ORC-' || ano || '-%'
    AND user_id = NEW.user_id
    AND numero_orcamento ~ ('^ORC-' || ano || '-[0-9]{6}$');

  NEW.numero_orcamento := 'ORC-' || ano || '-' || LPAD(seq::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
