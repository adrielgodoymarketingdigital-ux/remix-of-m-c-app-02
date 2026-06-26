-- Exclusão de serviços falhava silenciosamente (toast de erro genérico) quando
-- o serviço já estava vinculado a alguma ordem_servico, pois a FK
-- ordens_servico.servico_id -> servicos(id) não tinha ON DELETE definido,
-- bloqueando o DELETE com violação de constraint.
ALTER TABLE public.ordens_servico
  DROP CONSTRAINT IF EXISTS ordens_servico_servico_id_fkey;

ALTER TABLE public.ordens_servico
  ADD CONSTRAINT ordens_servico_servico_id_fkey
  FOREIGN KEY (servico_id) REFERENCES public.servicos(id) ON DELETE SET NULL;
