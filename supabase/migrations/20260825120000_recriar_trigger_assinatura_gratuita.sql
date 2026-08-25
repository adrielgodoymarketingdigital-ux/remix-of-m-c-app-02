-- Correcao: o trigger que cria a assinatura Free automaticamente no cadastro
-- (on_auth_user_created_assinatura) foi removido em 20251204014302
-- ("FASE 1: Remover trigger duplicado") e nunca foi recriado. Desde entao,
-- novos usuarios ficam sem nenhuma linha em public.assinaturas, o que faz o
-- app aplicar os limites mais restritos do plano Free (sem financeiro,
-- contas, vendas) mesmo para quem deveria ter o trial de 24h.

-- 1. Recriar o trigger que cria a assinatura Free (com trial de 24h) no cadastro
DROP TRIGGER IF EXISTS on_auth_user_created_assinatura ON auth.users;

CREATE TRIGGER on_auth_user_created_assinatura
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.criar_assinatura_basica_gratuita();

-- 2. Backfill: criar assinatura para usuarios que se cadastraram entre a
--    remocao do trigger (2025-12-04) e agora e ficaram sem nenhuma linha.
--    Concede o trial de 24h a partir de agora, como compensacao pelo bug.
INSERT INTO public.assinaturas (user_id, plano_tipo, status, data_inicio, created_at, free_trial_ends_at)
SELECT
  u.id,
  'free',
  'active',
  u.created_at,
  u.created_at,
  now() + interval '24 hours'
FROM auth.users u
LEFT JOIN public.assinaturas a ON a.user_id = u.id
WHERE a.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
