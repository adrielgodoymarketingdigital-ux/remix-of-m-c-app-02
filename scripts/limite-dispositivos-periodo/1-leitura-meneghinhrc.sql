-- SOMENTE LEITURA. Situação de meneghinhrc@gmail.com: assinatura, período do limite e aparelhos.
-- Período = ciclo de 30 dias alinhado com data_fim (mesma regra do app,
-- src/lib/assinatura/limiteDispositivosPeriodo.ts). Datas mostradas em America/Sao_Paulo.
with u as (
  select id as user_id, email from auth.users where lower(email) = 'meneghinhrc@gmail.com'
),
a as (
  select s.*, coalesce(s.data_fim, s.data_inicio, s.created_at) as ancora
  from public.assinaturas s join u on u.user_id = s.user_id
),
p as (
  select a.*,
    -- fim do ciclo de 30 dias que contém agora (alinhado na âncora)
    a.ancora + (floor(extract(epoch from (now() - a.ancora)) / (30 * 86400)) + 1) * interval '30 days' as periodo_fim
  from a
)
select
  u.email, p.user_id, p.plano_tipo, p.status, p.payment_method, p.payment_provider,
  p.modulos_extras,
  (p.modulos_extras ->> 'limite_dispositivos_por_periodo') as marca_limite_por_periodo,
  p.data_inicio            at time zone 'America/Sao_Paulo' as data_inicio_brt,
  p.data_fim               at time zone 'America/Sao_Paulo' as data_fim_brt,
  p.data_proxima_cobranca  at time zone 'America/Sao_Paulo' as proxima_cobranca_brt,
  case when p.data_fim is not null then 'data_fim'
       when p.data_inicio is not null then 'data_inicio (fallback)'
       else 'created_at (fallback)' end                     as ancora_usada,
  (p.periodo_fim - interval '30 days') at time zone 'America/Sao_Paulo' as periodo_inicio_brt,
  p.periodo_fim            at time zone 'America/Sao_Paulo' as periodo_fim_renova_em_brt,
  (select count(*) from public.dispositivos d where d.user_id = p.user_id)                         as total_aparelhos_conta_hoje,
  (select count(*) from public.dispositivos d where d.user_id = p.user_id
     and d.created_at >= p.periodo_fim - interval '30 days' and d.created_at < p.periodo_fim)     as criados_no_periodo_atual,
  (select count(*) from public.dispositivos d where d.user_id = p.user_id and d.deleted_at is not null) as na_lixeira,
  (select count(*) from public.dispositivos d where d.user_id = p.user_id and d.vendido)           as vendidos,
  (select count(*) from public.dispositivos d where d.user_id = p.user_id
     and d.deleted_at is null and not coalesce(d.vendido, false))                                  as em_estoque
from p join u on u.user_id = p.user_id;
