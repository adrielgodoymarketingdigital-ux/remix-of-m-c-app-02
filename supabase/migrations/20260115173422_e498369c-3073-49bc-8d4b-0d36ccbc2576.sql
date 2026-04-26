-- Adicionar coluna para controlar se o evento de registro já foi rastreado
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS registration_tracked BOOLEAN DEFAULT FALSE;

-- Comentário explicativo
COMMENT ON COLUMN public.profiles.registration_tracked IS 'Indica se o evento CompleteRegistration do Meta Pixel já foi disparado para este usuário';