-- Allow admins to update any profile (needed for CRM Kanban drag-and-drop)
CREATE POLICY "Admins podem atualizar profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
