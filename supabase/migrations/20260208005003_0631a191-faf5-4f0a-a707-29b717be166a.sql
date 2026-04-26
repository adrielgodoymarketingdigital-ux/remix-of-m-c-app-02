-- Adicionar valor 'free' ao enum plano_tipo
ALTER TYPE plano_tipo ADD VALUE IF NOT EXISTS 'free';

-- Atualizar função trigger para criar plano free para novos usuários
CREATE OR REPLACE FUNCTION public.criar_assinatura_basica_gratuita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.assinaturas (
    user_id,
    plano_tipo,
    status,
    data_inicio
  )
  VALUES (
    NEW.id,
    'free',
    'active',
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;