-- Personalização do recibo de venda (layout novo, A4): interruptores e textos
-- do lojista. Lida/gravada pelo app em src/hooks/useReciboVendaConfig.ts e
-- normalizada por src/lib/vendas/reciboVendaConfig.ts.
--
-- NULL = padrão (recibo igual ao de sempre). Sem DEFAULT e sem UPDATE: todas
-- as linhas existentes continuam NULL. O app grava NULL quando a config volta
-- a ser igual ao padrão.
--
-- Idempotente: pode rodar mais de uma vez.
-- A view configuracoes_loja_publico tem lista de colunas escrita à mão e NÃO
-- expõe esta coluna (nem landing_page_publico / dispositivos_catalogo).

ALTER TABLE public.configuracoes_loja
  ADD COLUMN IF NOT EXISTS recibo_venda_config jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'configuracoes_loja_recibo_venda_config_check'
      AND conrelid = 'public.configuracoes_loja'::regclass
  ) THEN
    ALTER TABLE public.configuracoes_loja
      ADD CONSTRAINT configuracoes_loja_recibo_venda_config_check
      CHECK (
        recibo_venda_config IS NULL
        OR (
          jsonb_typeof(recibo_venda_config) = 'object'
          AND octet_length(recibo_venda_config::text) <= 16384
        )
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.configuracoes_loja.recibo_venda_config IS
  'Personalização do recibo de venda A4 (novo): {versao, mostrar{...}, textos{...}}. NULL = padrão (recibo igual ao de sempre). Só o dono da loja grava; normalizado no app (reciboVendaConfig.ts). Máx. 16384 bytes.';
