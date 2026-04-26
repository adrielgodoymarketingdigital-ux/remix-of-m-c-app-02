-- 1. Corrigir política DELETE na tabela clientes (já existe, mas vamos garantir)
DROP POLICY IF EXISTS "Users can delete own clients" ON clientes;
CREATE POLICY "Users can delete own clients"
ON clientes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 2. Adicionar política DELETE na tabela configuracoes_loja
DROP POLICY IF EXISTS "Users can delete own store config" ON configuracoes_loja;
CREATE POLICY "Users can delete own store config"
ON configuracoes_loja FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3. Adicionar política DELETE na tabela profiles
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
CREATE POLICY "Users can delete own profile"
ON profiles FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Corrigir política SELECT da tabela kirvano_eventos (restringir apenas para admins)
DROP POLICY IF EXISTS "Usuarios podem ver eventos Kirvano" ON kirvano_eventos;
CREATE POLICY "Admins can view kirvano events"
ON kirvano_eventos FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));