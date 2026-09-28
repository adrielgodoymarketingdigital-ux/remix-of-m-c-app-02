-- =====================================================================
-- Assinatura da loja (desenhada ou enviada como imagem) para preencher o
-- bloco "Assinatura da Loja" na impressão da OS, no recibo da OS e no PDF
-- da OS enviado pelo WhatsApp.
--
-- 100% ADITIVA: duas colunas novas em configuracoes_loja, sem tocar em
-- nenhuma linha existente. Todo mundo começa com a opção DESLIGADA
-- (usar_assinatura_loja = false) e sem assinatura — impressão inalterada.
--
-- Guardada como data URI PNG em base64 (mesmo padrão das assinaturas do
-- cliente em ordens_servico.avarias), NÃO em Storage: o bucket loja-logos é
-- público, e a coluna fica protegida pelas policies RLS já existentes de
-- configuracoes_loja. Nenhuma policy nova é necessária.
-- =====================================================================

ALTER TABLE public.configuracoes_loja
  ADD COLUMN IF NOT EXISTS assinatura_loja text,
  ADD COLUMN IF NOT EXISTS usar_assinatura_loja boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.configuracoes_loja.assinatura_loja IS
  'Assinatura da loja como data URI PNG (base64, fundo transparente). Usada nos documentos só quando usar_assinatura_loja = true.';
COMMENT ON COLUMN public.configuracoes_loja.usar_assinatura_loja IS
  'true = preenche o bloco "Assinatura da Loja" na impressão/PDF da OS e no recibo com assinatura_loja.';
