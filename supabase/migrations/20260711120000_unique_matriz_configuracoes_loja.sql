-- Impede múltiplas linhas de "matriz" (empresa_id IS NULL) para o mesmo user_id
-- em configuracoes_loja. O índice composto configuracoes_loja_user_empresa_unique
-- (user_id, empresa_id) não protege esse caso, pois o Postgres nunca considera
-- dois NULL iguais em uma constraint UNIQUE — múltiplas linhas de matriz para o
-- mesmo usuário passavam livremente, causando duplicatas por race condition na
-- criação da configuração inicial (ver useConfiguracaoLoja.ts).
--
-- Índice parcial: não afeta linhas de filial (empresa_id preenchido), que
-- continuam podendo ter uma linha por empresa_id, protegidas pelo índice
-- composto já existente.
CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_loja_user_matriz_unique
ON public.configuracoes_loja (user_id)
WHERE empresa_id IS NULL;
