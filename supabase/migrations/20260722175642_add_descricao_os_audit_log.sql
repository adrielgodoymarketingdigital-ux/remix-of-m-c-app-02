ALTER TABLE os_audit_log ADD COLUMN IF NOT EXISTS descricao text;

-- Permite a nova ação de auditoria manual usada pela troca de status para garantia
ALTER TABLE public.os_audit_log DROP CONSTRAINT IF EXISTS os_audit_log_acao_check;
ALTER TABLE public.os_audit_log ADD CONSTRAINT os_audit_log_acao_check
  CHECK (acao IN ('CREATE', 'UPDATE', 'DELETE', 'STATUS_GARANTIA'));
