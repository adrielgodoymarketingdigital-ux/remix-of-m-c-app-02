-- Adicionar campos de configuração de termo de garantia e layout da OS
ALTER TABLE public.configuracoes_loja 
ADD COLUMN IF NOT EXISTS termo_garantia_config JSONB DEFAULT '{
  "termo_90_dias": "Este serviço possui garantia de {{dias}} ({{dias_extenso}}) dias contados a partir da data de entrega do equipamento, conforme previsto no Código de Defesa do Consumidor (CDC - Lei 8.078/90). A garantia cobre defeitos relacionados ao serviço executado. Não estão cobertos: danos causados por mau uso, queda, contato com líquidos, modificações não autorizadas, ou desgaste natural. Para acionamento da garantia, é obrigatória a apresentação desta ordem de serviço.",
  "termo_outros_dias": "Este serviço possui garantia de {{dias}} ({{dias_extenso}}) dias contados a partir da data de entrega do equipamento. A garantia cobre defeitos relacionados ao serviço executado. Não estão cobertos: danos causados por mau uso, queda, contato com líquidos, modificações não autorizadas, ou desgaste natural. Para acionamento da garantia, é obrigatória a apresentação desta ordem de serviço.",
  "termo_sem_garantia": "Este serviço não possui garantia. O cliente declara estar ciente das condições do equipamento conforme checklist e avarias registradas neste documento."
}'::jsonb;

ALTER TABLE public.configuracoes_loja 
ADD COLUMN IF NOT EXISTS layout_os_config JSONB DEFAULT '{
  "mostrar_logo_impressao": true,
  "mostrar_logo_whatsapp": true,
  "mostrar_checklist": true,
  "mostrar_avarias": true,
  "mostrar_senha": true,
  "mostrar_assinaturas": true,
  "mostrar_termos_condicoes": true,
  "cor_primaria": "#000000",
  "tamanho_fonte": "normal"
}'::jsonb;