-- Criar política para admin poder ver todos os profiles (para mostrar usuário no feedback)
DO $$ 
BEGIN
  CREATE POLICY "Admins podem ver todos os profiles" 
  ON public.profiles 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
EXCEPTION WHEN duplicate_object THEN 
  NULL;
END $$;