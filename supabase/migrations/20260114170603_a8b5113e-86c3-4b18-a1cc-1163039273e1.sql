-- Atualizar função handle_new_user para incluir celular
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, celular)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'celular'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    celular = COALESCE(EXCLUDED.celular, profiles.celular);
  
  RETURN NEW;
END;
$function$;