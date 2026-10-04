-- Dono da loja como funcionário (opção A): uma linha em loja_funcionarios com
-- eh_dono = true e SEM login vinculado. Como todas as checagens de "é
-- funcionário?" (get_loja_owner_id, is_funcionario_of, is_colleague_of e os
-- hooks do app) procuram funcionario_user_id = auth.uid(), essa linha nunca
-- muda as permissões do dono: ela só serve para escolher o dono como vendedor/
-- técnico e calcular comissão para ele. Desligar = ativo = false (nunca DELETE:
-- os_tecnicos e comissoes_tipo_servico apagam em cascata).

ALTER TABLE public.loja_funcionarios
  ADD COLUMN IF NOT EXISTS eh_dono boolean NOT NULL DEFAULT false;

-- No máximo uma linha de dono por loja.
CREATE UNIQUE INDEX IF NOT EXISTS loja_funcionarios_um_dono_por_loja
  ON public.loja_funcionarios (loja_user_id)
  WHERE eh_dono;

-- A linha do dono nunca ganha login (senão ele viraria funcionário restrito).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loja_funcionarios_dono_sem_login'
  ) THEN
    ALTER TABLE public.loja_funcionarios
      ADD CONSTRAINT loja_funcionarios_dono_sem_login
      CHECK (NOT (eh_dono AND funcionario_user_id IS NOT NULL));
  END IF;
END $$;
