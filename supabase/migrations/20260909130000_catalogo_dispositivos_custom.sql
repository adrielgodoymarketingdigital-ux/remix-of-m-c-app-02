
-- Catálogo de Tipo/Marca/Modelo/Cor de dispositivo personalizado por loja.
-- Complementa (não substitui) o catálogo fixo em src/data/catalogoDispositivos.ts.
--
-- Hierarquia por texto, não por FK: a maioria das Marcas/Modelos novos vai
-- pendurar em Tipos/Marcas do catálogo FIXO (ex: "iPhone 18" sob a Apple),
-- que não têm linha nenhuma nesta tabela — não há o que referenciar por id.
-- Por isso tipo_valor/marca_nome guardam o "value" fixo (ex: "Celular") ou o
-- nome de um registro custom (nivel='tipo'/'marca') indistintamente.
--
-- Sem UNIQUE proposital: segue o padrão de tipos_servico — permite duplicata
-- (funcionários diferentes digitando "Iphone" vs "iPhone") e resolve depois
-- via mesclagem (ver useCatalogoDispositivosCustom.mesclar), não bloqueio na
-- entrada.
CREATE TABLE public.catalogo_dispositivos_custom (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  empresa_id UUID,
  nivel TEXT NOT NULL CHECK (nivel IN ('tipo', 'marca', 'modelo', 'cor')),
  nome TEXT NOT NULL,
  tipo_valor TEXT,
  marca_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT catalogo_custom_hierarquia CHECK (
    (nivel = 'tipo' AND tipo_valor IS NULL AND marca_nome IS NULL)
    OR (nivel = 'marca' AND tipo_valor IS NOT NULL AND marca_nome IS NULL)
    OR (nivel IN ('modelo', 'cor') AND tipo_valor IS NOT NULL AND marca_nome IS NOT NULL)
  )
);

CREATE INDEX idx_catalogo_custom_lookup
  ON public.catalogo_dispositivos_custom (user_id, nivel, tipo_valor, marca_nome);

-- RLS
ALTER TABLE public.catalogo_dispositivos_custom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own catalogo_dispositivos_custom"
  ON public.catalogo_dispositivos_custom FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own catalogo_dispositivos_custom"
  ON public.catalogo_dispositivos_custom FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own catalogo_dispositivos_custom"
  ON public.catalogo_dispositivos_custom FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own catalogo_dispositivos_custom"
  ON public.catalogo_dispositivos_custom FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Funcionarios podem ver catalogo_dispositivos_custom do dono"
  ON public.catalogo_dispositivos_custom FOR SELECT TO authenticated
  USING (is_funcionario_of(user_id));

CREATE POLICY "Funcionarios podem inserir catalogo_dispositivos_custom para o dono"
  ON public.catalogo_dispositivos_custom FOR INSERT TO authenticated
  WITH CHECK (is_funcionario_of(user_id));
