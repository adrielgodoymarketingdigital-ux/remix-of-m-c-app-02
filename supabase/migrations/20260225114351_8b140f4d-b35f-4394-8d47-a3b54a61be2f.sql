
-- Add video_upload_url column to support uploaded videos
ALTER TABLE public.tutoriais_videos ADD COLUMN video_upload_url text;

-- Create storage bucket for tutorial videos
INSERT INTO storage.buckets (id, name, public) VALUES ('tutoriais-videos', 'tutoriais-videos', true);

-- Storage policies: admins can upload/delete, anyone authenticated can view
CREATE POLICY "Admins podem fazer upload de videos tutoriais"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tutoriais-videos' AND EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins podem deletar videos tutoriais"
ON storage.objects FOR DELETE
USING (bucket_id = 'tutoriais-videos' AND EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins podem atualizar videos tutoriais"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tutoriais-videos' AND EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Videos tutoriais sao publicos para leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'tutoriais-videos');
