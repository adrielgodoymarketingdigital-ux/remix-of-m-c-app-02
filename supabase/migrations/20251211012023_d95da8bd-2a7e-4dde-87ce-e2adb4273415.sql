-- =====================================================
-- CORREÇÃO DE SEGURANÇA: Políticas RLS
-- =====================================================

-- 1. PROFILES: Garantir que usuários só vejam seus próprios dados
-- A política existente já está correta (auth.uid() = user_id)
-- Mas vamos reforçar removendo e recriando para garantir

-- 2. ASSINATURAS: Bloquear INSERT, UPDATE, DELETE por usuários
-- Apenas o sistema (service_role via webhooks) pode modificar assinaturas

-- Criar políticas de bloqueio para assinaturas
-- Estas políticas impedem que usuários autenticados modifiquem assinaturas diretamente

-- Policy para INSERT: Nenhum usuário pode inserir diretamente
-- (assinaturas são criadas pelo trigger ou webhooks com service_role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'assinaturas' 
    AND policyname = 'System only can insert subscriptions'
  ) THEN
    CREATE POLICY "System only can insert subscriptions" 
    ON public.assinaturas 
    FOR INSERT 
    TO authenticated
    WITH CHECK (false);
  END IF;
END $$;

-- Policy para UPDATE: Nenhum usuário pode atualizar diretamente
-- (atualizações são feitas por webhooks com service_role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'assinaturas' 
    AND policyname = 'System only can update subscriptions'
  ) THEN
    CREATE POLICY "System only can update subscriptions" 
    ON public.assinaturas 
    FOR UPDATE 
    TO authenticated
    USING (false);
  END IF;
END $$;

-- Policy para DELETE: Nenhum usuário pode deletar diretamente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'assinaturas' 
    AND policyname = 'System only can delete subscriptions'
  ) THEN
    CREATE POLICY "System only can delete subscriptions" 
    ON public.assinaturas 
    FOR DELETE 
    TO authenticated
    USING (false);
  END IF;
END $$;

-- Comentário explicativo
COMMENT ON TABLE public.assinaturas IS 'Tabela de assinaturas - somente leitura para usuários. Modificações apenas via service_role (webhooks Stripe).';