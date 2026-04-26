-- Corrigir search_path da função incrementar_uso_cupom
CREATE OR REPLACE FUNCTION incrementar_uso_cupom(cupom_id UUID)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE cupons 
  SET quantidade_usada = quantidade_usada + 1,
      updated_at = NOW()
  WHERE id = cupom_id;
END;
$$;