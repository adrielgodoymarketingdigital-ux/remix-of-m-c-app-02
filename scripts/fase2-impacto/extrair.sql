-- FASE 2 — Extração (SOMENTE LEITURA). Mede R1, R2, R4 e o delta
-- "Comissões a Pagar hoje (Sistema A) vs pós-Fase-2 (snapshot)".
--
-- Retorna 1 linha, coluna `data` (jsonb) com 5 chaves:
--   funcionarios          — todos os loja_funcionarios + flag tem_config_tipo_servico
--   comissoes_tipo_servico — linhas de config por (funcionario, tipo)
--   os                    — OS ENTREGUES dos últimos 6 meses que importam p/ comissão
--   os_tecnicos           — linhas de os_tecnicos dessas OS
--   vendas                — vendas dos últimos 3 meses com funcionario_id
--
-- COMO RODAR:
--   node scripts/fase2-impacto/analisar.mjs
--   (roda `supabase db query --linked -f scripts/fase2-impacto/extrair.sql` sozinho)

select jsonb_build_object(

  'funcionarios', (
    select coalesce(jsonb_agg(row_to_json(f)::jsonb), '[]'::jsonb) from (
      select
        lf.id                                        as id,
        lf.loja_user_id                              as owner_user_id,
        coalesce(p.email, lf.loja_user_id::text)     as owner_email,
        lf.nome                                      as nome,
        lf.ativo                                     as ativo,
        lf.cargo                                     as cargo,
        lf.comissao_tipo                             as comissao_tipo,
        lf.comissao_valor                            as comissao_valor,
        lf.comissao_escopo                           as comissao_escopo,
        lf.comissoes_por_cargo                       as comissoes_por_cargo,
        coalesce(lf.base_comissao, 'criacao')        as base_comissao,
        coalesce(lf.comissao_calculo, 'faturamento') as comissao_calculo,
        exists (select 1 from comissoes_tipo_servico c where c.funcionario_id = lf.id) as tem_config_tipo_servico
      from loja_funcionarios lf
      left join profiles p on p.user_id = lf.loja_user_id
    ) f
  ),

  'comissoes_tipo_servico', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'funcionario_id', c.funcionario_id,
      'tipo_servico_id', c.tipo_servico_id,
      'comissao_tipo', c.comissao_tipo,
      'comissao_valor', c.comissao_valor
    )), '[]'::jsonb)
    from comissoes_tipo_servico c
  ),

  'os', (
    select coalesce(jsonb_agg(row_to_json(o)::jsonb), '[]'::jsonb) from (
      select
        os.id                            as id,
        os.user_id                       as owner_user_id,
        os.funcionario_id                as funcionario_id,
        os.status                        as status,
        os.created_at                    as created_at,
        os.data_saida                    as data_saida,
        os.total                         as total,
        os.is_teste                      as is_teste,
        os.comissao_calculada_snapshot   as comissao_calculada_snapshot,
        os.tipo_servico_id               as tipo_servico_id
      from ordens_servico os
      where os.deleted_at is null
        and lower(trim(os.status)) = 'entregue'
        and (os.created_at >= now() - interval '6 months'
             or os.data_saida >= now() - interval '6 months')
        and (os.funcionario_id is not null
             or exists (select 1 from os_tecnicos ot where ot.os_id = os.id))
    ) o
  ),

  'os_tecnicos', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'os_id', ot.os_id,
      'funcionario_id', ot.funcionario_id,
      'comissao_calculada_snapshot', ot.comissao_calculada_snapshot
    )), '[]'::jsonb)
    from os_tecnicos ot
    where exists (
      select 1 from ordens_servico os
      where os.id = ot.os_id
        and os.deleted_at is null
        and lower(trim(os.status)) = 'entregue'
        and (os.created_at >= now() - interval '6 months'
             or os.data_saida >= now() - interval '6 months')
    )
  ),

  'vendas', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'funcionario_id', v.funcionario_id,
      'total', v.total,
      'tipo', v.tipo,
      'data', v.data
    )), '[]'::jsonb)
    from vendas v
    where v.cancelada = false
      and (v.observacoes is null or v.observacoes <> 'pagamento_duplo_secundario')
      and v.data >= now() - interval '3 months'
      and v.funcionario_id is not null
  )

) as data;
