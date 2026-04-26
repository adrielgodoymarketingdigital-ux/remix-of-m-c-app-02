-- Remover política existente e criar uma PERMISSIVE correta
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Criar política permissiva que requer autenticação
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);