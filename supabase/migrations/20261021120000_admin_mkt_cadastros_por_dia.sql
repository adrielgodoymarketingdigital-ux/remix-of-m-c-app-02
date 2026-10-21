-- Painel Marketing (/admin/marketing) — etapa 2: cadastros por dia.
--
-- Função de LEITURA, só para admin, que devolve apenas números agregados
-- (nenhum nome, e-mail ou telefone). SECURITY DEFINER para contar todos os
-- profiles sem abrir RLS das tabelas; por isso a checagem has_role é
-- obrigatória e o EXECUTE é negado para PUBLIC/anon.
--
-- Dia = data de profiles.created_at no fuso de Brasília. Período máximo de
-- 400 dias para evitar varredura da tabela inteira.
--
-- Fica fora da contagem (não são cadastros vindos de marketing):
--   • funcionários           — loja_funcionarios.funcionario_user_id
--   • gerentes de filial     — empresa_usuarios.gerente_id
--   • admins                 — user_roles.role = 'admin'
--   • demonstração e admin   — assinaturas.plano_tipo IN ('demonstracao', 'admin')
--
-- Colunas:
--   cadastros = total do dia
--   com_utm   = cadastros com utm_source preenchido
--   meta      = cadastros com fbclid ou utm_source de Facebook/Instagram/Meta
-- UTMs só são gravadas em profiles desde 2026-05-25 (migration
-- 20260525000002_handle_new_user_tracking_fields).
--
-- Para reverter:
--   DROP FUNCTION IF EXISTS public.admin_mkt_cadastros_por_dia(date, date);

CREATE OR REPLACE FUNCTION public.admin_mkt_cadastros_por_dia(p_inicio date, p_fim date)
RETURNS TABLE(dia date, cadastros bigint, com_utm bigint, meta bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta função';
  END IF;

  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim - p_inicio > 400 THEN
    RAISE EXCEPTION 'Período inválido (máximo de 400 dias)';
  END IF;

  RETURN QUERY
  SELECT
    (p.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
    count(*),
    count(*) FILTER (WHERE p.utm_source IS NOT NULL AND p.utm_source <> ''),
    count(*) FILTER (
      WHERE p.fbclid IS NOT NULL
         OR p.utm_source ILIKE ANY (ARRAY['fb%', 'facebook%', 'ig%', 'instagram%', 'meta%'])
    )
  FROM public.profiles p
  WHERE p.created_at >= (p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND p.created_at <  ((p_fim + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND NOT EXISTS (SELECT 1 FROM public.loja_funcionarios f WHERE f.funcionario_user_id = p.user_id)
    AND NOT EXISTS (SELECT 1 FROM public.empresa_usuarios e WHERE e.gerente_id = p.user_id)
    AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin')
    AND NOT EXISTS (
      SELECT 1 FROM public.assinaturas a
      WHERE a.user_id = p.user_id
        AND a.plano_tipo IN ('demonstracao', 'admin')
    )
  GROUP BY 1
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mkt_cadastros_por_dia(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mkt_cadastros_por_dia(date, date) TO authenticated;

COMMENT ON FUNCTION public.admin_mkt_cadastros_por_dia(date, date) IS 'Painel Marketing: cadastros por dia (Brasília), só admin, só números agregados. Exclui funcionários, gerentes de filial, admins e demonstração.';
