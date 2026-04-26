-- Remover políticas RLS permissivas da tabela assinaturas
DROP POLICY IF EXISTS "Sistema pode atualizar assinaturas" ON assinaturas;
DROP POLICY IF EXISTS "Sistema pode inserir assinaturas" ON assinaturas;