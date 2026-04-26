-- Corrigir a política de admin para ordens_servico
-- O problema: a política está com roles:{public} em vez de {authenticated}

DROP POLICY IF EXISTS "Admins podem ver todas ordens_servico" ON public.ordens_servico;

CREATE POLICY "Admins podem ver todas ordens_servico" 
ON public.ordens_servico 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));