-- Custo de mão de obra (métrica informativa, não altera faturamento/lucro existentes):
-- valor_hora_referencia é configurado por empresa em configuracoes_loja,
-- tempo_gasto_horas é preenchido opcionalmente na entrega da OS (DialogAssinaturaSaida).
ALTER TABLE public.configuracoes_loja
  ADD COLUMN IF NOT EXISTS valor_hora_referencia numeric(10, 2);

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS tempo_gasto_horas numeric(6, 2);
