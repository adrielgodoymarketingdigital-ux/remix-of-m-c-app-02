-- =============================================================================
-- DIAGNÓSTICO — "lucro diminui ao fazer vendas"
-- Conta relatora: livio.bruno14@gmail.com
--
-- SOMENTE LEITURA. Rodar inteiro no SQL Editor do Supabase.
-- Resolve sozinho o user_id pelo e-mail. Retorna UMA tabela com coluna "secao".
--
-- Reproduz a fórmula de lucro do app:
--   receita_liquida = total - valor_desconto_manual - valor_desconto_cupom
--   custo_total     = custo_unitario * quantidade
--   lucro           = receita_liquida - custo_total
-- (mesma lógica de getVendaReceitaLiquida / getVendaCustoTotal em
--  src/lib/vendasFinanceiras.ts e do agregado em useRelatorios.calcularResumo)
-- =============================================================================

with
u as (
  select id as user_id from auth.users where email = 'livio.bruno14@gmail.com'
),
-- vendas "contáveis" no lucro, mesmas exclusões do app:
--  - canceladas fora
--  - deletadas fora
--  - itens de OS fora (peca_id, ou observacao "utilizado na OS")
--  - registro auxiliar de pagamento duplo fora
--  - a_receber/a_prazo só contam quando recebido = true
--  - outras formas: ignora parcelas subsequentes (parcela_numero > 1)
v_base as (
  select
    v.*,
    (coalesce(v.total,0) - coalesce(v.valor_desconto_manual,0) - coalesce(v.valor_desconto_cupom,0)) as receita_liq,
    (coalesce(v.custo_unitario,0) * coalesce(v.quantidade,1))                                        as custo_total,
    p.nome  as prod_nome,  p.custo as prod_custo,  p.preco as prod_preco,
    d.marca as disp_marca, d.modelo as disp_modelo, d.custo as disp_custo, d.preco as disp_preco
  from vendas v
  join u on u.user_id = v.user_id
  left join produtos p    on p.id = v.produto_id
  left join dispositivos d on d.id = v.dispositivo_id
  where v.deleted_at is null
),
v_contavel as (
  select * from v_base
  where coalesce(cancelada,false) = false
    and peca_id is null
    and coalesce(observacoes,'') not ilike '%utilizado na OS%'
    and coalesce(observacoes,'') <> 'pagamento_duplo_secundario'
    and tipo in ('produto','dispositivo')
    and (
      (forma_pagamento in ('a_receber','a_prazo') and recebido = true)
      or (forma_pagamento not in ('a_receber','a_prazo') and coalesce(parcela_numero,1) = 1)
    )
)

