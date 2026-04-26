-- Adicionar coluna para templates de mensagens WhatsApp por status da OS
ALTER TABLE configuracoes_loja 
ADD COLUMN IF NOT EXISTS mensagens_whatsapp_os JSONB DEFAULT '{
  "pendente": "Olá {{cliente}}! Sua OS #{{numero_os}} foi registrada. Seu {{dispositivo}} está aguardando atendimento. {{loja}}",
  "em_andamento": "Olá {{cliente}}! Sua OS #{{numero_os}} está em andamento. Estamos trabalhando no seu {{dispositivo}}. {{loja}}",
  "aguardando_aprovacao": "Olá {{cliente}}! Precisamos da sua aprovação para prosseguir com o serviço do {{dispositivo}}. OS #{{numero_os}}. {{loja}}",
  "aguardando_retirada": "Olá {{cliente}}! Seu {{dispositivo}} está pronto! Pode retirar quando quiser. OS #{{numero_os}}. {{loja}}",
  "finalizado": "Olá {{cliente}}! O serviço no seu {{dispositivo}} foi finalizado. OS #{{numero_os}}. {{loja}}",
  "entregue": "Olá {{cliente}}! Obrigado por escolher a {{loja}}! Seu {{dispositivo}} foi entregue. OS #{{numero_os}}. Conte sempre conosco!",
  "cancelada": "Olá {{cliente}}! A OS #{{numero_os}} do seu {{dispositivo}} foi cancelada. Qualquer dúvida, estamos à disposição. {{loja}}"
}'::jsonb;