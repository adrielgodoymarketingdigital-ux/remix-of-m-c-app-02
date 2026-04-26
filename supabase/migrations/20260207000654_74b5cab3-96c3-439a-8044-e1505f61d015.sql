-- Permitir que funcionários e donos da loja visualizem o vínculo na tabela loja_funcionarios
-- (Necessário para o login do funcionário herdar o plano do dono)

ALTER TABLE public.loja_funcionarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Funcionarios podem ver seu vinculo" ON public.loja_funcionarios;
CREATE POLICY "Funcionarios podem ver seu vinculo"
ON public.loja_funcionarios
FOR SELECT
TO authenticated
USING (
  auth.uid() = funcionario_user_id
  OR auth.uid() = loja_user_id
);

-- (Opcionalmente) permitir que o dono veja seus funcionários e que o funcionário veja apenas seu próprio registro
-- (mantido apenas para SELECT, sem abrir INSERT/UPDATE/DELETE)