-- ---------------------------------------------------------------------------
select * from (

  -- (1) user_id ------------------------------------------------------------
  select 1 as ord, '1_user' as secao,
         'user_id'::text as k,
         (select user_id::text from u) as v1,
         'livio.bruno14@gmail.com'::text as v2,
         null::text as v3, null::text as v4, null::text as v5,
         null::text as v6, null::text as v7, null::text as v8

  -- (2) VENDAS DOS ÚLTIMOS 45 DIAS, linha a linha, com lucro esperado ------
  union all
  select 2, '2_vendas_recentes',
         (to_char(coalesce(vb.data_recebimento, vb.data)::timestamptz,'YYYY-MM-DD')
           || ' ' || coalesce(vb.numero_venda, left(vb.id::text,8)))::text,
         (vb.tipo || ' / ' || vb.forma_pagamento
           || case when coalesce(vb.cancelada,false) then '  [CANCELADA]' else '' end
           || case when vb.recebido = false then '  [nao recebido]' else '' end)::text,
         ('qtd=' || coalesce(vb.quantidade,1)
           || '  total=' || coalesce(vb.total,0)
           || '  descM=' || coalesce(vb.valor_desconto_manual,0)
           || '  descC=' || coalesce(vb.valor_desconto_cupom,0))::text,
         ('custo_unit=' || coalesce(vb.custo_unitario,0)
           || '  custo_total=' || vb.custo_total)::text,
         ('receita_liq=' || vb.receita_liq
           || '  LUCRO_LINHA=' || (vb.receita_liq - vb.custo_total))::text,
         ('cadastro: ' || coalesce(vb.prod_nome, nullif(trim(coalesce(vb.disp_marca,'')||' '||coalesce(vb.disp_modelo,'')),''), left(coalesce(vb.observacoes,'?'),30))
           || '  custo=' || coalesce(vb.prod_custo, vb.disp_custo)
           || '  preco=' || coalesce(vb.prod_preco, vb.disp_preco))::text,
         ('parc=' || coalesce(vb.parcela_numero::text,'-') || '/' || coalesce(vb.total_parcelas::text,'-')
           || '  grupo=' || coalesce(left(vb.grupo_venda::text,8),'-')
           || '  2a_forma=' || coalesce(vb.segunda_forma_pagamento,'-') || ' ' || coalesce(vb.valor_segunda_forma::text,''))::text,
         (
           case when coalesce(vb.total,0) <= 0 then 'TOTAL<=0; ' else '' end ||
           case when coalesce(vb.quantidade,1) > 0 and coalesce(vb.total,0) > 0
                     and coalesce(vb.custo_unitario,0) > (coalesce(vb.total,0)/coalesce(vb.quantidade,1))
                then 'CUSTO_UNIT>PRECO_UNIT (prejuizo na linha); ' else '' end ||
           case when coalesce(vb.custo_unitario,0) = 0 and coalesce(vb.prod_custo, vb.disp_custo, 0) > 0
                then 'custo_unit=0 mas cadastro tem custo; ' else '' end ||
           case when coalesce(vb.prod_preco, vb.disp_preco, 0) > 0
                     and coalesce(vb.prod_custo, vb.disp_custo, 0) >= coalesce(vb.prod_preco, vb.disp_preco, 0)
                then 'CADASTRO custo>=preco (dado ruim); ' else '' end ||
           case when vb.peca_id is not null or coalesce(vb.observacoes,'') ilike '%utilizado na OS%'
                then 'ITEM DE OS (ignorado no lucro agregado); ' else '' end ||
           case when coalesce(vb.observacoes,'') = 'pagamento_duplo_secundario'
                then 'PAG_DUPLO_SECUNDARIO (ignorado); ' else '' end
         )::text,
         ('obs=' || left(coalesce(vb.observacoes,''),44))::text
  from v_base vb
  where coalesce(vb.data_recebimento, vb.data)::timestamptz >= (current_date - 45)

  -- (3) AGREGADO DO PERÍODO (reproduz o card "Lucro Bruto") ---------------
  union all
  select 3, '3_agregado', escopo,
         ('n_vendas=' || cnt)::text,
         ('receita_liq=' || round(rec::numeric,2))::text,
         ('custo_total=' || round(cus::numeric,2))::text,
         ('LUCRO=' || round((rec - cus)::numeric,2))::text,
         null, null, null, null
  from (
    select 'mes_atual (produto+dispositivo)'::text as escopo,
           count(*) cnt, coalesce(sum(receita_liq),0) rec, coalesce(sum(custo_total),0) cus
    from v_contavel
    where coalesce(data_recebimento, data)::timestamptz >= date_trunc('month', current_date)
    union all
    select 'ultimos_30d (produto+dispositivo)',
           count(*), coalesce(sum(receita_liq),0), coalesce(sum(custo_total),0)
    from v_contavel
    where coalesce(data_recebimento, data)::timestamptz >= (current_date - 30)
    union all
    select 'mes_atual — só tipo=produto',
           count(*), coalesce(sum(receita_liq),0), coalesce(sum(custo_total),0)
    from v_contavel
    where tipo = 'produto'
      and coalesce(data_recebimento, data)::timestamptz >= date_trunc('month', current_date)
    union all
    select 'mes_atual — só tipo=dispositivo',
           count(*), coalesce(sum(receita_liq),0), coalesce(sum(custo_total),0)
    from v_contavel
    where tipo = 'dispositivo'
      and coalesce(data_recebimento, data)::timestamptz >= date_trunc('month', current_date)
  ) agg

  -- (4) PRODUTOS/DISPOSITIVOS COM CADASTRO RUIM (custo >= preco) ----------
  union all
  select 4, '4_cadastro_custo>=preco',
         ('produto: ' || p.nome)::text,
         ('custo=' || p.custo || '  preco=' || p.preco)::text,
         ('estoque=' || coalesce(p.quantidade,0))::text,
         ('vendas_dessa_linha=' || (select count(*) from vendas vv where vv.produto_id = p.id and coalesce(vv.cancelada,false)=false))::text,
         null, null, null, null, null
  from produtos p join u on u.user_id = p.user_id
  where coalesce(p.preco,0) > 0 and coalesce(p.custo,0) >= coalesce(p.preco,0)
  union all
  select 4, '4_cadastro_custo>=preco',
         ('dispositivo: ' || coalesce(d.marca,'') || ' ' || coalesce(d.modelo,''))::text,
         ('custo=' || d.custo || '  preco=' || d.preco)::text,
         null, null, null, null, null, null, null
  from dispositivos d join u on u.user_id = d.user_id
  where coalesce(d.preco,0) > 0 and coalesce(d.custo,0) >= coalesce(d.preco,0)

  -- (5) VENDAS COM PREJUÍZO NA LINHA (piores primeiro, últimos 90 dias) ---
  union all
  select 5, '5_vendas_prejuizo',
         (to_char(coalesce(vc.data_recebimento, vc.data)::timestamptz,'YYYY-MM-DD') || ' ' || coalesce(vc.numero_venda,left(vc.id::text,8)))::text,
         (vc.tipo || ' ' || coalesce(vc.prod_nome, trim(coalesce(vc.disp_marca,'')||' '||coalesce(vc.disp_modelo,'')), left(coalesce(vc.observacoes,''),24)))::text,
         ('receita_liq=' || vc.receita_liq || '  custo_total=' || vc.custo_total)::text,
         ('LUCRO_LINHA=' || (vc.receita_liq - vc.custo_total))::text,
         null, null, null, null, null
  from v_contavel vc
  where coalesce(vc.data_recebimento, vc.data)::timestamptz >= (current_date - 90)
    and (vc.receita_liq - vc.custo_total) < 0
  order by ord, k

) x

