CREATE OR REPLACE FUNCTION public._export_auth_users_temp()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(u)), '[]'::jsonb)
  FROM (
    SELECT id, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at,
           raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at,
           confirmation_token, recovery_token, email_change_token_new, email_change,
           is_sso_user, banned_until, deleted_at, role, aud, instance_id,
           confirmation_sent_at, recovery_sent_at, email_change_sent_at,
           email_change_token_current, email_change_confirm_status,
           reauthentication_token, reauthentication_sent_at, is_anonymous
    FROM auth.users
  ) u;
$$;

REVOKE ALL ON FUNCTION public._export_auth_users_temp() FROM PUBLIC, anon, authenticated;