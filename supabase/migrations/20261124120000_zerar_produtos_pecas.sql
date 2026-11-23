-- =====================================================================
-- "Começar do zero" — categoria nova "Produtos e peças" (produtos_pecas)
--
-- Apaga só o estoque de produtos e peças, sem mexer nos aparelhos:
--   APAGA:  produtos, peças, entradas de estoque, as ligações "código do
--           fornecedor = produto/peça" das notas XML (compras_xml_mapeamento,
--           que não existem sem o produto: FK CASCADE + CHECK de não nulo;
--           decisão do Adriel em 2026-11-23) e as fotos (só o bucket
--           produtos-fotos).
--   INCLUI: vendas (TODAS, inclusive as de aparelhos), como o Estoque já faz.
--   FICA:   aparelhos e IMEIs, compras de aparelhos, pessoas de quem comprou,
--           fornecedores, listas de compras, notas XML importadas e os itens
--           delas (sem o produto/peça e sem a entrada de estoque), serviços
--           cadastrados (sem a peça). A execução prova, linha a linha (md5),
--           que essas tabelas ficaram iguais.
--   Estoque + Produtos e peças = Estoque (fica em "absorvidas" na prévia).
--   Tudo continua exatamente como antes (Produtos e peças não entra).
--
-- Só recria (CREATE OR REPLACE) as duas funções, a partir do texto em vigor:
--   zerar_meus_dados_previa   → base: 20261027120000_zerar_meus_dados_etapa1.sql
--   zerar_meus_dados_executar → base: 20261029120000_zerar_cota_registros_apagados_etapa3a.sql
-- Mesma assinatura, SECURITY DEFINER, search_path, REVOKE/GRANT, ZD000–ZD007,
-- trava de admin/funcionário/gerente/filial, "APAGAR", senha recente, 10 min,
-- impressão e conferência final. _zerar_catalogo() NÃO muda: produtos, peças,
-- entradas e mapeamento continuam na categoria 'estoque' do catálogo; as
-- funções conhecem a lista de "Produtos e peças" (c_tab_pp) e usam a ordem do
-- catálogo (filhas antes das mães).
-- Nenhuma tabela, coluna, índice ou dado é criado/alterado. Ninguém vê a
-- categoria nova até a tela publicada (e a tela continua só para admin e
-- contas de teste marcadas).
--
-- ANTES: scripts/zerar-produtos-pecas/0-conferir-producao.sql (somente leitura).
-- DEPOIS: scripts/zerar-produtos-pecas/1-verificar.sql.
-- ROLLBACK: scripts/zerar-produtos-pecas/rollback.sql (volta as duas funções
-- ao texto exato anterior; não apaga dado nenhum).
-- NUNCA `supabase db push` (schema_migrations da produção para em 20260606000001).
-- =====================================================================

BEGIN;


