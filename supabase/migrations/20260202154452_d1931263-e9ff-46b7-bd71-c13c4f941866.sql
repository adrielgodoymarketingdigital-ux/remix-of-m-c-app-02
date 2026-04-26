-- Alterar o trigger para criar assinatura em status "demonstracao" + "canceled"
-- Isso garante que novos usuários NÃO tenham acesso automático e sejam forçados
-- a passar pelo fluxo de onboarding + checkout Stripe para ativar trial de 7 dias

CREATE OR REPLACE FUNCTION public.criar_assinatura_basica_gratuita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.assinaturas (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    plano_tipo,
    status,
    data_inicio,
    data_fim,
    data_proxima_cobranca,
    trial_with_card
  ) VALUES (
    NEW.id,
    'pending_' || NEW.id,           -- Marcado como pendente
    'sub_pending_' || NEW.id,       -- Sem subscription real ainda
    'price_pending',
    'demonstracao',                  -- MUDANÇA: era 'trial'
    'canceled',                      -- MUDANÇA: era 'trialing' - sem acesso
    NOW(),
    NOW(),                           -- Sem data fim estendida
    NOW(),
    false                            -- Não é trial com cartão ainda
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;