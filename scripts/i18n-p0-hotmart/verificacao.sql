-- =====================================================================
-- Conferência da migration 20261101120000 (rodar DEPOIS de aplicá-la).
-- Um único resultado (UNION ALL), uma linha por checagem, só estrutura e
-- contagens: nenhum dado de cliente. Toda linha deve ter ok = true.
-- Só lê. Antes da migration as linhas 1, 2, 3 e 5 dão ok = false.
-- =====================================================================
SELECT 1 AS n, 'coluna hotmart_transaction_id text, nula, sem default' AS checagem,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'assinaturas'
                  AND column_name = 'hotmart_transaction_id' AND data_type = 'text'
                  AND is_nullable = 'YES' AND column_default IS NULL) AS ok,
       (SELECT data_type || ' ' || is_nullable || ' ' || COALESCE(column_default, '(sem default)')
          FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'assinaturas'
           AND column_name = 'hotmart_transaction_id') AS detalhe
UNION ALL
SELECT 2, 'índice único parcial (payment_provider, hotmart_transaction_id)',
       COALESCE((SELECT i.indisunique AND i.indisvalid AND i.indisready
                   AND pg_get_indexdef(i.indexrelid) =
                     'CREATE UNIQUE INDEX assinaturas_hotmart_transaction_id_key ON public.assinaturas USING btree (payment_provider, hotmart_transaction_id) WHERE (hotmart_transaction_id IS NOT NULL)'
                   FROM pg_index i
                  WHERE i.indexrelid = to_regclass('public.assinaturas_hotmart_transaction_id_key')), false),
       pg_get_indexdef(to_regclass('public.assinaturas_hotmart_transaction_id_key'))
UNION ALL
SELECT 3, 'comentário da coluna presente',
       COALESCE(col_description('public.assinaturas'::regclass,
         (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.assinaturas'::regclass
             AND attname = 'hotmart_transaction_id' AND NOT attisdropped)::int) LIKE 'Transação da Hotmart%', false),
       NULL
UNION ALL
SELECT 4, 'RLS de assinaturas continua ligado',
       (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.assinaturas'::regclass),
       (SELECT count(*)::text || ' policies' FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'assinaturas')
UNION ALL
SELECT 5, 'nenhuma transação Hotmart repetida',
       COALESCE((SELECT count(*) = 0 FROM (
                   SELECT 1 FROM public.assinaturas
                    WHERE (to_jsonb(assinaturas) ->> 'hotmart_transaction_id') IS NOT NULL
                    GROUP BY payment_provider, to_jsonb(assinaturas) ->> 'hotmart_transaction_id'
                   HAVING count(*) > 1) d)
                AND EXISTS (SELECT 1 FROM information_schema.columns
                             WHERE table_schema = 'public' AND table_name = 'assinaturas'
                               AND column_name = 'hotmart_transaction_id'), false),
       (SELECT count(*) FILTER (WHERE (to_jsonb(a) ->> 'hotmart_transaction_id') IS NOT NULL)::text
               || ' com transação; ' || count(*) FILTER (WHERE payment_provider = 'hotmart')::text
               || ' com payment_provider = hotmart'
          FROM public.assinaturas a)
ORDER BY 1;
