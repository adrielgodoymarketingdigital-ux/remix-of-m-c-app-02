-- Regras de notificação para eventos de assinatura (SUBSCRIPTION_CREATED e SUBSCRIPTION_RENEWED)
-- O target 'admin' envia para usuários com role 'admin' (tabela user_roles)

INSERT INTO public.notification_rules (event_type, title_template, body_template, url_template, target, sound)
VALUES
  (
    'SUBSCRIPTION_CREATED',
    '🎉 Nova assinatura!',
    '{{plano_nome}} · R$ {{valor}}',
    '/admin/usuarios',
    'admin',
    'cash'
  ),
  (
    'SUBSCRIPTION_RENEWED',
    '🔄 Renovação de assinatura',
    '{{plano_nome}} renovado · R$ {{valor}}',
    '/admin/usuarios',
    'admin',
    'cash'
  );
