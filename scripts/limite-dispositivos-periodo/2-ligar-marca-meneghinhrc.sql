-- LIGA o limite de dispositivos por período para meneghinhrc@gmail.com.
-- Não precisa de migration: usa a coluna existente assinaturas.modulos_extras (jsonb),
-- preservando as outras chaves que já estiverem lá.
-- Conferir antes com 1-leitura-meneghinhrc.sql (deve retornar exatamente 1 linha).
--
-- ROLLBACK (desliga e volta à regra de sempre, total acumulado):
--   update public.assinaturas
--      set modulos_extras = nullif(modulos_extras - 'limite_dispositivos_por_periodo', '{}'::jsonb)
--    where user_id = (select id from auth.users where lower(email) = 'meneghinhrc@gmail.com');
begin;

update public.assinaturas
   set modulos_extras = coalesce(modulos_extras, '{}'::jsonb) || '{"limite_dispositivos_por_periodo": true}'::jsonb
 where user_id = (select id from auth.users where lower(email) = 'meneghinhrc@gmail.com');
-- Esperado: UPDATE 1. Se vier 0 (e-mail não achado) ou mais de 1, rode ROLLBACK.

select user_id, plano_tipo, status, modulos_extras
  from public.assinaturas
 where user_id = (select id from auth.users where lower(email) = 'meneghinhrc@gmail.com');

commit;
