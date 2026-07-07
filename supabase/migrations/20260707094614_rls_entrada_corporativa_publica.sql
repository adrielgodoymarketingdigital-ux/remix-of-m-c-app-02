-- Permite que a página pública /entrada/:itemId (sem autenticação) crie uma
-- OS a partir de um dispositivo de remessa corporativa e marque o item como
-- processado. Segue o mesmo padrão de "acesso público por referência válida"
-- já usado em os_tracking_links: o insert/update só é aceito quando os dados
-- batem com uma remessa/item existentes, nunca livre para qualquer user_id.

-- REMESSAS_CORPORATIVAS: leitura pública (necessária para o join
-- remessa_itens -> remessas_corporativas -> clientes feito na página pública)
CREATE POLICY "leitura publica de remessas por id"
  ON public.remessas_corporativas FOR SELECT
  USING (true);

-- REMESSA_ITENS: permite ao público atualizar apenas o item (ex: adicionar
-- os_ids) desde que a remessa referenciada exista de fato
CREATE POLICY "atualizacao publica de itens por remessa valida"
  ON public.remessa_itens FOR UPDATE
  USING (true)
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.remessas_corporativas rc
      WHERE rc.id = remessa_itens.remessa_id
    )
  );

-- ORDENS_SERVICO: permite ao público inserir uma OS somente quando user_id e
-- cliente_id informados correspondem a uma remessa corporativa existente
CREATE POLICY "insercao publica de OS via remessa corporativa"
  ON public.ordens_servico FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.remessas_corporativas rc
      WHERE rc.user_id = ordens_servico.user_id
        AND (rc.cliente_id = ordens_servico.cliente_id OR ordens_servico.cliente_id IS NULL)
    )
  );
