-- Permite que gerente de filial gerencie funcionários da loja que administra.
-- Antes só o dono (loja_user_id = auth.uid()) podia fazer UPDATE/DELETE.
-- O gerente é identificado via empresa_usuarios.gerente_id → proprietario_id.

DROP POLICY IF EXISTS "Gerente gerencia funcionarios da loja" ON public.loja_funcionarios;

CREATE POLICY "Gerente gerencia funcionarios da loja"
ON public.loja_funcionarios
FOR ALL
TO authenticated
USING (
  loja_user_id = (
    SELECT proprietario_id
    FROM public.empresa_usuarios
    WHERE gerente_id = auth.uid()
    LIMIT 1
  )
)
WITH CHECK (
  loja_user_id = (
    SELECT proprietario_id
    FROM public.empresa_usuarios
    WHERE gerente_id = auth.uid()
    LIMIT 1
  )
);
