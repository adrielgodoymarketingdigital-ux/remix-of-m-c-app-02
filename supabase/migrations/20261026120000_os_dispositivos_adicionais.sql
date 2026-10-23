-- OS com vários dispositivos — etapa 3: tabela dos dispositivos ADICIONAIS.
--
-- O dispositivo que a OS já tem (colunas dispositivo_* de ordens_servico e
-- os campos de aparelho dentro de avarias) continua sendo o "dispositivo 1" e
-- nada nele muda. Os extras ficam nesta tabela, uma linha por aparelho. Não
-- vão para o jsonb avarias porque o assistente da OS regrava avarias inteiro
-- a cada edição, e o que não conhece seria perdido.
--
-- Colunas espelham o dispositivo 1, com os MESMOS nomes, para os leitores
-- reaproveitarem o que já existe:
--   ordens_servico.dispositivo_tipo/marca/modelo/cor/imei/numero_serie
--   ordens_servico.defeito_relatado
--   avarias.dispositivo_sistema/fabricante/subtipo
--   avarias.senha_desbloqueio  (jsonb SenhaDesbloqueio, já criptografado pelo app)
--   avarias.checklist          (jsonb Checklist)
--   avarias.avarias_visuais    (jsonb AvariaVisual[])
--   avarias.fotos_dispositivo  (jsonb string[])
-- Mais observacoes (texto livre do aparelho) e ordem (posição na OS).
-- Status, garantia, pagamento, assinaturas e serviços continuam por OS. Uma
-- linha de serviço aponta para o adicional pelo id dele em
-- avarias.servicos_realizados[].dispositivo_ref.
--
-- Acesso: o mesmo de os_tecnicos — dono da loja, funcionário ativo e gerente
-- da filial da OS, sempre conferido pela OS-mãe. Além disso user_id tem de
-- ser o dono da OS (ninguém grava a linha com outro dono). Nada para anon.
-- Privilégios: a tabela nasce fechada (o padrão do Supabase daria ALL ao
-- anon). Nenhuma tabela existente é tocada.
--
-- OS na lixeira (deleted_at) mantém os adicionais; exclusão definitiva da OS
-- apaga em cascata.
--
-- Idempotente: rodar de novo não muda nada.
--
-- ROLLBACK (só enquanto nenhuma loja tiver gravado adicionais — apaga os dados):
--   DROP TABLE IF EXISTS public.os_dispositivos_adicionais;

BEGIN;

CREATE TABLE IF NOT EXISTS public.os_dispositivos_adicionais (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id                     uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  user_id                   uuid NOT NULL REFERENCES auth.users(id),  -- dono da loja (= ordens_servico.user_id)
  ordem                     integer NOT NULL CHECK (ordem >= 2),       -- 1 = dispositivo da própria OS
  dispositivo_tipo          text NOT NULL,
  dispositivo_marca         text NOT NULL,
  dispositivo_modelo        text NOT NULL,
  dispositivo_cor           text,
  dispositivo_imei          text,
  dispositivo_numero_serie  text,
  dispositivo_sistema       text,
  dispositivo_fabricante    text,
  dispositivo_subtipo       text,
  senha_desbloqueio         jsonb CHECK (senha_desbloqueio IS NULL OR jsonb_typeof(senha_desbloqueio) = 'object'),
  defeito_relatado          text,
  checklist                 jsonb CHECK (checklist IS NULL OR jsonb_typeof(checklist) = 'object'),
  avarias_visuais           jsonb CHECK (avarias_visuais IS NULL OR jsonb_typeof(avarias_visuais) = 'array'),
  fotos_dispositivo         jsonb CHECK (fotos_dispositivo IS NULL OR jsonb_typeof(fotos_dispositivo) = 'array'),
  observacoes               text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.os_dispositivos_adicionais IS
  'Dispositivos adicionais de uma OS (o 1º continua nas colunas dispositivo_* de ordens_servico). Colunas com os mesmos nomes do dispositivo 1. Acesso pela OS-mãe: dono, funcionário e gerente da filial.';
COMMENT ON COLUMN public.os_dispositivos_adicionais.user_id IS
  'Dono da loja; obrigatoriamente igual a ordens_servico.user_id da OS (conferido nas policies).';
COMMENT ON COLUMN public.os_dispositivos_adicionais.ordem IS
  'Posição do aparelho na OS: 2, 3, ... (1 é o dispositivo da própria OS). Pode ter buracos após exclusão; ordenar por ordem, created_at.';
COMMENT ON COLUMN public.os_dispositivos_adicionais.senha_desbloqueio IS
  'Mesmo formato de avarias.senha_desbloqueio (SenhaDesbloqueio), já criptografado pelo app.';

CREATE INDEX IF NOT EXISTS idx_os_dispositivos_adicionais_os_id
  ON public.os_dispositivos_adicionais (os_id);
CREATE INDEX IF NOT EXISTS idx_os_dispositivos_adicionais_user_id
  ON public.os_dispositivos_adicionais (user_id);

DROP TRIGGER IF EXISTS update_os_dispositivos_adicionais_updated_at ON public.os_dispositivos_adicionais;
CREATE TRIGGER update_os_dispositivos_adicionais_updated_at
  BEFORE UPDATE ON public.os_dispositivos_adicionais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Privilégios: só a tabela nova.
ALTER TABLE public.os_dispositivos_adicionais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.os_dispositivos_adicionais FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_dispositivos_adicionais TO authenticated;
GRANT ALL ON public.os_dispositivos_adicionais TO service_role;

-- Dono e funcionário (mesmo critério de os_tecnicos).
DROP POLICY IF EXISTS "Dono pode ver dispositivos adicionais das suas OS" ON public.os_dispositivos_adicionais;
CREATE POLICY "Dono pode ver dispositivos adicionais das suas OS"
  ON public.os_dispositivos_adicionais FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    WHERE os.id = os_dispositivos_adicionais.os_id
      AND os.user_id = os_dispositivos_adicionais.user_id
      AND (os.user_id = auth.uid() OR public.is_funcionario_of(os.user_id))
  ));

