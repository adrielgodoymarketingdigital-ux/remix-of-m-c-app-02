-- =============================================================================
-- OS com vários técnicos — Diagnóstico 0: contagens (SOMENTE LEITURA)
-- =============================================================================
-- ORDEM: este é o ÚNICO script desta etapa. Rode uma vez no SQL Editor de
-- produção e me mande a linha de resultado (um JSON).
--
-- O que ele faz: um único SELECT. Não grava, não altera, não cria nada.
-- Não devolve nenhum dado de cliente, nome, e-mail, telefone ou id — só números.
--
-- Base de todas as contagens: OS NÃO apagadas (ordens_servico.deleted_at IS NULL),
-- de todas as lojas, incluindo OS marcadas como teste (is_teste).
--
-- O que cada número significa:
--  1 total_os ......................... quantas OS existem (não apagadas).
--  2 os_com_tecnico_principal ......... OS com "Técnico Principal" preenchido
--                                       (ordens_servico.funcionario_id).
--  3 os_sem_tecnico_principal ......... OS sem Técnico Principal.
--  4 os_com_tecnicos_por_servico ...... OS que têm ao menos uma linha em
--                                       "Técnicos por Serviço" (tabela os_tecnicos).
--  5 os_com_tecnico_por_servico_diferente_do_principal
--                                       OS em que pelo menos um técnico de
--                                       os_tecnicos NÃO é o Técnico Principal
--                                       (conta também OS sem principal).
--                                       Esses técnicos hoje aparecem com R$ 0 em
--                                       "Comissões a Pagar" e no Desempenho.
--  6 os_com_principal_tambem_em_tecnicos_por_servico
--                                       OS em que o Técnico Principal também está
--                                       em os_tecnicos (risco de contar a comissão
--                                       duas vezes num relatório novo).
--  7 os_com_principal_inexistente ..... OS cujo Técnico Principal aponta para um
--                                       funcionário que não existe mais em
--                                       loja_funcionarios (id "órfão").
--  8 linhas_tecnicos_sem_servico ...... linhas de os_tecnicos sem serviço ligado
--                                       (sem servico_id e sem servico_linha_id):
--                                       a comissão delas cai no cálculo antigo
--                                       (tipo da OS sobre o total da OS).
--  9 lojas_que_usam_tecnicos_por_servico
--                                       quantas lojas (donos de OS) têm ao menos
--                                       uma OS com linha em os_tecnicos.
--
-- Observação técnica: servico_linha_id é lido via to_jsonb(linha) para o script
-- funcionar mesmo se essa coluna não existir no banco.
-- =============================================================================

SELECT json_build_object(
  '1_total_os',
    (SELECT count(*) FROM public.ordens_servico os
      WHERE os.deleted_at IS NULL),

  '2_os_com_tecnico_principal',
    (SELECT count(*) FROM public.ordens_servico os
      WHERE os.deleted_at IS NULL AND os.funcionario_id IS NOT NULL),

  '3_os_sem_tecnico_principal',
    (SELECT count(*) FROM public.ordens_servico os
      WHERE os.deleted_at IS NULL AND os.funcionario_id IS NULL),

  '4_os_com_tecnicos_por_servico',
    (SELECT count(*) FROM public.ordens_servico os
      WHERE os.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM public.os_tecnicos ot WHERE ot.os_id = os.id)),

  '5_os_com_tecnico_por_servico_diferente_do_principal',
    (SELECT count(*) FROM public.ordens_servico os
      WHERE os.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM public.os_tecnicos ot
                     WHERE ot.os_id = os.id
                       AND ot.funcionario_id IS DISTINCT FROM os.funcionario_id)),

  '6_os_com_principal_tambem_em_tecnicos_por_servico',
    (SELECT count(*) FROM public.ordens_servico os
      WHERE os.deleted_at IS NULL
        AND os.funcionario_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.os_tecnicos ot
                     WHERE ot.os_id = os.id
                       AND ot.funcionario_id = os.funcionario_id)),

  '7_os_com_principal_inexistente',
    (SELECT count(*) FROM public.ordens_servico os
      WHERE os.deleted_at IS NULL
        AND os.funcionario_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.loja_funcionarios lf
                         WHERE lf.id = os.funcionario_id)),

  '8_linhas_tecnicos_sem_servico',
    (SELECT count(*) FROM public.os_tecnicos ot
       JOIN public.ordens_servico os ON os.id = ot.os_id
      WHERE os.deleted_at IS NULL
        AND ot.servico_id IS NULL
        AND (to_jsonb(ot) ->> 'servico_linha_id') IS NULL),

  '9_lojas_que_usam_tecnicos_por_servico',
    (SELECT count(DISTINCT os.user_id) FROM public.ordens_servico os
      WHERE os.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM public.os_tecnicos ot WHERE ot.os_id = os.id))
) AS diagnostico;
