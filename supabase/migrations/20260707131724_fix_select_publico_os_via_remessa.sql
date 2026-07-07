-- Corrige o fluxo público de criação de OS via Entrada Corporativa
-- (/entrada/:itemId). O INSERT público já funcionava (policy criada em
-- 20260707094614), mas o client faz .select() logo após o insert para
-- pegar id/numero_os, e não havia nenhuma policy de SELECT liberando
-- isso para "anon" — o PostgREST reporta esse SELECT de retorno como
-- falha genérica de RLS no insert, mascarando a causa real.
--
-- Usa a mesma condição de segurança já validada na policy de INSERT
-- (20260707094614): só libera leitura pública de OS cujo user_id/
-- cliente_id correspondem a uma remessa corporativa existente. Não
-- depende de remessa_itens.os_ids já estar atualizado, pois esse campo
-- só é preenchido DEPOIS do insert+select da OS.
CREATE POLICY "leitura publica de OS criada via remessa corporativa"
  ON public.ordens_servico FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.remessas_corporativas rc
      WHERE rc.user_id = ordens_servico.user_id
        AND (rc.cliente_id = ordens_servico.cliente_id OR ordens_servico.cliente_id IS NULL)
    )
  );
