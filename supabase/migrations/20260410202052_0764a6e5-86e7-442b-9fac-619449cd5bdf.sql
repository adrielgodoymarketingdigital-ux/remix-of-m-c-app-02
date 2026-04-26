-- Tabela para múltiplos técnicos por OS
CREATE TABLE public.os_tecnicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.loja_funcionarios(id) ON DELETE CASCADE,
  descricao_servico TEXT,
  comissao_tipo_snapshot TEXT,
  comissao_valor_snapshot NUMERIC,
  comissao_calculada_snapshot NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para buscas por OS
CREATE INDEX idx_os_tecnicos_os_id ON public.os_tecnicos(os_id);
CREATE INDEX idx_os_tecnicos_funcionario_id ON public.os_tecnicos(funcionario_id);

-- Enable RLS
ALTER TABLE public.os_tecnicos ENABLE ROW LEVEL SECURITY;

-- Dono pode gerenciar técnicos das suas OS
CREATE POLICY "Dono pode ver tecnicos das suas OS"
ON public.os_tecnicos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    WHERE os.id = os_tecnicos.os_id
    AND (os.user_id = auth.uid() OR public.is_funcionario_of(os.user_id))
  )
);

CREATE POLICY "Dono pode inserir tecnicos nas suas OS"
ON public.os_tecnicos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    WHERE os.id = os_tecnicos.os_id
    AND (os.user_id = auth.uid() OR public.is_funcionario_of(os.user_id))
  )
);

CREATE POLICY "Dono pode atualizar tecnicos das suas OS"
ON public.os_tecnicos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    WHERE os.id = os_tecnicos.os_id
    AND (os.user_id = auth.uid() OR public.is_funcionario_of(os.user_id))
  )
);

CREATE POLICY "Dono pode deletar tecnicos das suas OS"
ON public.os_tecnicos FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    WHERE os.id = os_tecnicos.os_id
    AND (os.user_id = auth.uid() OR public.is_funcionario_of(os.user_id))
  )
);