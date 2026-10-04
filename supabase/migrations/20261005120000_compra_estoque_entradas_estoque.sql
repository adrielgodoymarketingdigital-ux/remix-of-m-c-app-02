-- =====================================================================
-- Compra de mercadoria p/ estoque = saída de caixa que NÃO abate lucro.
--
-- 100% ADITIVA — não lê nem escreve nenhuma linha existente.
--
-- 1) contas.compra_estoque (NOT NULL DEFAULT false, sem rewrite da tabela):
--    todas as contas atuais ficam false e continuam contando no custo
--    operacional/lucro exatamente como hoje. O lucro (frontend,
--    src/lib/financeiro/despesasOperacionais.ts) passa a ignorar só as
--    contas com compra_estoque = true — o custo da mercadoria entra no
--    lucro na venda, via vendas.custo_unitario. O Extrato (bloco 6 de
--    fn_extrato_eventos_raw) NÃO muda: a conta paga segue como saída.
--
-- 2) entradas_estoque: histórico de reposições (nasce vazia, append-only:
--    sem policy de UPDATE). RLS de dono + funcionário (is_funcionario_of)
--    + gerente de filial (restrito à empresa, como produtos/pecas).
--    Excluir é só do dono.
--
-- 3) registrar_entrada_estoque(...): RPC SECURITY INVOKER (a RLS continua
--    valendo) que faz numa única transação: trava o item (FOR UPDATE),
--    soma a quantidade no SQL, opcionalmente recalcula o custo médio,
--    opcionalmente gera a conta a pagar compra_estoque (com o pagamento em
--    pagamentos_contas quando já pago) e grava a entrada no histórico.
--    Ninguém chama essa RPC ainda (a tela de reposição muda numa fase
--    seguinte). Só authenticated executa.
-- =====================================================================

BEGIN;

-- ---------- 1. Flag em contas (instantâneo, sem rewrite) ----------
ALTER TABLE public.contas
  ADD COLUMN IF NOT EXISTS compra_estoque boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contas.compra_estoque IS
  'true = compra de mercadoria para estoque. Entra no Extrato como saída, mas fica FORA do custo operacional/lucro (o custo entra no lucro na venda, via vendas.custo_unitario).';

-- Relatório "investido em mercadoria no período" (poucas linhas → parcial).
CREATE INDEX IF NOT EXISTS idx_contas_compra_estoque_user_data
  ON public.contas (user_id, data_pagamento)
  WHERE compra_estoque;

-- ---------- 2. Histórico de entradas --------------------------------
CREATE TABLE IF NOT EXISTS public.entradas_estoque (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- dono da loja
  empresa_id          uuid REFERENCES public.empresas(id),                        -- = empresa do item
  item_tipo           text NOT NULL CHECK (item_tipo IN ('produto', 'peca')),
  produto_id          uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  peca_id             uuid REFERENCES public.pecas(id)    ON DELETE SET NULL,
  item_nome           text NOT NULL,                                              -- snapshot
  quantidade          integer NOT NULL CHECK (quantidade > 0),
  custo_unitario      numeric(12,2) CHECK (custo_unitario >= 0),                  -- NULL = reposição sem custo
  custo_total         numeric(12,2) GENERATED ALWAYS AS (quantidade * custo_unitario) STORED,
  quantidade_anterior integer,                                                    -- auditoria
  custo_anterior      numeric(12,2),
  custo_resultante    numeric(12,2),                                              -- custo gravado no item após a entrada
  fornecedor_id       uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  conta_id            uuid REFERENCES public.contas(id) ON DELETE SET NULL,       -- conta compra_estoque gerada
  observacao          text,
  data                date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  criado_por          uuid DEFAULT auth.uid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entradas_estoque_um_item CHECK (NOT (produto_id IS NOT NULL AND peca_id IS NOT NULL))
);

COMMENT ON TABLE public.entradas_estoque IS
  'Histórico de reposições de produtos/peças (append-only). conta_id aponta para a conta a pagar compra_estoque gerada, quando houver. Gravada por registrar_entrada_estoque().';

CREATE INDEX IF NOT EXISTS idx_entradas_estoque_user_data  ON public.entradas_estoque (user_id, data);
CREATE INDEX IF NOT EXISTS idx_entradas_estoque_produto    ON public.entradas_estoque (produto_id) WHERE produto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entradas_estoque_peca       ON public.entradas_estoque (peca_id)    WHERE peca_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entradas_estoque_empresa_id ON public.entradas_estoque (empresa_id);

ALTER TABLE public.entradas_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dono e funcionarios veem entradas de estoque" ON public.entradas_estoque;
CREATE POLICY "dono e funcionarios veem entradas de estoque"
  ON public.entradas_estoque FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_funcionario_of(user_id));

DROP POLICY IF EXISTS "dono e funcionarios inserem entradas de estoque" ON public.entradas_estoque;
CREATE POLICY "dono e funcionarios inserem entradas de estoque"
  ON public.entradas_estoque FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_funcionario_of(user_id));