-- ---------------------------------------------------------------------
-- 1) PRÉVIA — somente leitura
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zerar_meus_dados_previa(p_categorias text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  c_ordem     constant text[] := ARRAY['vendas', 'os', 'clientes', 'financeiro', 'estoque', 'produtos_pecas', 'orcamentos'];
  c_validas   constant text[] := ARRAY['vendas', 'os', 'clientes', 'financeiro', 'estoque', 'produtos_pecas', 'orcamentos', 'tudo'];
  -- "Produtos e peças": as tabelas do Estoque que esta categoria apaga (a ordem
  -- de apagar é a do catálogo; nele elas continuam na categoria 'estoque').
  c_tab_pp    constant text[] := ARRAY['public.entradas_estoque', 'public.compras_xml_mapeamento',
                                       'public.produtos', 'public.pecas'];
  v_pp        boolean;
  v_absorvidas jsonb := '[]'::jsonb;
  v_uid       uuid := auth.uid();
  v_pedidas   text[];
  v_ef        text[];
  v_casar     text[];          -- categorias do catálogo que entram (inclui 'tudo')
  v_tudo      boolean;
  v_auto      jsonb := '[]'::jsonb;
  v_codigo    text;
  v_motivo    text;
  v_detalhe   text[] := '{}';
  v_os        uuid[];
  v_cli       uuid[];
  v_filiais   uuid[] := '{}';
  v_empresas  uuid[] := '{}';
  v_tab       jsonb := '{}'::jsonb;
  v_resumo    jsonb := '{}'::jsonb;
  v_desv      jsonb := '{}'::jsonb;
  v_avisos    jsonb := '[]'::jsonb;
  v_cnt       bigint;
  v_existe    boolean;
  v_os_ult    int;
  v_venda_ult int;
  v_os_zera   boolean;
  v_venda_zera boolean;
  v_login_ok  boolean;
  v_ultima    timestamptz;
  v_proxima   timestamptz;
  v_amr       jsonb;
  r           record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login para continuar.' USING ERRCODE = 'ZD000';
  END IF;

  -- Categorias pedidas: validar e expandir
  IF p_categorias IS NULL OR cardinality(p_categorias) = 0 THEN
    RAISE EXCEPTION 'Escolha pelo menos um item para apagar.' USING ERRCODE = 'ZD007';
  END IF;
  v_pedidas := ARRAY(SELECT DISTINCT lower(trim(x)) FROM unnest(p_categorias) x WHERE x IS NOT NULL ORDER BY 1);
  IF EXISTS (SELECT 1 FROM unnest(v_pedidas) x WHERE NOT x = ANY (c_validas)) OR cardinality(v_pedidas) = 0 THEN
    RAISE EXCEPTION 'Item desconhecido na lista do que apagar.' USING ERRCODE = 'ZD007';
  END IF;
  v_tudo := 'tudo' = ANY (v_pedidas);
  -- Tudo = todas as categorias de antes (o Estoque já contém Produtos e peças).
  v_ef := CASE WHEN v_tudo THEN array_remove(c_ordem, 'produtos_pecas') ELSE array_remove(v_pedidas, 'tudo') END;

  IF 'clientes' = ANY (v_ef) THEN
    IF NOT 'os' = ANY (v_ef) THEN
      v_ef := v_ef || 'os'::text;
      v_auto := v_auto || jsonb_build_object('categoria', 'os', 'por_causa_de', 'clientes',
        'motivo', 'As ordens de serviço ficariam sem cliente.');
    END IF;
    IF NOT 'vendas' = ANY (v_ef) THEN
      v_ef := v_ef || 'vendas'::text;
      v_auto := v_auto || jsonb_build_object('categoria', 'vendas', 'por_causa_de', 'clientes',
        'motivo', 'As vendas ficariam sem cliente.');
    END IF;
    IF NOT 'orcamentos' = ANY (v_ef) THEN
      v_ef := v_ef || 'orcamentos'::text;
      v_auto := v_auto || jsonb_build_object('categoria', 'orcamentos', 'por_causa_de', 'clientes',
        'motivo', 'Os orçamentos ficariam sem cliente.');
    END IF;
  END IF;
  -- Estoque marcado: Produtos e peças já está dentro dele (não apaga nem conta duas vezes).
  IF 'estoque' = ANY (v_ef) AND 'produtos_pecas' = ANY (v_ef) THEN
    v_ef := array_remove(v_ef, 'produtos_pecas');
    v_absorvidas := v_absorvidas || jsonb_build_object('categoria', 'produtos_pecas', 'por_causa_de', 'estoque',
      'motivo', 'O Estoque já apaga os produtos e as peças.');
  END IF;
  IF 'estoque' = ANY (v_ef) AND NOT 'vendas' = ANY (v_ef) THEN
    v_ef := v_ef || 'vendas'::text;
    v_auto := v_auto || jsonb_build_object('categoria', 'vendas', 'por_causa_de', 'estoque',
      'motivo', 'As vendas ficariam sem o produto ou aparelho vendido.');
  END IF;
  IF 'produtos_pecas' = ANY (v_ef) AND NOT 'vendas' = ANY (v_ef) THEN
    v_ef := v_ef || 'vendas'::text;
    v_auto := v_auto || jsonb_build_object('categoria', 'vendas', 'por_causa_de', 'produtos_pecas',
      'motivo', 'As vendas ficariam sem o produto ou a peça vendida.');
  END IF;
  v_ef := ARRAY(SELECT x FROM unnest(c_ordem) WITH ORDINALITY u(x, i) WHERE x = ANY (v_ef) ORDER BY i);
  v_casar := v_ef || CASE WHEN v_tudo THEN ARRAY['tudo'] ELSE '{}'::text[] END;
  v_pp := 'produtos_pecas' = ANY (v_ef);

  -- Quem pode: só o dono da conta (trava igual à do B_zerar.sql)
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role::text = 'admin') THEN
    v_codigo := 'admin';
    v_motivo := 'Contas de administrador não podem usar este recurso.';
  ELSIF EXISTS (SELECT 1 FROM public.loja_funcionarios WHERE funcionario_user_id = v_uid AND loja_user_id <> v_uid) THEN
    v_codigo := 'funcionario';
    v_motivo := 'Só o dono da conta pode apagar os dados da loja.';
  ELSIF to_regclass('public.empresa_usuarios') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.empresa_usuarios WHERE gerente_id = $1)' INTO v_existe USING v_uid;
    IF v_existe THEN
      v_codigo := 'gerente';
      v_motivo := 'Só o dono da conta pode apagar os dados da loja.';
    END IF;
  END IF;

  IF v_codigo IS NULL THEN
    v_os  := ARRAY(SELECT id FROM public.ordens_servico WHERE user_id = v_uid);
    v_cli := ARRAY(SELECT id FROM public.clientes WHERE user_id = v_uid);

    -- Filiais com dados, ou linhas de outro usuário nas empresas dele
    IF to_regclass('public.empresas') IS NOT NULL THEN
      EXECUTE 'SELECT ARRAY(SELECT id FROM public.empresas WHERE proprietario_id = $1 AND tipo = ''filial'')' INTO v_filiais USING v_uid;
      EXECUTE 'SELECT ARRAY(SELECT id FROM public.empresas WHERE proprietario_id = $1)' INTO v_empresas USING v_uid;
    END IF;
    IF cardinality(v_empresas) > 0 THEN
      FOR r IN
        SELECT c.tabela, c.filtro,
               EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass(c.tabela)
                         AND a.attname = 'user_id' AND NOT a.attisdropped) AS tem_user
        FROM public._zerar_catalogo() c
        WHERE c.lista = 'APAGAR' AND to_regclass(c.tabela) IS NOT NULL
          AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = to_regclass(c.tabela)
                        AND a.attname = 'empresa_id' AND NOT a.attisdropped)
      LOOP
        IF cardinality(v_filiais) > 0 THEN
          EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE (%s) AND empresa_id = ANY ($4))', r.tabela, r.filtro)
            INTO v_existe USING v_uid, v_os, v_cli, v_filiais;
          IF v_existe THEN v_detalhe := v_detalhe || format('%s: dados de filial', r.tabela); END IF;
        END IF;
        IF r.tem_user THEN
          EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE empresa_id = ANY ($2) AND user_id IS DISTINCT FROM $1)', r.tabela)
            INTO v_existe USING v_uid, v_empresas;
          IF v_existe THEN v_detalhe := v_detalhe || format('%s: linha de outro usuário numa empresa dele', r.tabela); END IF;
        END IF;
      END LOOP;
      IF cardinality(v_detalhe) > 0 THEN
        v_codigo := 'filiais';
        v_motivo := 'Sua conta tem filiais com dados. Fale com o suporte.';
      END IF;
    END IF;
  END IF;

  IF v_codigo IS NULL THEN
    -- Tabela que o catálogo não conhece, com dados dele (pelo dono ou por ligação com o que seria apagado)
    FOR r IN
      SELECT k.oid::regclass::text AS t, a.attname AS c
      FROM pg_class k
      JOIN pg_attribute a ON a.attrelid = k.oid AND NOT a.attisdropped
      WHERE k.relnamespace = 'public'::regnamespace AND k.relkind IN ('r', 'p')
        AND a.attname IN ('user_id', 'loja_user_id', 'proprietario_id')
        AND NOT EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE to_regclass(c.tabela) = k.oid)
    LOOP
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', r.t, r.c) INTO v_existe USING v_uid;
      IF v_existe THEN v_detalhe := v_detalhe || format('tabela não classificada %s (%s)', r.t, r.c); END IF;
    END LOOP;
    FOR r IN
      SELECT con.conrelid::regclass::text AS filha, af.attname AS col_filha,
             con.confrelid::regclass::text AS mae, am.attname AS col_mae
      FROM pg_constraint con
      JOIN pg_class kf ON kf.oid = con.conrelid
      JOIN pg_attribute af ON af.attrelid = con.conrelid AND af.attnum = con.conkey[1]
      JOIN pg_attribute am ON am.attrelid = con.confrelid AND am.attnum = con.confkey[1]
      WHERE con.contype = 'f' AND kf.relnamespace = 'public'::regnamespace
        AND NOT EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE to_regclass(c.tabela) = con.conrelid)
        AND EXISTS (SELECT 1 FROM public._zerar_catalogo() c WHERE c.lista = 'APAGAR' AND to_regclass(c.tabela) = con.confrelid)
        AND EXISTS (SELECT 1 FROM pg_attribute x WHERE x.attrelid = con.confrelid AND x.attname = 'user_id' AND NOT x.attisdropped)
    LOOP
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s f WHERE f.%I IN (SELECT m.%I FROM %s m WHERE m.user_id = $1))',
                     r.filha, r.col_filha, r.col_mae, r.mae)
        INTO v_existe USING v_uid;
      IF v_existe THEN v_detalhe := v_detalhe || format('tabela não classificada %s (ligada a %s)', r.filha, r.mae); END IF;
    END LOOP;
    IF cardinality(v_detalhe) > 0 THEN
      v_codigo := 'tabela_nao_classificada';
      v_motivo := 'Encontramos dados que este recurso ainda não sabe apagar com segurança. Fale com o suporte.';
    END IF;
  END IF;

  IF v_codigo IS NOT NULL THEN
    RETURN jsonb_build_object(
      'pode_usar', false, 'codigo', v_codigo, 'motivo', v_motivo,
      'detalhe_suporte', to_jsonb(v_detalhe), 'categorias_pedidas', to_jsonb(v_pedidas));
  END IF;

  -- Contagens do que será apagado
  FOR r IN
    SELECT c.tabela, c.filtro FROM public._zerar_catalogo() c
    WHERE c.lista = 'APAGAR' AND (c.categoria = ANY (v_casar) OR (v_pp AND c.tabela = ANY (c_tab_pp))) AND to_regclass(c.tabela) IS NOT NULL
    ORDER BY c.ordem
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %s', r.tabela, r.filtro) INTO v_cnt USING v_uid, v_os, v_cli;
    v_tab := v_tab || jsonb_build_object(replace(r.tabela, 'public.', ''), v_cnt);
  END LOOP;

  -- Resumo por categoria, em números que o lojista reconhece
  IF 'vendas' = ANY (v_ef) THEN
    v_resumo := v_resumo || jsonb_build_object('vendas', jsonb_build_object(
      -- parcelas e o 2º pagamento são linhas extras da mesma venda
      'vendas', (SELECT count(*) FROM public.vendas WHERE user_id = v_uid
                   AND (parcela_numero IS NULL OR parcela_numero = 1)
                   AND observacoes IS DISTINCT FROM 'pagamento_duplo_secundario'),
      'vendas_avulsas', COALESCE((v_tab->>'vendas_avulsas')::bigint, 0) + COALESCE((v_tab->>'servicos_avulsos')::bigint, 0),
      'pedidos', COALESCE((v_tab->>'pedidos')::bigint, 0),
      'trocas_garantia', COALESCE((v_tab->>'trocas_garantia')::bigint, 0)));
  END IF;
  IF 'os' = ANY (v_ef) THEN
    v_resumo := v_resumo || jsonb_build_object('os', jsonb_build_object(
      'ordens_servico', COALESCE((v_tab->>'ordens_servico')::bigint, 0),
      'na_lixeira', (SELECT count(*) FROM public.ordens_servico WHERE user_id = v_uid AND deleted_at IS NOT NULL)));
  END IF;
  IF 'clientes' = ANY (v_ef) THEN
    v_resumo := v_resumo || jsonb_build_object('clientes', jsonb_build_object(
      'clientes', COALESCE((v_tab->>'clientes')::bigint, 0),
      'pontos_fidelidade', COALESCE((v_tab->>'fidelidade_pontos')::bigint, 0),
      'remessas', COALESCE((v_tab->>'remessas_corporativas')::bigint, 0)));
  END IF;
  IF 'financeiro' = ANY (v_ef) THEN
    v_resumo := v_resumo || jsonb_build_object('financeiro', jsonb_build_object(
      'contas', COALESCE((v_tab->>'contas')::bigint, 0),
      'caixas', COALESCE((v_tab->>'caixas')::bigint, 0),
      'lancamentos_extrato', COALESCE((v_tab->>'extrato_lancamentos_manuais')::bigint, 0)));
  END IF;
  IF 'estoque' = ANY (v_ef) THEN
    v_resumo := v_resumo || jsonb_build_object('estoque', jsonb_build_object(
      'produtos', COALESCE((v_tab->>'produtos')::bigint, 0),
      'pecas', COALESCE((v_tab->>'pecas')::bigint, 0),
      'aparelhos', COALESCE((v_tab->>'dispositivos')::bigint, 0),
      'compras_aparelhos', COALESCE((v_tab->>'compras_dispositivos')::bigint, 0),
      'fornecedores', COALESCE((v_tab->>'fornecedores')::bigint, 0),
      'notas_xml', COALESCE((v_tab->>'compras_xml_importadas')::bigint, 0)));
  END IF;
  IF v_pp THEN
    v_resumo := v_resumo || jsonb_build_object('produtos_pecas', jsonb_build_object(
      'produtos', COALESCE((v_tab->>'produtos')::bigint, 0),
      'pecas', COALESCE((v_tab->>'pecas')::bigint, 0),
      'entradas_estoque', COALESCE((v_tab->>'entradas_estoque')::bigint, 0),
      'ligacoes_xml', COALESCE((v_tab->>'compras_xml_mapeamento')::bigint, 0)));
  END IF;
  IF 'orcamentos' = ANY (v_ef) THEN
    v_resumo := v_resumo || jsonb_build_object('orcamentos', jsonb_build_object(
      'orcamentos', COALESCE((v_tab->>'orcamentos')::bigint, 0)));
  END IF;

  -- Ligações desfeitas (SET NULL) — a execução faz exatamente estas
  IF 'clientes' = ANY (v_ef) AND NOT 'financeiro' = ANY (v_ef) THEN
    v_desv := v_desv || jsonb_build_object('contas_sem_cliente',
      (SELECT count(*) FROM public.contas WHERE user_id = v_uid AND cliente_id = ANY (v_cli)));
  END IF;
  IF 'estoque' = ANY (v_ef) THEN
    IF NOT 'os' = ANY (v_ef) THEN
      v_desv := v_desv || jsonb_build_object('os_sem_fornecedor',
        (SELECT count(*) FROM public.ordens_servico WHERE user_id = v_uid
           AND servico_fornecedor_id IN (SELECT id FROM public.fornecedores WHERE user_id = v_uid)));
    END IF;
    v_desv := v_desv || jsonb_build_object('servicos_sem_peca',
      (SELECT count(*) FROM public.servicos WHERE user_id = v_uid
         AND peca_id IN (SELECT id FROM public.pecas WHERE user_id = v_uid)));
    IF NOT 'financeiro' = ANY (v_ef) THEN
      v_desv := v_desv || jsonb_build_object('contas_sem_fornecedor',
        (SELECT count(*) FROM public.contas WHERE user_id = v_uid
           AND fornecedor_id IN (SELECT id FROM public.fornecedores WHERE user_id = v_uid)));
    END IF;
  END IF;

  IF v_pp THEN
    -- Ficam: os serviços cadastrados (sem a peça) e os itens das notas XML
    -- (sem o produto/peça e sem a entrada de estoque, que são apagados).
    v_desv := v_desv || jsonb_build_object('servicos_sem_peca',
      (SELECT count(*) FROM public.servicos WHERE user_id = v_uid
         AND peca_id IN (SELECT id FROM public.pecas WHERE user_id = v_uid)));
    v_desv := v_desv || jsonb_build_object('itens_xml_sem_produto',
      (SELECT count(*) FROM public.compras_xml_itens
        WHERE importacao_id IN (SELECT id FROM public.compras_xml_importadas WHERE user_id = v_uid)
          AND (produto_id IN (SELECT id FROM public.produtos WHERE user_id = v_uid)
               OR peca_id IN (SELECT id FROM public.pecas WHERE user_id = v_uid)
               OR entrada_estoque_id IN (SELECT id FROM public.entradas_estoque WHERE user_id = v_uid))));
  END IF;

  -- Contadores (regra b): OS só volta a 1 se não sobrar OS nem conta citando número de OS
  SELECT ultimo_numero INTO v_os_ult FROM public.user_os_counters WHERE user_id = v_uid;
  SELECT ultimo_numero INTO v_venda_ult FROM public.user_venda_counters WHERE user_id = v_uid;
  v_venda_zera := 'vendas' = ANY (v_ef);
  v_os_zera := 'os' = ANY (v_ef) AND ('financeiro' = ANY (v_ef) OR NOT EXISTS (
    SELECT 1 FROM public.contas WHERE user_id = v_uid AND COALESCE(os_numero, '') <> ''));

  -- Avisos em português simples
  v_avisos := v_avisos || jsonb_build_object('codigo', 'sem_volta', 'quantidade', NULL,
    'texto', 'O que for apagado some de vez. Não tem como recuperar.');
  IF v_pp THEN
    SELECT count(*) INTO v_cnt FROM public.vendas WHERE user_id = v_uid AND dispositivo_id IS NOT NULL
      AND (parcela_numero IS NULL OR parcela_numero = 1)
      AND observacoes IS DISTINCT FROM 'pagamento_duplo_secundario';
    v_avisos := v_avisos || jsonb_build_object('codigo', 'vendas_de_aparelhos', 'quantidade', v_cnt,
      'texto', CASE WHEN v_cnt > 0
                 THEN format('Apagar produtos e peças também apaga TODAS as vendas, inclusive as de aparelhos (%s venda(s) de aparelho).', v_cnt)
                 ELSE 'Apagar produtos e peças também apaga TODAS as vendas, inclusive as de aparelhos.' END);
    IF COALESCE((v_tab->>'compras_xml_mapeamento')::bigint, 0) > 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codigo', 'ligacoes_xml_apagadas',
        'quantidade', (v_tab->>'compras_xml_mapeamento')::bigint,
        'texto', format('%s ligação(ões) entre itens de notas XML e seus produtos e peças são apagadas: na próxima nota do mesmo fornecedor, escolha os produtos de novo.',
                        v_tab->>'compras_xml_mapeamento'));
    END IF;
  END IF;
  IF 'vendas' = ANY (v_ef) AND NOT 'estoque' = ANY (v_ef) THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'estoque_nao_volta', 'quantidade', NULL,
      'texto', CASE WHEN v_pp THEN 'Os aparelhos vendidos não voltam para o estoque.'
                    ELSE 'Os produtos e aparelhos vendidos não voltam para o estoque.' END);
    SELECT count(*) INTO v_cnt FROM public.dispositivo_imeis
      WHERE venda_id IN (SELECT id FROM public.vendas WHERE user_id = v_uid);
    IF v_cnt > 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codigo', 'imeis_sem_venda', 'quantidade', v_cnt,
        'texto', format('%s IMEI(s) de aparelhos vendidos perdem a ligação com a venda.', v_cnt));
    END IF;
  END IF;
  IF 'vendas' = ANY (v_ef) AND NOT 'financeiro' = ANY (v_ef) THEN
    SELECT count(*) INTO v_cnt FROM public.contas WHERE user_id = v_uid AND descricao LIKE 'venda_id:%';
    IF v_cnt > 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codigo', 'contas_de_vendas_ficam', 'quantidade', v_cnt,
        'texto', format('%s conta(s) a receber de vendas continuam no Financeiro, sem a venda.', v_cnt));
    END IF;
  END IF;
  IF 'vendas' = ANY (v_ef) AND NOT 'clientes' = ANY (v_ef) THEN
    SELECT count(*) INTO v_cnt FROM public.fidelidade_pontos WHERE user_id = v_uid AND tipo = 'venda';
    IF v_cnt > 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codigo', 'pontos_de_vendas_ficam', 'quantidade', v_cnt,
        'texto', format('%s lançamento(s) de pontos de fidelidade vindos de vendas continuam com os clientes.', v_cnt));
    END IF;
  END IF;
  IF 'os' = ANY (v_ef) AND NOT 'estoque' = ANY (v_ef) AND NOT v_pp THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'pecas_os_nao_voltam', 'quantidade', NULL,
      'texto', 'As peças usadas nas ordens de serviço não voltam para o estoque.');
  END IF;
  IF 'os' = ANY (v_ef) AND NOT 'financeiro' = ANY (v_ef) THEN
    SELECT count(*) INTO v_cnt FROM public.contas WHERE user_id = v_uid AND COALESCE(os_numero, '') <> '';
    IF v_cnt > 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codigo', 'contas_de_os_ficam', 'quantidade', v_cnt,
        'texto', format('%s conta(s) ligadas a ordens de serviço continuam no Financeiro.', v_cnt));
    END IF;
  END IF;
  IF 'os' = ANY (v_ef) AND NOT 'clientes' = ANY (v_ef) THEN
    SELECT count(*) INTO v_cnt FROM public.fidelidade_pontos WHERE user_id = v_uid AND tipo = 'os';
    IF v_cnt > 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codigo', 'pontos_de_os_ficam', 'quantidade', v_cnt,
        'texto', format('%s lançamento(s) de pontos de fidelidade vindos de OS continuam com os clientes.', v_cnt));
    END IF;
  END IF;
  IF COALESCE((v_desv->>'contas_sem_cliente')::bigint, 0) > 0 THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'contas_sem_cliente', 'quantidade', (v_desv->>'contas_sem_cliente')::bigint,
      'texto', format('%s conta(s) do Financeiro continuam, mas sem o nome do cliente.', v_desv->>'contas_sem_cliente'));
  END IF;
  IF COALESCE((v_desv->>'os_sem_fornecedor')::bigint, 0) > 0 THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'os_sem_fornecedor', 'quantidade', (v_desv->>'os_sem_fornecedor')::bigint,
      'texto', format('%s ordem(ns) de serviço continuam, mas sem o fornecedor do serviço terceirizado.', v_desv->>'os_sem_fornecedor'));
  END IF;
  IF COALESCE((v_desv->>'servicos_sem_peca')::bigint, 0) > 0 THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'servicos_sem_peca', 'quantidade', (v_desv->>'servicos_sem_peca')::bigint,
      'texto', format('%s serviço(s) cadastrados continuam, mas sem a peça ligada a eles.', v_desv->>'servicos_sem_peca'));
  END IF;
  IF COALESCE((v_desv->>'itens_xml_sem_produto')::bigint, 0) > 0 THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'itens_xml_sem_produto', 'quantidade', (v_desv->>'itens_xml_sem_produto')::bigint,
      'texto', format('%s item(ns) de notas XML continuam, mas sem o produto ou a peça ligada a eles.', v_desv->>'itens_xml_sem_produto'));
  END IF;
  IF COALESCE((v_desv->>'contas_sem_fornecedor')::bigint, 0) > 0 THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'contas_sem_fornecedor', 'quantidade', (v_desv->>'contas_sem_fornecedor')::bigint,
      'texto', format('%s conta(s) do Financeiro continuam, mas sem o fornecedor.', v_desv->>'contas_sem_fornecedor'));
  END IF;
  IF 'financeiro' = ANY (v_ef) AND NOT 'estoque' = ANY (v_ef) AND NOT v_pp THEN
    SELECT count(*) INTO v_cnt FROM public.entradas_estoque
      WHERE user_id = v_uid AND conta_id IN (SELECT id FROM public.contas WHERE user_id = v_uid);
    IF v_cnt > 0 THEN
      v_avisos := v_avisos || jsonb_build_object('codigo', 'entradas_sem_conta', 'quantidade', v_cnt,
        'texto', format('%s entrada(s) de estoque continuam, mas sem a conta a pagar da compra.', v_cnt));
    END IF;
  END IF;
  IF 'financeiro' = ANY (v_ef) AND NOT 'vendas' = ANY (v_ef) THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'vendas_sem_recebimento', 'quantidade', NULL,
      'texto', 'As vendas continuam, mas as contas a receber delas e os caixas somem do Financeiro.');
  END IF;
  IF 'os' = ANY (v_ef) THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'contador_os', 'quantidade', NULL,
      'texto', CASE WHEN v_os_zera THEN 'A próxima ordem de serviço volta a ser a nº 1.'
                    ELSE format('A numeração das OS continua: a próxima será a nº %s (ainda há contas citando números de OS).',
                                COALESCE(v_os_ult, 0) + 1) END);
  END IF;
  IF 'vendas' = ANY (v_ef) THEN
    v_avisos := v_avisos || jsonb_build_object('codigo', 'contador_venda', 'quantidade', NULL,
      'texto', 'A próxima venda volta a ser a nº 1.');
  END IF;

  -- Senha recente (amr do token) e intervalo mínimo entre execuções
  v_amr := auth.jwt()->'amr';
  v_login_ok := jsonb_typeof(v_amr) = 'array' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_amr) e
    WHERE e->>'method' = 'password' AND (e->>'timestamp') ~ '^[0-9]+$'
      AND to_timestamp((e->>'timestamp')::bigint) >= now() - interval '10 minutes');
  SELECT max(executado_em) INTO v_ultima FROM public.zerar_dados_execucoes WHERE user_id = v_uid;
  IF v_ultima IS NOT NULL AND v_ultima > now() - interval '10 minutes' THEN
    v_proxima := v_ultima + interval '10 minutes';
  END IF;

  RETURN CASE WHEN jsonb_array_length(v_absorvidas) > 0
              THEN jsonb_build_object('absorvidas', v_absorvidas) ELSE '{}'::jsonb END
  || jsonb_build_object(
    'pode_usar', true,
    'codigo', NULL,
    'motivo', NULL,
    'categorias_pedidas', to_jsonb(v_pedidas),
    'categorias_efetivas', to_jsonb(v_ef),
    'tudo', v_tudo,
    'incluidas_automaticamente', v_auto,
    'resumo', v_resumo,
    'tabelas', v_tab,
    'desvinculos', v_desv,
    'avisos', v_avisos,
    'contadores', jsonb_build_object(
      'os',    jsonb_build_object('volta_para_1', v_os_zera,
                 'proximo', CASE WHEN v_os_zera THEN 1 ELSE COALESCE(v_os_ult, 0) + 1 END),
      'venda', jsonb_build_object('volta_para_1', v_venda_zera,
                 'proximo', CASE WHEN v_venda_zera THEN 1 ELSE COALESCE(v_venda_ult, 0) + 1 END)),
    'reexibe_primeiros_passos', v_tudo,
    'login_recente', v_login_ok,
    'proxima_execucao_em', v_proxima,
    'impressao', md5(jsonb_build_object(
      'categorias', to_jsonb(v_ef), 'tudo', v_tudo, 'tabelas', v_tab, 'desvinculos', v_desv,
      'os_zera', v_os_zera, 'venda_zera', v_venda_zera)::text)
  );
