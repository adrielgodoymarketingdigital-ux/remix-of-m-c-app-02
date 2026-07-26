-- Permite registrar no histórico da OS quando o checklist de saída é preenchido
-- na confirmação de entrega (etapa opcional em DialogAssinaturaSaida).
ALTER TABLE public.os_audit_log DROP CONSTRAINT IF EXISTS os_audit_log_acao_check;
ALTER TABLE public.os_audit_log ADD CONSTRAINT os_audit_log_acao_check
  CHECK (acao IN ('CREATE', 'UPDATE', 'DELETE', 'STATUS_GARANTIA', 'CHECKLIST_SAIDA'));
