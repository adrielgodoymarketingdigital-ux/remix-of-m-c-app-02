
-- Add soft delete column to dispositivos
ALTER TABLE public.dispositivos 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for performance on soft delete queries
CREATE INDEX idx_dispositivos_deleted_at ON public.dispositivos (deleted_at) WHERE deleted_at IS NOT NULL;
