insert into notification_rules (
  event_type,
  active,
  title_template,
  body_template,
  url_template,
  target,
  sound
) values (
  'USER_REGISTERED',
  true,
  '👤 Novo cadastro!',
  'Um novo usuário se cadastrou: {{email}}',
  '/admin/usuarios',
  'owner',
  'default'
) on conflict (event_type) do nothing;
