-- FASE 1 — Extração (SOMENTE LEITURA) para medir o impacto da mudança de
-- comportamento em OS de 1 serviço só.
--
-- Retorna 1 linha por OS candidata:
--   * criada nos últimos 60 dias, não deletada
--   * exatamente 1 serviço em avarias.servicos_realizados
--   * técnico responsável (funcionario_id) tem pelo menos 1 linha em
--     comissoes_tipo_servico (ou seja, usa "Comissão por Tipo de Serviço")
--
-- Junto vem tudo que analisar.mjs precisa para simular os DOIS comportamentos
-- (antigo = dropdown da Etapa 4; novo = match por nome, item a item), usando a
-- MESMA lógica de comissaoPorTipoServico.ts.
--
-- COMO RODAR (escolha um):
--   A) node scripts/fase1-impacto/analisar.mjs
--      (ele roda `supabase db query --linked -f scripts/fase1-impacto/extrair.sql`
--       sozinho e já faz a análise)
--   B) supabase db query --linked -f scripts/fase1-impacto/extrair.sql > scripts/fase1-impacto/raw.json
--      depois: node scripts/fase1-impacto/analisar.mjs scripts/fase1-impacto/raw.json
--   C) SQL Editor do Supabase → cole este arquivo → rode → salve o resultado
--      da coluna `data` como scripts/fase1-impacto/raw.json → analisar.mjs raw.json

select jsonb_agg(row_to_json(x)::jsonb) as data
from (
  select
    os.id                                            as os_id,
    os.numero_os                                     as numero_os,
    os.created_at                                    as created_at,
    os.user_id                                       as owner_user_id,
    coalesce(p.email, os.user_id::text)              as owner_email,
    os.funcionario_id                                as funcionario_id,
    lf.nome                                          as funcionario_nome,
    coalesce(lf.comissao_calculo, 'faturamento')     as comissao_calculo,
    os.tipo_servico_id                               as tipo_servico_id_etapa4,
    os.dispositivo_marca                             as dispositivo_marca,
    os.total                                         as total_os,
    os.is_teste                                      as is_teste,
    os.status                                        as status,
    os.comissao_calculada_snapshot                   as stored_snapshot,
    os.comissao_tipo_snapshot                        as stored_tipo_snapshot,
    os.comissao_valor_snapshot                       as stored_valor_snapshot,
    (os.avarias->'servicos_realizados'->0)           as servico,
    exists (select 1 from os_tecnicos ot where ot.os_id = os.id) as has_os_tecnicos,
    (
      select jsonb_agg(jsonb_build_object(
        'tipo_servico_id', c.tipo_servico_id,
        'nome',            ts.nome,
        'comissao_tipo',   c.comissao_tipo,
        'comissao_valor',  c.comissao_valor
      ))
      from comissoes_tipo_servico c
      join tipos_servico ts on ts.id = c.tipo_servico_id
      where c.funcionario_id = os.funcionario_id
    )                                                as func_configs
  from ordens_servico os
  join loja_funcionarios lf on lf.id = os.funcionario_id
  left join profiles p on p.user_id = os.user_id
  where os.deleted_at is null
    and os.created_at >= now() - interval '60 days'
    and os.funcionario_id is not null
    and jsonb_array_length(coalesce(os.avarias->'servicos_realizados', '[]'::jsonb)) = 1
    and exists (
      select 1 from comissoes_tipo_servico c
      where c.funcionario_id = os.funcionario_id
    )
) x;
