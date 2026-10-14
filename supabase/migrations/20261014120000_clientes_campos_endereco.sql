-- Endereço do cliente em campos separados: cep, numero, bairro, cidade, estado.
-- A coluna endereco continua existindo e passa a guardar só a rua/logradouro
-- (cliente antigo segue com o endereço inteiro nela e os campos novos vazios).
-- Mesmos nomes de configuracoes_loja.
--
-- 100% ADITIVA: só ADD COLUMN, text, nullable, sem default. Sem UPDATE de dados,
-- sem mudança de RLS/policies (as policies de clientes valem para a linha toda).
--
-- ROLLBACK (apaga os dados gravados nessas colunas):
--   ALTER TABLE public.clientes DROP COLUMN IF EXISTS cep;
--   ALTER TABLE public.clientes DROP COLUMN IF EXISTS numero;
--   ALTER TABLE public.clientes DROP COLUMN IF EXISTS bairro;
--   ALTER TABLE public.clientes DROP COLUMN IF EXISTS cidade;
--   ALTER TABLE public.clientes DROP COLUMN IF EXISTS estado;

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS estado text;

-- PostgREST passa a enxergar as colunas novas sem esperar o recarregamento automático.
NOTIFY pgrst, 'reload schema';
