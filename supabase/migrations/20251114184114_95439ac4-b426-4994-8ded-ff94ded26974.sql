-- ===== MIGRAÇÃO: Corrigir geração de números de OS =====

-- STEP 1: Criar SEQUENCE para números de OS
CREATE SEQUENCE IF NOT EXISTS ordens_servico_numero_seq 
START WITH 1
INCREMENT BY 1
NO CYCLE;

-- STEP 2: Sincronizar SEQUENCE com os números existentes
SELECT setval(
  'ordens_servico_numero_seq', 
  COALESCE(
    (SELECT MAX(CAST(SUBSTRING(numero_os FROM 4) AS INTEGER)) 
     FROM ordens_servico),
    0
  ),
  true
);

-- STEP 3: Recriar função generate_os_number() com SEQUENCE
CREATE OR REPLACE FUNCTION public.generate_os_number()
RETURNS text
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
    -- Incrementa a sequence e pega o próximo número
    next_number := nextval('ordens_servico_numero_seq');
    
    -- Formata como OS-XXXXXX
    new_os_number := 'OS-' || LPAD(next_number::TEXT, 6, '0');
    
    -- Verifica se este número já existe (segurança extra)
    IF NOT EXISTS (
      SELECT 1 FROM ordens_servico WHERE numero_os = new_os_number
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

-- STEP 4: Comentário explicativo
COMMENT ON FUNCTION public.generate_os_number() IS 
'Gera número único sequencial para Ordem de Serviço usando SEQUENCE. 
Formato: OS-XXXXXX (ex: OS-000001, OS-000002).
Inclui verificação de duplicação e proteção contra loops infinitos.';