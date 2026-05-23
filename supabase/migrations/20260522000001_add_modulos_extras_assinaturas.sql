-- Adiciona campo modulos_extras na tabela assinaturas
-- Permite liberar módulos específicos para usuários do plano básico/free sem mudar o plano inteiro
-- Exemplo de valor: '{"clientes": true, "financeiro": true}'

ALTER TABLE assinaturas
  ADD COLUMN IF NOT EXISTS modulos_extras jsonb DEFAULT NULL;

COMMENT ON COLUMN assinaturas.modulos_extras IS
  'Módulos extras liberados individualmente para este usuário, independente do plano. Ex: {"clientes": true}';
