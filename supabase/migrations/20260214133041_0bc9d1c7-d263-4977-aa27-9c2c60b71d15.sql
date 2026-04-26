
-- Tabela para armazenar templates de mensagens WhatsApp do admin para usuários
CREATE TABLE public.admin_whatsapp_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mensagens jsonb NOT NULL DEFAULT '{
    "bloqueado": "Olá {{nome}}! Tudo bem? Vi que seu acesso ao MecApp está temporariamente bloqueado. Gostaria de ajudá-lo a regularizar sua situação e voltar a usar o sistema. Posso te ajudar com isso?",
    "trial_expirado": "Olá {{nome}}! Tudo bem? Seu período de teste gratuito do MecApp chegou ao fim. Gostaria de apresentar nossos planos para você continuar usando todas as funcionalidades. Posso te ajudar a escolher o melhor plano?",
    "assinatura_inativa": "Olá {{nome}}! Tudo bem? Notei que houve uma alteração em sua assinatura do MecApp. Gostaria de ajudá-lo a reativar seu acesso e continuar aproveitando o sistema. Como posso te ajudar?",
    "pagante_ativo": "Olá {{nome}}! Tudo bem? Sou da equipe do MecApp e gostaria de saber como está sua experiência com o sistema. Precisa de algum suporte ou tem alguma sugestão?",
    "trial_ativo": "Olá {{nome}}! Tudo bem? Percebi que você está usando o MecApp e gostaria de saber como está sendo sua experiência. Posso te ajudar em algo?"
  }'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.admin_whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler
CREATE POLICY "Admins podem ver templates WhatsApp"
ON public.admin_whatsapp_templates
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Apenas admins podem inserir
CREATE POLICY "Admins podem inserir templates WhatsApp"
ON public.admin_whatsapp_templates
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Apenas admins podem atualizar
CREATE POLICY "Admins podem atualizar templates WhatsApp"
ON public.admin_whatsapp_templates
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Inserir registro padrão
INSERT INTO public.admin_whatsapp_templates (id) VALUES (gen_random_uuid());