END
$fn$;

REVOKE ALL ON FUNCTION public.zerar_meus_dados_previa(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zerar_meus_dados_previa(text[]) TO authenticated, service_role;


-- ---------------------------------------------------------------------
-- 2) EXECUÇÃO — apaga numa transação só (qualquer erro desfaz tudo)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zerar_meus_dados_executar(p_categorias text[], p_confirmacao text, p_impressao text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  c_buckets   constant text[] := ARRAY['dispositivos-fotos', 'produtos-fotos', 'compras-fotos',
                                       'compras-documentos', 'origem-documentos', 'termos-compra', 'notas-compra-xml'];
  c_url       constant text := '/storage/v1/object/(?:public|sign)/([a-z0-9_-]+)/([^"?\s\\,)]+)';
  -- "Produtos e peças": as mesmas tabelas da prévia e só o bucket das fotos de
  -- produtos e peças (aparelhos, compras e notas XML ficam, com os arquivos).
  c_tab_pp    constant text[] := ARRAY['public.entradas_estoque', 'public.compras_xml_mapeamento',
                                       'public.produtos', 'public.pecas'];
  c_buckets_pp constant text[] := ARRAY['produtos-fotos'];
  v_pp        boolean;
  v_buckets   text[];
  v_ign       text[];
  v_md5       text;
  v_mantidos  jsonb := '{}'::jsonb;
  v_inicio    timestamptz := clock_timestamp();
  v_uid       uuid := auth.uid();
  v_prev      jsonb;
  v_ef        text[];
  v_casar     text[];
  v_tudo      boolean;
  v_os        uuid[];
  v_cli       uuid[];
  v_exec      uuid;
  v_refs      text[] := '{}';
  v_tmp       text[];
  v_arquivos  int := 0;
  v_antes     jsonb := '{}'::jsonb;
  v_apagadas  jsonb := '{}'::jsonb;
  v_desv      jsonb := '{}'::jsonb;
  v_problemas text[] := '{}';
  v_cnt       bigint;
  v_n         bigint;
  v_os_zera   boolean;
  v_venda_zera boolean;
  v_onb       boolean := false;
  v_os_antes  int;
  v_venda_antes int;
  v_os_depois int;
  v_fantasmas jsonb := '{}'::jsonb;
  v_venda_depois int;
  r           record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login para continuar.' USING ERRCODE = 'ZD000';
  END IF;
  IF p_confirmacao IS DISTINCT FROM 'APAGAR' THEN
    RAISE EXCEPTION 'Digite APAGAR (em letras maiúsculas) para confirmar.' USING ERRCODE = 'ZD002';
  END IF;

  -- Uma execução por conta de cada vez (o 2º clique espera o 1º terminar)
  PERFORM pg_advisory_xact_lock(hashtextextended('zerar_meus_dados:' || v_uid::text, 0));

  v_prev := public.zerar_meus_dados_previa(p_categorias);
  IF NOT (v_prev->>'pode_usar')::boolean THEN
    RAISE EXCEPTION '%', v_prev->>'motivo' USING ERRCODE = 'ZD001';
  END IF;
  IF NOT (v_prev->>'login_recente')::boolean THEN
    RAISE EXCEPTION 'Por segurança, digite sua senha de novo antes de apagar.' USING ERRCODE = 'ZD003';
  END IF;
  IF v_prev->>'proxima_execucao_em' IS NOT NULL THEN
    RAISE EXCEPTION 'Você acabou de apagar dados. Aguarde alguns minutos para fazer de novo.' USING ERRCODE = 'ZD004';
  END IF;
  IF p_impressao IS DISTINCT FROM v_prev->>'impressao' THEN
    RAISE EXCEPTION 'Os números mudaram desde a revisão. Revise de novo antes de apagar.' USING ERRCODE = 'ZD005';
  END IF;

  v_ef := ARRAY(SELECT jsonb_array_elements_text(v_prev->'categorias_efetivas'));
  v_tudo := (v_prev->>'tudo')::boolean;
  v_casar := v_ef || CASE WHEN v_tudo THEN ARRAY['tudo'] ELSE '{}'::text[] END;
  v_pp := 'produtos_pecas' = ANY (v_ef);
  v_buckets := CASE WHEN v_pp AND NOT v_tudo AND NOT 'estoque' = ANY (v_ef) THEN c_buckets_pp ELSE c_buckets END;
  v_os_zera := (v_prev->'contadores'->'os'->>'volta_para_1')::boolean;
  v_venda_zera := (v_prev->'contadores'->'venda'->>'volta_para_1')::boolean;
  v_os  := ARRAY(SELECT id FROM public.ordens_servico WHERE user_id = v_uid);
  v_cli := ARRAY(SELECT id FROM public.clientes WHERE user_id = v_uid);

  INSERT INTO public.zerar_dados_execucoes (user_id, categorias_pedidas, categorias_efetivas)
  VALUES (v_uid, ARRAY(SELECT jsonb_array_elements_text(v_prev->'categorias_pedidas')), v_ef)
  RETURNING id INTO v_exec;

  -- Fantasmas da cota (etapa 3a): uma linha por item que CONTAVA na cota do
  -- plano, com a data de criação original, antes de apagar. Mesma regra do app
  -- (useAssinatura / useServicosAvulsos): OS fora da lixeira e sem a marca dos
  -- Primeiros Passos; aparelhos, produtos, peças e serviços avulsos todos.
  IF 'os' = ANY (v_ef) THEN
    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)
    SELECT v_uid, 'os', created_at, v_exec FROM public.ordens_servico
     WHERE user_id = v_uid AND deleted_at IS NULL AND nao_conta_limite = false;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_fantasmas := v_fantasmas || jsonb_build_object('os', v_n);
  END IF;
  IF 'estoque' = ANY (v_ef) THEN
    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)
    SELECT v_uid, 'dispositivo', created_at, v_exec FROM public.dispositivos WHERE user_id = v_uid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_fantasmas := v_fantasmas || jsonb_build_object('dispositivo', v_n);
    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)
    SELECT v_uid, 'produto', created_at, v_exec FROM public.produtos WHERE user_id = v_uid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_fantasmas := v_fantasmas || jsonb_build_object('produto', v_n);
    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)
    SELECT v_uid, 'peca', created_at, v_exec FROM public.pecas WHERE user_id = v_uid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_fantasmas := v_fantasmas || jsonb_build_object('peca', v_n);
  END IF;
  IF v_pp THEN
    -- Só produtos e peças: os aparelhos continuam (e contam na cota por si).
    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)
    SELECT v_uid, 'produto', created_at, v_exec FROM public.produtos WHERE user_id = v_uid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_fantasmas := v_fantasmas || jsonb_build_object('produto', v_n);
    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)
    SELECT v_uid, 'peca', created_at, v_exec FROM public.pecas WHERE user_id = v_uid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_fantasmas := v_fantasmas || jsonb_build_object('peca', v_n);
  END IF;
  IF 'vendas' = ANY (v_ef) THEN
    INSERT INTO public.cota_registros_apagados (user_id, tipo, criado_em, execucao_id)
    SELECT v_uid, 'servico_avulso', created_at, v_exec FROM public.servicos_avulsos WHERE user_id = v_uid;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_fantasmas := v_fantasmas || jsonb_build_object('servico_avulso', v_n);
  END IF;

  -- Fila de fotos: URLs citadas nas linhas que vão ser apagadas (antes de apagar).
  -- Os históricos (audit) ficam de fora: repetem as mesmas URLs das OS/clientes.
  FOR r IN
    SELECT c.tabela, c.filtro FROM public._zerar_catalogo() c
    WHERE c.lista = 'APAGAR' AND (c.categoria = ANY (v_casar) OR (v_pp AND c.tabela = ANY (c_tab_pp))) AND to_regclass(c.tabela) IS NOT NULL
      AND c.tabela NOT IN ('public.os_audit_log', 'public.clientes_audit_log')
  LOOP
    EXECUTE format('SELECT array_agg(DISTINCT m[1] || chr(31) || m[2]) FROM %s x, regexp_matches(x::text, $4, ''g'') m WHERE %s',
                   r.tabela, r.filtro)
      INTO v_tmp USING v_uid, v_os, v_cli, c_url;
    v_refs := v_refs || COALESCE(v_tmp, '{}');
  END LOOP;
  IF to_regclass('storage.objects') IS NOT NULL THEN
    INSERT INTO public.zerar_dados_arquivos (execucao_id, bucket, caminho, motivo)
    SELECT v_exec, o.bucket_id, o.name, string_agg(DISTINCT x.motivo, ' + ' ORDER BY x.motivo)
    FROM storage.objects o
    JOIN (
      SELECT split_part(u, chr(31), 1) AS b, split_part(u, chr(31), 2) AS n, 'citado nos dados apagados' AS motivo
      FROM unnest(v_refs) u
      UNION ALL
      SELECT split_part(u, chr(31), 1),
             regexp_replace(split_part(u, chr(31), 2), '(^|/)(v2-[^/]*)\.([A-Za-z0-9]+)$', '\1\2_thumb.\3'),
             'miniatura'
      FROM unnest(v_refs) u
      WHERE split_part(u, chr(31), 2) ~ '(^|/)v2-[^/]*\.[A-Za-z0-9]+$'
      UNION ALL
      SELECT o2.bucket_id, o2.name, 'pasta do lojista'
      FROM storage.objects o2
      WHERE v_tudo AND o2.name LIKE v_uid::text || '/%' AND o2.bucket_id = ANY (v_buckets)
    ) x ON x.b = o.bucket_id AND x.n = o.name
    WHERE o.bucket_id = ANY (v_buckets)
    GROUP BY o.bucket_id, o.name;
    GET DIAGNOSTICS v_arquivos = ROW_COUNT;
  END IF;

  -- Contagens ANTES (tudo que é do dono)
  FOR r IN
    SELECT c.tabela, c.filtro FROM public._zerar_catalogo() c
    WHERE c.lista IN ('APAGAR', 'MANTER') AND to_regclass(c.tabela) IS NOT NULL
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %s', r.tabela, r.filtro) INTO v_cnt USING v_uid, v_os, v_cli;
    v_antes := v_antes || jsonb_build_object(r.tabela, v_cnt);
  END LOOP;
  SELECT ultimo_numero INTO v_os_antes FROM public.user_os_counters WHERE user_id = v_uid;
  SELECT ultimo_numero INTO v_venda_antes FROM public.user_venda_counters WHERE user_id = v_uid;
  -- Produtos e peças: o resto do Estoque (aparelhos, IMEIs, compras, fornecedores,
  -- listas, notas XML) tem que ficar IGUAL, linha a linha. Fora da comparação só
  -- as ligações com o que é apagado nesta execução (viram NULL) e updated_at.
  IF v_pp THEN
    FOR r IN
      SELECT c.tabela, c.filtro FROM public._zerar_catalogo() c
      WHERE c.lista = 'APAGAR' AND c.categoria = 'estoque' AND NOT c.tabela = ANY (c_tab_pp)
        AND to_regclass(c.tabela) IS NOT NULL
    LOOP
      v_ign := ARRAY['updated_at'] || ARRAY(
        SELECT a.attname::text FROM pg_constraint con
        JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
        WHERE con.contype = 'f' AND con.conrelid = to_regclass(r.tabela)
          AND con.confrelid IN (SELECT to_regclass(c2.tabela) FROM public._zerar_catalogo() c2
                                WHERE c2.lista = 'APAGAR' AND to_regclass(c2.tabela) IS NOT NULL
                                  AND (c2.categoria = ANY (v_casar) OR c2.tabela = ANY (c_tab_pp))));
      EXECUTE format('SELECT md5(COALESCE(string_agg(t, chr(10) ORDER BY t), '''')) FROM (SELECT (to_jsonb(x) - $4)::text AS t FROM %s x WHERE %s) s',
                     r.tabela, r.filtro)
        INTO v_md5 USING v_uid, v_os, v_cli, v_ign;
      v_mantidos := v_mantidos || jsonb_build_object(r.tabela, jsonb_build_object('md5', v_md5, 'ignorar', to_jsonb(v_ign)));
    END LOOP;
  END IF;

  -- Ligações desfeitas (as mesmas que a prévia contou)
  IF 'clientes' = ANY (v_ef) AND NOT 'financeiro' = ANY (v_ef) THEN
    UPDATE public.contas SET cliente_id = NULL WHERE user_id = v_uid AND cliente_id = ANY (v_cli);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_desv := v_desv || jsonb_build_object('contas_sem_cliente', v_n);
  END IF;
  IF 'estoque' = ANY (v_ef) THEN
    IF NOT 'os' = ANY (v_ef) THEN
      UPDATE public.ordens_servico SET servico_fornecedor_id = NULL
       WHERE user_id = v_uid AND servico_fornecedor_id IN (SELECT id FROM public.fornecedores WHERE user_id = v_uid);
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_desv := v_desv || jsonb_build_object('os_sem_fornecedor', v_n);
    END IF;
    UPDATE public.servicos SET peca_id = NULL
     WHERE user_id = v_uid AND peca_id IN (SELECT id FROM public.pecas WHERE user_id = v_uid);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_desv := v_desv || jsonb_build_object('servicos_sem_peca', v_n);
    IF NOT 'financeiro' = ANY (v_ef) THEN
      UPDATE public.contas SET fornecedor_id = NULL
       WHERE user_id = v_uid AND fornecedor_id IN (SELECT id FROM public.fornecedores WHERE user_id = v_uid);
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_desv := v_desv || jsonb_build_object('contas_sem_fornecedor', v_n);
    END IF;
  END IF;

  IF v_pp THEN
    UPDATE public.servicos SET peca_id = NULL
     WHERE user_id = v_uid AND peca_id IN (SELECT id FROM public.pecas WHERE user_id = v_uid);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_desv := v_desv || jsonb_build_object('servicos_sem_peca', v_n);
    UPDATE public.compras_xml_itens SET
      produto_id = CASE WHEN produto_id IN (SELECT id FROM public.produtos WHERE user_id = v_uid) THEN NULL ELSE produto_id END,
      peca_id = CASE WHEN peca_id IN (SELECT id FROM public.pecas WHERE user_id = v_uid) THEN NULL ELSE peca_id END,
      entrada_estoque_id = CASE WHEN entrada_estoque_id IN (SELECT id FROM public.entradas_estoque WHERE user_id = v_uid)
                                THEN NULL ELSE entrada_estoque_id END
     WHERE importacao_id IN (SELECT id FROM public.compras_xml_importadas WHERE user_id = v_uid)
       AND (produto_id IN (SELECT id FROM public.produtos WHERE user_id = v_uid)
            OR peca_id IN (SELECT id FROM public.pecas WHERE user_id = v_uid)
            OR entrada_estoque_id IN (SELECT id FROM public.entradas_estoque WHERE user_id = v_uid));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_desv := v_desv || jsonb_build_object('itens_xml_sem_produto', v_n);
  END IF;

  -- Exclusão na ordem do catálogo (filhas antes das mães)
  FOR r IN
    SELECT c.tabela, c.filtro FROM public._zerar_catalogo() c
    WHERE c.lista = 'APAGAR' AND (c.categoria = ANY (v_casar) OR (v_pp AND c.tabela = ANY (c_tab_pp))) AND to_regclass(c.tabela) IS NOT NULL
    ORDER BY c.ordem
  LOOP
    EXECUTE format('DELETE FROM %s WHERE %s', r.tabela, r.filtro) USING v_uid, v_os, v_cli;
    v_apagadas := v_apagadas || jsonb_build_object(replace(r.tabela, 'public.', ''), (v_antes->>r.tabela)::bigint);
  END LOOP;

  -- Primeiros Passos
  IF 'clientes' = ANY (v_ef) THEN
    UPDATE public.user_onboarding SET primeiro_cliente_id = NULL
     WHERE user_id = v_uid AND primeiro_cliente_id IS NOT NULL;
  END IF;
  IF v_tudo THEN
    UPDATE public.user_onboarding SET onboarding_dismissed = false, onboarding_dismissed_at = NULL
     WHERE user_id = v_uid;
    v_onb := FOUND;
  END IF;

  -- Contadores (regra b)
  IF v_venda_zera THEN
    UPDATE public.user_venda_counters SET ultimo_numero = 0, updated_at = now() WHERE user_id = v_uid;
  END IF;
  IF v_os_zera THEN
    UPDATE public.user_os_counters SET ultimo_numero = 0, updated_at = now() WHERE user_id = v_uid;
  END IF;

  -- Conferência: o marcado ficou em 0; o resto não perdeu nenhuma linha.
  -- "Não diminuiu" (e não "igual"): o sistema grava sozinho em algumas tabelas
  -- que ficam (user_events, notificações) e isso não pode desfazer tudo à toa.
  FOR r IN
    SELECT c.lista, c.categoria, c.tabela, c.filtro FROM public._zerar_catalogo() c
    WHERE c.lista IN ('APAGAR', 'MANTER') AND to_regclass(c.tabela) IS NOT NULL
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %s', r.tabela, r.filtro) INTO v_cnt USING v_uid, v_os, v_cli;
    IF r.lista = 'APAGAR' AND (r.categoria = ANY (v_casar) OR (v_pp AND r.tabela = ANY (c_tab_pp))) THEN
      IF v_cnt <> 0 THEN
        v_problemas := v_problemas || format('%s ainda tem %s linha(s)', r.tabela, v_cnt);
      END IF;
    ELSIF v_cnt < (v_antes->>r.tabela)::bigint THEN
      v_problemas := v_problemas || format('%s devia ficar com %s e ficou com %s linha(s)',
                                           r.tabela, v_antes->>r.tabela, v_cnt);
    END IF;
  END LOOP;
  FOR r IN
    SELECT c.tabela, c.filtro FROM public._zerar_catalogo() c
    WHERE v_mantidos ? c.tabela
  LOOP
    EXECUTE format('SELECT md5(COALESCE(string_agg(t, chr(10) ORDER BY t), '''')) FROM (SELECT (to_jsonb(x) - $4)::text AS t FROM %s x WHERE %s) s',
                   r.tabela, r.filtro)
      INTO v_md5 USING v_uid, v_os, v_cli, ARRAY(SELECT jsonb_array_elements_text(v_mantidos->r.tabela->'ignorar'));
    IF v_md5 IS DISTINCT FROM v_mantidos->r.tabela->>'md5' THEN
      v_problemas := v_problemas || format('%s mudou (devia ficar igual)', r.tabela);
    END IF;
  END LOOP;
  SELECT ultimo_numero INTO v_os_depois FROM public.user_os_counters WHERE user_id = v_uid;
  SELECT ultimo_numero INTO v_venda_depois FROM public.user_venda_counters WHERE user_id = v_uid;
  IF v_os_zera AND COALESCE(v_os_depois, 0) <> 0 THEN
    v_problemas := v_problemas || 'contador de OS não zerou'::text;
  ELSIF NOT v_os_zera AND v_os_depois IS DISTINCT FROM v_os_antes THEN
    v_problemas := v_problemas || 'contador de OS mudou sem poder'::text;
  END IF;
  IF v_venda_zera AND COALESCE(v_venda_depois, 0) <> 0 THEN
    v_problemas := v_problemas || 'contador de vendas não zerou'::text;
  ELSIF NOT v_venda_zera AND v_venda_depois IS DISTINCT FROM v_venda_antes THEN
    v_problemas := v_problemas || 'contador de vendas mudou sem poder'::text;
  END IF;
  IF v_os_zera AND EXISTS (SELECT 1 FROM public.contas WHERE user_id = v_uid AND COALESCE(os_numero, '') <> '') THEN
    v_problemas := v_problemas || 'contador de OS zerado com contas citando OS'::text;
  END IF;
  IF v_desv IS DISTINCT FROM v_prev->'desvinculos' THEN
    v_problemas := v_problemas || format('ligações desfeitas (%s) diferentes da prévia (%s)', v_desv, v_prev->'desvinculos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid) THEN
    v_problemas := v_problemas || 'login sumiu'::text;
  END IF;

  IF cardinality(v_problemas) > 0 THEN
    RAISE EXCEPTION 'A conferência final não bateu. Nada foi apagado.'
      USING ERRCODE = 'ZD006', DETAIL = array_to_string(v_problemas, '; ');
  END IF;

  UPDATE public.zerar_dados_execucoes SET
    quantidades = v_apagadas,
    desvinculos = v_desv,
    contador_os_zerado = v_os_zera,
    contador_venda_zerado = v_venda_zera,
    onboarding_reexibido = v_onb,
    arquivos_na_fila = v_arquivos,
    storage_status = CASE WHEN v_arquivos = 0 THEN 'sem_arquivos' ELSE 'pendente' END,
    duracao_ms = (extract(epoch FROM clock_timestamp() - v_inicio) * 1000)::int
  WHERE id = v_exec;

  RETURN jsonb_build_object(
    'execucao_id', v_exec,
    'categorias_efetivas', to_jsonb(v_ef),
    'apagados', v_apagadas,
    'desvinculos', v_desv,
    'contador_os_zerado', v_os_zera,
    'contador_venda_zerado', v_venda_zera,
    'onboarding_reexibido', v_onb,
    'arquivos_na_fila', v_arquivos,
    'fantasmas_cota', v_fantasmas
  );
END
$fn$;

REVOKE ALL ON FUNCTION public.zerar_meus_dados_executar(text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zerar_meus_dados_executar(text[], text, text) TO authenticated, service_role;

COMMIT;
