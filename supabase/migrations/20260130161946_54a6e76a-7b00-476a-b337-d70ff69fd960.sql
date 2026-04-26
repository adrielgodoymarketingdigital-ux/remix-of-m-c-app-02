-- Adicionar política de DELETE para vendas canceladas
CREATE POLICY "Users can delete own cancelled sales" 
ON public.vendas 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id AND cancelada = true);