DROP POLICY IF EXISTS "Dono pode inserir dispositivos adicionais nas suas OS" ON public.os_dispositivos_adicionais;
CREATE POLICY "Dono pode inserir dispositivos adicionais nas suas OS"
  ON public.os_dispositivos_adicionais FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    WHERE os.id = os_dispositivos_adicionais.os_id
      AND os.user_id = os_dispositivos_adicionais.user_id
      AND (os.user_id = auth.uid() OR public.is_funcionario_of(os.user_id))
  ));

DROP POLICY IF EXISTS "Dono pode atualizar dispositivos adicionais das suas OS" ON public.os_dispositivos_adicionais;
CREATE POLICY "Dono pode atualizar dispositivos adicionais das suas OS"
  ON public.os_dispositivos_adicionais FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    WHERE os.id = os_dispositivos_adicionais.os_id
      AND os.user_id = os_dispositivos_adicionais.user_id
      AND (os.user_id = auth.uid() OR public.is_funcionario_of(os.user_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    WHERE os.id = os_dispositivos_adicionais.os_id
      AND os.user_id = os_dispositivos_adicionais.user_id
      AND (os.user_id = auth.uid() OR public.is_funcionario_of(os.user_id))
  ));

DROP POLICY IF EXISTS "Dono pode deletar dispositivos adicionais das suas OS" ON public.os_dispositivos_adicionais;
CREATE POLICY "Dono pode deletar dispositivos adicionais das suas OS"
  ON public.os_dispositivos_adicionais FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    WHERE os.id = os_dispositivos_adicionais.os_id
      AND os.user_id = os_dispositivos_adicionais.user_id
      AND (os.user_id = auth.uid() OR public.is_funcionario_of(os.user_id))
  ));

-- Gerente da filial da OS (mesmo critério de os_tecnicos).
DROP POLICY IF EXISTS "gerente ve dispositivos adicionais das OS da filial" ON public.os_dispositivos_adicionais;
CREATE POLICY "gerente ve dispositivos adicionais das OS da filial"
  ON public.os_dispositivos_adicionais FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.empresa_usuarios eu ON eu.proprietario_id = os.user_id AND eu.empresa_id = os.empresa_id
    WHERE os.id = os_dispositivos_adicionais.os_id
      AND os.user_id = os_dispositivos_adicionais.user_id
      AND eu.gerente_id = auth.uid()
  ));

DROP POLICY IF EXISTS "gerente insere dispositivos adicionais nas OS da filial" ON public.os_dispositivos_adicionais;
CREATE POLICY "gerente insere dispositivos adicionais nas OS da filial"
  ON public.os_dispositivos_adicionais FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.empresa_usuarios eu ON eu.proprietario_id = os.user_id AND eu.empresa_id = os.empresa_id
    WHERE os.id = os_dispositivos_adicionais.os_id
      AND os.user_id = os_dispositivos_adicionais.user_id
      AND eu.gerente_id = auth.uid()
  ));

DROP POLICY IF EXISTS "gerente atualiza dispositivos adicionais das OS da filial" ON public.os_dispositivos_adicionais;
CREATE POLICY "gerente atualiza dispositivos adicionais das OS da filial"
  ON public.os_dispositivos_adicionais FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.empresa_usuarios eu ON eu.proprietario_id = os.user_id AND eu.empresa_id = os.empresa_id
    WHERE os.id = os_dispositivos_adicionais.os_id
      AND os.user_id = os_dispositivos_adicionais.user_id
      AND eu.gerente_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.empresa_usuarios eu ON eu.proprietario_id = os.user_id AND eu.empresa_id = os.empresa_id
    WHERE os.id = os_dispositivos_adicionais.os_id
      AND os.user_id = os_dispositivos_adicionais.user_id
      AND eu.gerente_id = auth.uid()
  ));

DROP POLICY IF EXISTS "gerente exclui dispositivos adicionais das OS da filial" ON public.os_dispositivos_adicionais;
CREATE POLICY "gerente exclui dispositivos adicionais das OS da filial"
  ON public.os_dispositivos_adicionais FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.empresa_usuarios eu ON eu.proprietario_id = os.user_id AND eu.empresa_id = os.empresa_id
    WHERE os.id = os_dispositivos_adicionais.os_id
      AND os.user_id = os_dispositivos_adicionais.user_id
      AND eu.gerente_id = auth.uid()
  ));

COMMIT;
