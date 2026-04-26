
CREATE TABLE public.taxas_cartao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bandeira text NOT NULL,
  taxa_debito numeric DEFAULT 0,
  taxa_credito numeric DEFAULT 0,
  taxas_parcelado jsonb DEFAULT '{}'::jsonb,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.taxas_cartao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own taxas_cartao"
  ON public.taxas_cartao FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own taxas_cartao"
  ON public.taxas_cartao FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own taxas_cartao"
  ON public.taxas_cartao FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own taxas_cartao"
  ON public.taxas_cartao FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Funcionarios podem ver taxas_cartao do dono"
  ON public.taxas_cartao FOR SELECT
  TO authenticated
  USING (is_funcionario_of(user_id));

CREATE POLICY "Funcionarios podem inserir taxas_cartao para o dono"
  ON public.taxas_cartao FOR INSERT
  TO authenticated
  WITH CHECK (is_funcionario_of(user_id));

CREATE POLICY "Funcionarios podem atualizar taxas_cartao do dono"
  ON public.taxas_cartao FOR UPDATE
  TO authenticated
  USING (is_funcionario_of(user_id));
