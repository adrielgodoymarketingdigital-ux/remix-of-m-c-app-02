
-- Fix: Users can update their own conversations (needed for updating updated_at)
CREATE POLICY "Usuarios podem atualizar suas proprias conversas"
ON public.conversas_suporte
FOR UPDATE
USING (auth.uid() = user_id);

-- Fix: Users can update messages in their conversations (needed for marking as read)
CREATE POLICY "Usuarios podem atualizar mensagens das suas conversas"
ON public.mensagens_suporte
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM conversas_suporte c
  WHERE c.id = mensagens_suporte.conversa_id AND c.user_id = auth.uid()
));
