-- OS com vários serviços — etapa 2 (migration A): técnico por LINHA de serviço.
--
-- Com o mesmo serviço repetido na OS (ex.: "Formatação" em duas linhas),
-- os_tecnicos.servico_id não diz qual das linhas o técnico fez. A coluna nova
-- guarda o linha_id da linha em avarias.servicos_realizados.
--
-- Só aditiva e NÃO altera nenhum privilégio: só a coluna nova (nullable, sem
-- default — só metadado, não reescreve a tabela) e o comentário. RLS, policies
-- e GRANTs de os_tecnicos ficam exatamente como estão. Nenhuma linha
-- existente muda; quem não usa serviço repetido nunca grava a coluna. O app já
-- lida com a coluna ausente (lê com select("*") e, se o insert recusar a
-- coluna, grava sem ela), então código e migration podem ser publicados em
-- qualquer ordem.
--
-- Idempotente: rodar de novo não muda nada.
--
-- ROLLBACK:
--   ALTER TABLE public.os_tecnicos DROP COLUMN IF EXISTS servico_linha_id;

BEGIN;

ALTER TABLE public.os_tecnicos
  ADD COLUMN IF NOT EXISTS servico_linha_id text;

COMMENT ON COLUMN public.os_tecnicos.servico_linha_id IS
  'linha_id da linha em ordens_servico.avarias.servicos_realizados feita por este técnico (serviço repetido/quantidade). NULL = vínculo só por servico_id, como antes.';

COMMIT;
