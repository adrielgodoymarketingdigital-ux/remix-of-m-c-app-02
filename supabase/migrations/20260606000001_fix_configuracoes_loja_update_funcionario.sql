-- Permitir que funcionários atualizem a config da loja do proprietário
-- Necessário para que alterações de layout de recibo/garantia feitas pelo
-- funcionário sejam salvas na conta correta (do dono da loja)

DROP POLICY IF EXISTS "Funcionarios podem atualizar config loja do dono" ON public.configuracoes_loja;

CREATE POLICY "Funcionarios podem atualizar config loja do dono"
ON public.configuracoes_loja
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_funcionario_of(user_id)
)
WITH CHECK (
  auth.uid() = user_id
  OR public.is_funcionario_of(user_id)
);
