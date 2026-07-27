-- Tempo médio estimado (em horas decimais) por tipo de serviço cadastrado.
-- Usado como referência de lucro/hora na seção "Lucratividade por Serviço"
-- quando ainda não há OS desse serviço com tempo real registrado.
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS tempo_medio_estimado_horas numeric(6, 2);
