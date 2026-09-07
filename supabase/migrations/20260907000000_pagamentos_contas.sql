-- =====================================================================
-- Recebimento parcial de contas + histórico de pagamentos + nome do cliente
--
-- 100% ADITIVA — não lê nem escreve nenhuma linha existente de `contas`.
-- Todas as contas atuais ficam usa_historico_pagamentos = false (default) e
-- continuam se comportando exatamente como hoje. Só contas criadas a partir
-- do deploy do código novo nascem com usa_historico_pagamentos = true e usam
-- a tabela pagamentos_contas como fonte de verdade dos recebimentos.
-- =====================================================================

-- ---------- 1. Tabela pagamentos_contas -----------------------------
CREATE TABLE public.pagamentos_contas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id         uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL,                 -- denormalizado (= contas.user_id) p/ RLS
  empresa_id       uuid,                          -- denormalizado (= contas.empresa_id)
  valor            numeric NOT NULL CHECK (valor > 0),
  data_pagamento   date NOT NULL DEFAULT current_date,
  forma_pagamento  text,
  observacao       text,
  -- estorno = soft-delete (mantém trilha de auditoria)
  estornado        boolean NOT NULL DEFAULT false,
  estornado_em     timestamptz,
  estornado_motivo text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pagamentos_contas IS
  'Histórico de recebimentos/pagamentos parciais de uma conta. A soma dos não-estornados = contas.valor_pago (mantida por trigger). Cada linha é um recibo reimprimível.';

CREATE INDEX idx_pagamentos_contas_conta_id ON public.pagamentos_contas (conta_id);
CREATE INDEX idx_pagamentos_contas_user_id  ON public.pagamentos_contas (user_id);

-- ---------- 2. RLS (espelha as policies de `contas`) ---------------
ALTER TABLE public.pagamentos_contas ENABLE ROW LEVEL SECURITY;

-- Dono
CREATE POLICY "Users can view own pagamentos_contas" ON public.pagamentos_contas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pagamentos_contas" ON public.pagamentos_contas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pagamentos_contas" ON public.pagamentos_contas
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pagamentos_contas" ON public.pagamentos_contas
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Funcionário do dono (pode ver / lançar / estornar)
CREATE POLICY "Funcionarios veem pagamentos do dono" ON public.pagamentos_contas
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_funcionario_of(user_id));
CREATE POLICY "Funcionarios inserem pagamentos para o dono" ON public.pagamentos_contas
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_funcionario_of(user_id));
CREATE POLICY "Funcionarios atualizam pagamentos do dono" ON public.pagamentos_contas
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_funcionario_of(user_id));
CREATE POLICY "Funcionarios excluem pagamentos do dono" ON public.pagamentos_contas
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_funcionario_of(user_id));

-- Gerente de filial (mesmo padrão de contas)
CREATE POLICY "gerente ve pagamentos da filial" ON public.pagamentos_contas
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.gerente_id = auth.uid() AND eu.proprietario_id = pagamentos_contas.user_id));
CREATE POLICY "gerente insere pagamentos da filial" ON public.pagamentos_contas
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.gerente_id = auth.uid() AND eu.proprietario_id = pagamentos_contas.user_id));
CREATE POLICY "gerente atualiza pagamentos da filial" ON public.pagamentos_contas
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.gerente_id = auth.uid() AND eu.proprietario_id = pagamentos_contas.user_id));
CREATE POLICY "gerente exclui pagamentos da filial" ON public.pagamentos_contas
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.gerente_id = auth.uid() AND eu.proprietario_id = pagamentos_contas.user_id));

-- ---------- 3. Flag na conta (aditivo, instantâneo) --------------
-- DEFAULT constante + NOT NULL → Postgres não reescreve a tabela.
-- Todas as ~11.450 contas existentes ficam false automaticamente.
ALTER TABLE public.contas
  ADD COLUMN usa_historico_pagamentos boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contas.usa_historico_pagamentos IS
  'true = a conta usa a tabela pagamentos_contas como fonte de verdade dos recebimentos (criada a partir do deploy do recebimento parcial). false = modelo antigo (valor/valor_pago inline), UI de baixa tudo-ou-nada.';

-- ---------- 4. Trigger de sincronização --------------------------
CREATE OR REPLACE FUNCTION public.sync_conta_from_pagamentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conta_id   uuid := COALESCE(NEW.conta_id, OLD.conta_id);
  v_valor      numeric;
  v_tipo       tipo_conta;
  v_usa        boolean;
  v_total_pago numeric;
  v_ultima     date;
BEGIN
  SELECT valor, tipo, usa_historico_pagamentos
    INTO v_valor, v_tipo, v_usa
    FROM public.contas WHERE id = v_conta_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- GUARDA: nunca toca em conta do modelo antigo, mesmo que caia um pagamento nela.
  IF NOT COALESCE(v_usa, false) THEN RETURN NULL; END IF;

  SELECT COALESCE(SUM(valor), 0), MAX(data_pagamento)
    INTO v_total_pago, v_ultima
    FROM public.pagamentos_contas
    WHERE conta_id = v_conta_id AND estornado = false;

  UPDATE public.contas SET
    valor_pago = v_total_pago,
    status = CASE
      WHEN v_total_pago >= v_valor - 0.005
        THEN (CASE WHEN v_tipo = 'pagar' THEN 'pago' ELSE 'recebido' END)::status_conta
      ELSE 'pendente'::status_conta
    END,
    data_pagamento = CASE WHEN v_total_pago >= v_valor - 0.005 THEN v_ultima ELSE NULL END
  WHERE id = v_conta_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_pagamentos_contas_sync
AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_contas
FOR EACH ROW EXECUTE FUNCTION public.sync_conta_from_pagamentos();
