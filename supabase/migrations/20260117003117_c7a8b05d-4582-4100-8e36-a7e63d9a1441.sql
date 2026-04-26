-- Adicionar campos de personalização de cores e imagem na tabela avisos_sistema
ALTER TABLE public.avisos_sistema 
ADD COLUMN IF NOT EXISTS cor_fundo VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cor_texto VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cor_icone VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cor_botao VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS imagem_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS imagem_posicao VARCHAR(20) DEFAULT 'direita';

-- Comentários explicativos
COMMENT ON COLUMN public.avisos_sistema.cor_fundo IS 'Cor de fundo personalizada (hex ou classe CSS)';
COMMENT ON COLUMN public.avisos_sistema.cor_texto IS 'Cor do texto personalizada (hex)';
COMMENT ON COLUMN public.avisos_sistema.cor_icone IS 'Cor do ícone personalizada (hex)';
COMMENT ON COLUMN public.avisos_sistema.cor_botao IS 'Cor do botão personalizada (hex)';
COMMENT ON COLUMN public.avisos_sistema.imagem_url IS 'URL da imagem/banner do aviso';
COMMENT ON COLUMN public.avisos_sistema.imagem_posicao IS 'Posição da imagem: direita, esquerda, topo, fundo';