DROP POLICY IF EXISTS "dono exclui entradas de estoque" ON public.entradas_estoque;
CREATE POLICY "dono exclui entradas de estoque"
  ON public.entradas_estoque FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Gerente de filial (mesmo padrão de produtos/pecas: restrito à empresa)
DROP POLICY IF EXISTS "gerente ve entradas de estoque da filial" ON public.entradas_estoque;
CREATE POLICY "gerente ve entradas de estoque da filial"
  ON public.entradas_estoque FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.empresa_usuarios eu
                 WHERE eu.gerente_id = auth.uid()
                   AND eu.proprietario_id = entradas_estoque.user_id
                   AND eu.empresa_id = entradas_estoque.empresa_id));

DROP POLICY IF EXISTS "gerente insere entradas de estoque da filial" ON public.entradas_estoque;
CREATE POLICY "gerente insere entradas de estoque da filial"
  ON public.entradas_estoque FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.empresa_usuarios eu
                      WHERE eu.gerente_id = auth.uid()
                        AND eu.proprietario_id = entradas_estoque.user_id
                        AND eu.empresa_id = entradas_estoque.empresa_id));

-- Sem policy de UPDATE: histórico imutável (correção = excluir + lançar de novo).

-- ---------- 3. RPC registrar_entrada_estoque ------------------------
-- SECURITY INVOKER: todo SELECT/UPDATE/INSERT abaixo passa pela RLS de
-- quem chamou. Além disso, a função confere explicitamente que quem chamou
-- é dono, funcionário ativo ou gerente da filial do item — defesa extra
-- caso alguma policy permissiva antiga (USING (true)) ainda exista em
-- produtos/pecas.
--
-- Custo médio (espelho de src/lib/estoque/custoMedio.ts):
--   custo novo arredondado a 2 casas;
--   se quantidade anterior <= 0 ou custo anterior nulo/zero → custo novo;
--   senão round((qa*ca + qn*cn) / (qa + qn), 2).
CREATE OR REPLACE FUNCTION public.registrar_entrada_estoque(
  p_item_tipo             text,
  p_item_id               uuid,
  p_quantidade            integer,
  p_custo_unitario        numeric DEFAULT NULL,
  p_fornecedor_id         uuid    DEFAULT NULL,
  p_gerar_conta           boolean DEFAULT false,
  p_pago                  boolean DEFAULT false,
  p_forma_pagamento       text    DEFAULT NULL,
  p_observacao            text    DEFAULT NULL,
  p_atualizar_custo_medio boolean DEFAULT false
)
RETURNS TABLE (
  entrada_id       uuid,
  quantidade_final integer,
  custo_final      numeric,
  conta_id         uuid
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  v_hoje        date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dono        uuid;
  v_empresa_id  uuid;
  v_nome        text;
  v_qtd_ant     integer;
  v_custo_ant   numeric;
  v_custo_novo  numeric;
  v_custo_final numeric;
  v_qtd_final   integer;
  v_valor_conta numeric;
  v_conta_id    uuid;
  v_entrada_id  uuid;
BEGIN
  -- ---- validação dos parâmetros ----
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_item_tipo IS NULL OR p_item_tipo NOT IN ('produto', 'peca') THEN
    RAISE EXCEPTION 'Tipo de item inválido: use ''produto'' ou ''peca''' USING ERRCODE = '22023';
  END IF;
  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'Item não informado' USING ERRCODE = '22023';
  END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'A quantidade deve ser maior que zero' USING ERRCODE = '22023';
  END IF;
  IF p_custo_unitario IS NOT NULL AND p_custo_unitario < 0 THEN
    RAISE EXCEPTION 'O custo unitário não pode ser negativo' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_gerar_conta, false) AND COALESCE(p_custo_unitario, 0) <= 0 THEN
    RAISE EXCEPTION 'Para lançar a compra em Contas a Pagar, informe o custo unitário' USING ERRCODE = '22023';
  END IF;

  v_custo_novo := round(p_custo_unitario, 2);

  -- ---- trava o item (RLS de SELECT + UPDATE de quem chamou) ----
  IF p_item_tipo = 'produto' THEN
    SELECT pr.user_id, pr.empresa_id, pr.nome, COALESCE(pr.quantidade, 0), pr.custo
      INTO v_dono, v_empresa_id, v_nome, v_qtd_ant, v_custo_ant
      FROM public.produtos pr
     WHERE pr.id = p_item_id
       AND pr.deleted_at IS NULL
       FOR UPDATE;
  ELSE
    SELECT pc.user_id, pc.empresa_id, pc.nome, COALESCE(pc.quantidade, 0), pc.custo
      INTO v_dono, v_empresa_id, v_nome, v_qtd_ant, v_custo_ant
      FROM public.pecas pc
     WHERE pc.id = p_item_id
       AND pc.deleted_at IS NULL
       FOR UPDATE;
  END IF;

  IF NOT FOUND
     OR NOT (
       v_dono = auth.uid()
       OR public.is_funcionario_of(v_dono)
       OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu
                   WHERE eu.gerente_id = auth.uid()
                     AND eu.proprietario_id = v_dono
                     AND eu.empresa_id = v_empresa_id)
     ) THEN
    RAISE EXCEPTION 'Item não encontrado ou sem acesso' USING ERRCODE = '42501';
  END IF;

  -- ---- custo resultante ----
  IF v_custo_novo IS NOT NULL AND COALESCE(p_atualizar_custo_medio, false) THEN
    IF v_qtd_ant <= 0 OR COALESCE(v_custo_ant, 0) = 0 THEN
      v_custo_final := v_custo_novo;
    ELSE
      v_custo_final := round(
        (v_qtd_ant * v_custo_ant + p_quantidade * v_custo_novo) / (v_qtd_ant + p_quantidade),
        2
      );
    END IF;
  ELSE
    v_custo_final := v_custo_ant;
  END IF;

  -- ---- soma a quantidade direto no SQL (sem ler-e-gravar no cliente) ----
  IF p_item_tipo = 'produto' THEN
    UPDATE public.produtos pr
       SET quantidade = COALESCE(pr.quantidade, 0) + p_quantidade,
           custo      = v_custo_final
     WHERE pr.id = p_item_id
    RETURNING pr.quantidade INTO v_qtd_final;
  ELSE
    UPDATE public.pecas pc
       SET quantidade = COALESCE(pc.quantidade, 0) + p_quantidade,
           custo      = v_custo_final
     WHERE pc.id = p_item_id
    RETURNING pc.quantidade INTO v_qtd_final;
  END IF;

  IF v_qtd_final IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado ou sem acesso' USING ERRCODE = '42501';
  END IF;

  -- ---- conta a pagar compra_estoque (opcional) ----
  IF COALESCE(p_gerar_conta, false) THEN
    v_valor_conta := round(p_quantidade * v_custo_novo, 2);

    INSERT INTO public.contas (
      user_id, empresa_id, tipo, nome, valor, data, status, recorrente,
      categoria, descricao, fornecedor_id, forma_pagamento,
      data_pagamento, valor_pago, usa_historico_pagamentos, compra_estoque
    ) VALUES (
      v_dono,
      v_empresa_id,
      'pagar'::tipo_conta,
      'Compra de mercadoria: ' || v_nome || ' (' || p_quantidade || ' un.)',
      v_valor_conta,
      v_hoje,
      (CASE WHEN COALESCE(p_pago, false) THEN 'pago' ELSE 'pendente' END)::status_conta,
      false,
      'Compra de Mercadoria',
      NULLIF(btrim(p_observacao), ''),
      p_fornecedor_id,
      p_forma_pagamento,
      CASE WHEN COALESCE(p_pago, false) THEN v_hoje ELSE NULL END,
      CASE WHEN COALESCE(p_pago, false) THEN v_valor_conta ELSE 0 END,
      true,
      true
    )
    RETURNING id INTO v_conta_id;

    -- Conta do modelo novo (usa_historico_pagamentos = true): o pagamento
    -- precisa existir em pagamentos_contas, senão a tela de baixa mostra
    -- saldo em aberto. O trigger trg_pagamentos_contas_sync recalcula
    -- valor_pago/status/data_pagamento com os mesmos valores acima.
    IF COALESCE(p_pago, false) THEN
      INSERT INTO public.pagamentos_contas (
        conta_id, user_id, empresa_id, valor, data_pagamento, forma_pagamento, observacao
      ) VALUES (
        v_conta_id, v_dono, v_empresa_id, v_valor_conta, v_hoje, p_forma_pagamento,
        'Compra de mercadoria (entrada de estoque)'
      );
    END IF;
  END IF;

  -- ---- histórico ----
  INSERT INTO public.entradas_estoque (
    user_id, empresa_id, item_tipo, produto_id, peca_id, item_nome,
    quantidade, custo_unitario, quantidade_anterior, custo_anterior,
    custo_resultante, fornecedor_id, conta_id, observacao, data
  ) VALUES (
    v_dono,
    v_empresa_id,
    p_item_tipo,
    CASE WHEN p_item_tipo = 'produto' THEN p_item_id END,
    CASE WHEN p_item_tipo = 'peca' THEN p_item_id END,
    v_nome,
    p_quantidade,
    v_custo_novo,
    v_qtd_ant,
    v_custo_ant,
    v_custo_final,
    p_fornecedor_id,
    v_conta_id,
    NULLIF(btrim(p_observacao), ''),
    v_hoje
  )
  RETURNING id INTO v_entrada_id;

  RETURN QUERY SELECT v_entrada_id, v_qtd_final, v_custo_final, v_conta_id;
END;
$function$;

COMMENT ON FUNCTION public.registrar_entrada_estoque(text, uuid, integer, numeric, uuid, boolean, boolean, text, text, boolean) IS
  'Entrada de estoque atômica: soma quantidade, recalcula custo médio (opcional), gera conta a pagar compra_estoque (opcional) e grava o histórico em entradas_estoque. SECURITY INVOKER (RLS vale).';

REVOKE EXECUTE ON FUNCTION public.registrar_entrada_estoque(text, uuid, integer, numeric, uuid, boolean, boolean, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_estoque(text, uuid, integer, numeric, uuid, boolean, boolean, text, text, boolean) TO authenticated;

COMMIT;