union all

-- (6) MESMO AGREGADO (mês atual) EM OUTRAS CONTAS — teste estrutural ------
select 6, '6_cross_conta', conta,
       ('n_vendas=' || cnt)::text,
       ('receita_liq=' || round(rec::numeric,2))::text,
       ('custo_total=' || round(cus::numeric,2))::text,
       ('LUCRO=' || round((rec - cus)::numeric,2))::text,
       null, null, null, null
from (
  select au.email::text as conta,
         count(*) cnt,
         coalesce(sum(coalesce(vv.total,0) - coalesce(vv.valor_desconto_manual,0) - coalesce(vv.valor_desconto_cupom,0)),0) rec,
         coalesce(sum(coalesce(vv.custo_unitario,0) * coalesce(vv.quantidade,1)),0) cus
  from auth.users au
  join vendas vv on vv.user_id = au.id
  where au.email in ('glaucio.reis@hotmail.com','ifixproararasoficial@gmail.com')
    and vv.deleted_at is null
    and coalesce(vv.cancelada,false) = false
    and vv.peca_id is null
    and coalesce(vv.observacoes,'') not ilike '%utilizado na OS%'
    and coalesce(vv.observacoes,'') <> 'pagamento_duplo_secundario'
    and vv.tipo in ('produto','dispositivo')
    and (
      (vv.forma_pagamento in ('a_receber','a_prazo') and vv.recebido = true)
      or (vv.forma_pagamento not in ('a_receber','a_prazo') and coalesce(vv.parcela_numero,1) = 1)
    )
    and coalesce(vv.data_recebimento, vv.data)::timestamptz >= date_trunc('month', current_date)
  group by au.email
) cross_agg

union all

-- (7) TAXAS DE CARTÃO no mês (entram como CUSTO em calcularResumo) --------
select 7, '7_taxas_cartao_mes', 'contas categoria=Taxa de Cartão (pago, mês atual)'::text,
       ('n=' || count(*))::text,
       ('total=' || coalesce(sum(c.valor),0))::text,
       null, null, null, null, null, null
from contas c join u on u.user_id = c.user_id
where c.tipo = 'pagar' and c.status = 'pago' and c.categoria = 'Taxa de Cartão'
  and c.data::timestamptz >= date_trunc('month', current_date)

order by ord, secao, k nulls first;
