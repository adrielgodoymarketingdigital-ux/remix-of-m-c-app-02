CREATE TABLE public.categorias_despesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expense categories"
ON public.categorias_despesas
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE UNIQUE INDEX categorias_despesas_user_nome ON public.categorias_despesas (user_id, nome);