-- Atualiza trigger handle_new_user para gravar parâmetros de tracking Meta (fbc, fbp, fbclid, utm_*)
-- Os valores chegam via raw_user_meta_data do signUp (options.data no cliente)
-- Isso evita race condition e bloqueio de RLS: o trigger roda como SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id, nome, email, celular,
    fbc, fbp, fbclid,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'celular',
    NEW.raw_user_meta_data->>'fbc',
    NEW.raw_user_meta_data->>'fbp',
    NEW.raw_user_meta_data->>'fbclid',
    NEW.raw_user_meta_data->>'utm_source',
    NEW.raw_user_meta_data->>'utm_medium',
    NEW.raw_user_meta_data->>'utm_campaign',
    NEW.raw_user_meta_data->>'utm_content',
    NEW.raw_user_meta_data->>'utm_term'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    celular      = COALESCE(EXCLUDED.celular,      profiles.celular),
    fbc          = COALESCE(EXCLUDED.fbc,          profiles.fbc),
    fbp          = COALESCE(EXCLUDED.fbp,          profiles.fbp),
    fbclid       = COALESCE(EXCLUDED.fbclid,       profiles.fbclid),
    utm_source   = COALESCE(EXCLUDED.utm_source,   profiles.utm_source),
    utm_medium   = COALESCE(EXCLUDED.utm_medium,   profiles.utm_medium),
    utm_campaign = COALESCE(EXCLUDED.utm_campaign, profiles.utm_campaign),
    utm_content  = COALESCE(EXCLUDED.utm_content,  profiles.utm_content),
    utm_term     = COALESCE(EXCLUDED.utm_term,     profiles.utm_term);
  RETURN NEW;
END;
$function$;
