-- Fix: atualiza plano do usuário profnunes.l.s@gmail.com para intermediario_mensal
-- O upgrade foi realizado ontem (2026-05-11) via Pagar.me mas o banco não foi atualizado
-- pois o sistema ainda dependia do webhook do Stripe para sincronizar o plano_tipo.

UPDATE public.assinaturas
SET
  plano_tipo = 'intermediario_mensal',
  status     = 'active',
  updated_at = now()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'profnunes.l.s@gmail.com'
);
