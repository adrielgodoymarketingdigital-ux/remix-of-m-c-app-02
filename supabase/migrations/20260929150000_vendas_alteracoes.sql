-- =====================================================================
-- Histórico de alterações de venda (começa pela correção de DATA)
--
-- Registra quem alterou, quando, e o valor antes/depois — a venda em si só
-- guarda o estado atual. Gravado pelo app logo após a alteração
-- (src/lib/vendas/alterarDataVenda.ts). Se o registro falhar, a alteração
-- da venda NÃO é desfeita (o log é complementar).
--
-- 100% ADITIVA: tabela nova, sem tocar em nenhuma tabela existente.
--
-- RLS — mesmo escopo de acesso da tabela vendas (dono, funcionário do dono,
-- gerente da filial, admin), com duas diferenças de propósito:
--   * INSERT exige alterado_por = auth.uid(): ninguém grava log em nome de
--     outra pessoa (a policy de INSERT do os_audit_log hoje não tem essa
--     checagem — não copiada aqui).
--   * Sem policy de UPDATE/DELETE: o histórico é imutável pelo app.
-- =====================================================================

CREATE TABLE public.vendas_alteracoes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- dono da venda (= vendas.user_id / vendas_avulsas.user_id), para RLS
  user_id            uuid NOT NULL,
  empresa_id         uuid,
  origem             text NOT NULL CHECK (origem IN ('vendas', 'vendas_avulsas')),
  -- linha em que o usuário clicou (id de vendas ou de vendas_avulsas)
  venda_id           uuid NOT NULL,
  -- grupo da venda do PDV (todas as linhas foram alteradas juntas)
  grupo_venda        text,
  campo              text NOT NULL DEFAULT 'data',
  valor_antes        text,
  valor_depois       text,
  linhas_afetadas    integer NOT NULL DEFAULT 1,
  caixas_ajustados   integer NOT NULL DEFAULT 0,
  -- quem fez a alteração (pode ser funcionário/gerente, diferente do dono)
  alterado_por       uuid NOT NULL DEFAULT auth.uid(),
  alterado_por_nome  text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vendas_alteracoes IS
  'Histórico imutável de alterações feitas em vendas já lançadas (hoje: correção de data). valor_antes/valor_depois em texto (datas em ISO UTC).';

CREATE INDEX idx_vendas_alteracoes_venda_id    ON public.vendas_alteracoes (venda_id);
CREATE INDEX idx_vendas_alteracoes_grupo_venda ON public.vendas_alteracoes (grupo_venda) WHERE grupo_venda IS NOT NULL;
CREATE INDEX idx_vendas_alteracoes_user_id     ON public.vendas_alteracoes (user_id);

ALTER TABLE public.vendas_alteracoes ENABLE ROW LEVEL SECURITY;

-- Leitura: dono, funcionário do dono, gerente da filial, admin
CREATE POLICY "dono e funcionarios veem alteracoes de venda" ON public.vendas_alteracoes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_funcionario_of(user_id));

CREATE POLICY "gerente ve alteracoes de venda da filial" ON public.vendas_alteracoes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.gerente_id = auth.uid()
      AND eu.proprietario_id = vendas_alteracoes.user_id
      AND eu.empresa_id = vendas_alteracoes.empresa_id));

CREATE POLICY "admins veem todas as alteracoes de venda" ON public.vendas_alteracoes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Escrita: só registra alteração feita pela própria pessoa, em venda que ela pode alterar
CREATE POLICY "dono e funcionarios registram alteracoes de venda" ON public.vendas_alteracoes
  FOR INSERT TO authenticated
  WITH CHECK (
    alterado_por = auth.uid()
    AND (user_id = auth.uid() OR public.is_funcionario_of(user_id)));

CREATE POLICY "gerente registra alteracoes de venda da filial" ON public.vendas_alteracoes
  FOR INSERT TO authenticated
  WITH CHECK (
    alterado_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.gerente_id = auth.uid()
        AND eu.proprietario_id = vendas_alteracoes.user_id
        AND eu.empresa_id = vendas_alteracoes.empresa_id));
