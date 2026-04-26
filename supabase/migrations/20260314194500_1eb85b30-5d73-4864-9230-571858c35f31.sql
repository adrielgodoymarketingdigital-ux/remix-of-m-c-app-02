
CREATE TABLE public.categorias_sistema_excluidas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, nome)
);

ALTER TABLE public.categorias_sistema_excluidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own excluded categories"
  ON public.categorias_sistema_excluidas
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
