-- Vínculo direto entre um item do catálogo de serviços (servicos) e um
-- "Tipo de Serviço" (tipos_servico), usado para calcular a comissão do
-- técnico SEM depender de correspondência por nome.
--
-- Nullable de propósito: serviços já existentes nascem sem vínculo e caem no
-- fluxo histórico de match por nome (Fase 1 B+c1+c2). O dono vincula aos poucos
-- (manualmente no cadastro do serviço ou pelo assistente de vinculação em massa).
--
-- ON DELETE SET NULL: excluir um Tipo de Serviço apenas desfaz o vínculo dos
-- serviços que apontavam para ele — nunca apaga serviços do catálogo.
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS tipo_servico_id uuid
  REFERENCES public.tipos_servico(id) ON DELETE SET NULL;

-- Consulta quente: "quais serviços estão vinculados a este tipo" (contador da
-- tela Tipos de Serviço) e o assistente de vinculação em massa.
CREATE INDEX IF NOT EXISTS idx_servicos_tipo_servico_id
  ON public.servicos (tipo_servico_id)
  WHERE tipo_servico_id IS NOT NULL;
