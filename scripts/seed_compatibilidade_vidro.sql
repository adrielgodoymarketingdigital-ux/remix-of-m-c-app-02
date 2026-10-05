-- Seed de dados: Compatibilidade de Vidros (troca de vidro da tela)
-- GERADO por scripts/gerar_seed_compatibilidade_vidro.ts a partir de "compatibilidade_vidros_sistema (1).xlsx"
-- (aba "Compatibilidade"). Não editar à mão: corrigir a planilha e gerar de novo.
--
-- Aplicar UMA VEZ manualmente no SQL Editor do Supabase (não é migration),
-- DEPOIS da migration 20261005150000_compatibilidade_tipo_vidro.sql.
-- Tudo numa transação: aborta se a coluna tipo não existir, se já houver grupos
-- de vidro, se as contagens finais não baterem ou se os dados de película mudarem.
--
-- 167 grupos, 631 vínculos de modelo. Marca e modelo exatamente como na planilha.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'grupos_compatibilidade_pelicula' AND column_name = 'tipo'
  ) THEN
    RAISE EXCEPTION 'Coluna tipo não existe: aplique antes a migration 20261005150000_compatibilidade_tipo_vidro.sql';
  END IF;
  IF EXISTS (SELECT 1 FROM public.grupos_compatibilidade_pelicula WHERE tipo = 'vidro') THEN
    RAISE EXCEPTION 'Já existem grupos com tipo = vidro: seed de vidros não será aplicado de novo';
  END IF;
END $$;

-- Foto das películas antes, para a conferência final.
CREATE TEMP TABLE _conferencia_peliculas ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public.grupos_compatibilidade_pelicula WHERE tipo = 'pelicula') AS grupos,
  (SELECT count(*) FROM public.grupo_compatibilidade_modelos m
     JOIN public.grupos_compatibilidade_pelicula g ON g.id = m.grupo_id
    WHERE g.tipo = 'pelicula') AS vinculos;

-- ============================================================
-- APPLE — 3 grupos
-- ============================================================

-- Grupo: iPhone 12/iPhone 12 Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('iPhone 12/iPhone 12 Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 12'),
  ('Apple', 'iPhone 12 Pro')
) AS v(marca, modelo);

-- Grupo: iPhone 13/iPhone 13 Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('iPhone 13/iPhone 13 Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 13'),
  ('Apple', 'iPhone 13 Pro')
) AS v(marca, modelo);

-- Grupo: iPhone 14/iPhone 16e
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('iPhone 14/iPhone 16e', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 14'),
  ('Apple', 'iPhone 16e')
) AS v(marca, modelo);

-- ============================================================
-- SAMSUNG — 35 grupos
-- ============================================================

-- Grupo: A9 2016/A9 Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A9 2016/A9 Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A9 2016'),
  ('Samsung', 'A9 Pro')
) AS v(marca, modelo);

-- Grupo: A11/M11
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A11/M11', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A11'),
  ('Samsung', 'M11')
) AS v(marca, modelo);

-- Grupo: A02/A04S/A13 5G/A32 5G/F12/M12/M32 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A02/A04S/A13 5G/A32 5G/F12/M12/M32 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A02'),
  ('Samsung', 'A04S'),
  ('Samsung', 'A13 5G'),
  ('Samsung', 'A32 5G'),
  ('Samsung', 'F12'),
  ('Samsung', 'M12'),
  ('Samsung', 'M32 5G')
) AS v(marca, modelo);

-- Grupo: A02S/A03/A03S/A04E/F02S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A02S/A03/A03S/A04E/F02S', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A02S'),
  ('Samsung', 'A03'),
  ('Samsung', 'A03S'),
  ('Samsung', 'A04E'),
  ('Samsung', 'F02S')
) AS v(marca, modelo);

-- Grupo: A04/M04/F04
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A04/M04/F04', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A04'),
  ('Samsung', 'M04'),
  ('Samsung', 'F04')
) AS v(marca, modelo);

-- Grupo: A05S/F14 4G/M14 4G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A05S/F14 4G/M14 4G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A05S'),
  ('Samsung', 'F14 4G'),
  ('Samsung', 'M14 4G')
) AS v(marca, modelo);

-- Grupo: A06 4G-5G/F06 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A06 4G-5G/F06 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A06 4G-5G'),
  ('Samsung', 'F06 5G')
) AS v(marca, modelo);

-- Grupo: A14 4G-5G/F14 5G/M14 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A14 4G-5G/F14 5G/M14 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A14 4G-5G'),
  ('Samsung', 'F14 5G'),
  ('Samsung', 'M14 5G')
) AS v(marca, modelo);

-- Grupo: A15 4G-5G/F15 5G/M15 4G-5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A15 4G-5G/F15 5G/M15 4G-5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A15 4G-5G'),
  ('Samsung', 'F15 5G'),
  ('Samsung', 'M15 4G-5G')
) AS v(marca, modelo);

-- Grupo: A16/F16 5G/M16 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A16/F16 5G/M16 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A16'),
  ('Samsung', 'F16 5G'),
  ('Samsung', 'M16 5G')
) AS v(marca, modelo);

-- Grupo: A20/A30S/M10S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A20/A30S/M10S', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A20'),
  ('Samsung', 'A30S'),
  ('Samsung', 'M10S')
) AS v(marca, modelo);

-- Grupo: A22 4G/A31/A31S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A22 4G/A31/A31S', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A22 4G'),
  ('Samsung', 'A31'),
  ('Samsung', 'A31S')
) AS v(marca, modelo);

-- Grupo: A23/M23
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A23/M23', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A23'),
  ('Samsung', 'M23')
) AS v(marca, modelo);

-- Grupo: A24 4G/A25 5G/M34/F34
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A24 4G/A25 5G/M34/F34', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A24 4G'),
  ('Samsung', 'A25 5G'),
  ('Samsung', 'M34'),
  ('Samsung', 'F34')
) AS v(marca, modelo);

-- Grupo: A30/A50/A50S/F41/M21/M21S/M30/M30S/M31
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A30/A50/A50S/F41/M21/M21S/M30/M30S/M31', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A30'),
  ('Samsung', 'A50'),
  ('Samsung', 'A50S'),
  ('Samsung', 'F41'),
  ('Samsung', 'M21'),
  ('Samsung', 'M21S'),
  ('Samsung', 'M30'),
  ('Samsung', 'M30S'),
  ('Samsung', 'M31')
) AS v(marca, modelo);

-- Grupo: A32 4G/F22/M22 4G/M32 4G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A32 4G/F22/M22 4G/M32 4G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A32 4G'),
  ('Samsung', 'F22'),
  ('Samsung', 'M22 4G'),
  ('Samsung', 'M32 4G')
) AS v(marca, modelo);

-- Grupo: A35/A55/M35 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A35/A55/M35 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A35'),
  ('Samsung', 'A55'),
  ('Samsung', 'M35 5G')
) AS v(marca, modelo);

-- Grupo: A42/M42 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A42/M42 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A42'),
  ('Samsung', 'M42 5G')
) AS v(marca, modelo);

-- Grupo: A52 4G/5G/A52S/A53/S20 FE 4G/5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A52 4G/5G/A52S/A53/S20 FE 4G/5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A52 4G/5G'),
  ('Samsung', 'A52S'),
  ('Samsung', 'A53'),
  ('Samsung', 'S20 FE 4G/5G')
) AS v(marca, modelo);

-- Grupo: A54/S23 FE
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A54/S23 FE', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A54'),
  ('Samsung', 'S23 FE')
) AS v(marca, modelo);

-- Grupo: A57/S25 FE
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A57/S25 FE', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A57'),
  ('Samsung', 'S25 FE')
) AS v(marca, modelo);

-- Grupo: A60/M41
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A60/M41', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A60'),
  ('Samsung', 'M41')
) AS v(marca, modelo);

-- Grupo: A70/A90 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A70/A90 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A70'),
  ('Samsung', 'A90 5G')
) AS v(marca, modelo);

-- Grupo: A71 4G/F62/M51/M62/Note 10 Lite
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A71 4G/F62/M51/M62/Note 10 Lite', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A71 4G'),
  ('Samsung', 'F62'),
  ('Samsung', 'M51'),
  ('Samsung', 'M62'),
  ('Samsung', 'Note 10 Lite')
) AS v(marca, modelo);

-- Grupo: A71 5G/S10 Lite
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A71 5G/S10 Lite', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A71 5G'),
  ('Samsung', 'S10 Lite')
) AS v(marca, modelo);

-- Grupo: A73/M53
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A73/M53', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A73'),
  ('Samsung', 'M53')
) AS v(marca, modelo);

-- Grupo: A80/A90
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('A80/A90', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'A80'),
  ('Samsung', 'A90')
) AS v(marca, modelo);

-- Grupo: C55/F55/M55/M55S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('C55/F55/M55/M55S', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'C55'),
  ('Samsung', 'F55'),
  ('Samsung', 'M55'),
  ('Samsung', 'M55S')
) AS v(marca, modelo);

-- Grupo: F54/M54
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('F54/M54', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'F54'),
  ('Samsung', 'M54')
) AS v(marca, modelo);

-- Grupo: M21 2021/M31 Prime
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('M21 2021/M31 Prime', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'M21 2021'),
  ('Samsung', 'M31 Prime')
) AS v(marca, modelo);

-- Grupo: S24/S25
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('S24/S25', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'S24'),
  ('Samsung', 'S25')
) AS v(marca, modelo);

-- Grupo: S24 FE/A36/A56
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('S24 FE/A36/A56', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'S24 FE'),
  ('Samsung', 'A36'),
  ('Samsung', 'A56')
) AS v(marca, modelo);

-- Grupo: S24 Plus/S25 Plus
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('S24 Plus/S25 Plus', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'S24 Plus'),
  ('Samsung', 'S25 Plus')
) AS v(marca, modelo);

-- Grupo: J4 Plus/J4 Core/J6 Plus
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('J4 Plus/J4 Core/J6 Plus', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'J4 Plus'),
  ('Samsung', 'J4 Core'),
  ('Samsung', 'J6 Plus')
) AS v(marca, modelo);

-- Grupo: J8/J8 Plus
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('J8/J8 Plus', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'J8'),
  ('Samsung', 'J8 Plus')
) AS v(marca, modelo);

-- ============================================================
-- MOTOROLA — 39 grupos
-- ============================================================

-- Grupo: G Power 2022/G Play 2023
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G Power 2022/G Play 2023', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G Power 2022'),
  ('Motorola', 'G Play 2023')
) AS v(marca, modelo);

-- Grupo: G15/G15 Power/G35/G57 Power
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G15/G15 Power/G35/G57 Power', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G15'),
  ('Motorola', 'G15 Power'),
  ('Motorola', 'G35'),
  ('Motorola', 'G57 Power')
) AS v(marca, modelo);

-- Grupo: G17/G17 Power/G56/G57
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G17/G17 Power/G56/G57', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G17'),
  ('Motorola', 'G17 Power'),
  ('Motorola', 'G56'),
  ('Motorola', 'G57')
) AS v(marca, modelo);

-- Grupo: G75/G Power 2025
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G75/G Power 2025', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G75'),
  ('Motorola', 'G Power 2025')
) AS v(marca, modelo);

-- Grupo: Edge 60 Stylus/G Stylus 5G 2025
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Edge 60 Stylus/G Stylus 5G 2025', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Edge 60 Stylus'),
  ('Motorola', 'G Stylus 5G 2025')
) AS v(marca, modelo);

-- Grupo: Edge 60/Edge 60S/Edge 60 Fusion/Edge 60 Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Edge 60/Edge 60S/Edge 60 Fusion/Edge 60 Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Edge 60'),
  ('Motorola', 'Edge 60S'),
  ('Motorola', 'Edge 60 Fusion'),
  ('Motorola', 'Edge 60 Pro')
) AS v(marca, modelo);

-- Grupo: Edge 50 Neo/S50/Lenovo ThinkPhone 25 by Moto
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Edge 50 Neo/S50/Lenovo ThinkPhone 25 by Moto', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Edge 50 Neo'),
  ('Motorola', 'S50'),
  ('Motorola', 'Lenovo ThinkPhone 25 by Moto')
) AS v(marca, modelo);

-- Grupo: Edge 50/Edge 50 Pro/Edge 50 Ultra/X50 Ultra
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Edge 50/Edge 50 Pro/Edge 50 Ultra/X50 Ultra', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Edge 50'),
  ('Motorola', 'Edge 50 Pro'),
  ('Motorola', 'Edge 50 Ultra'),
  ('Motorola', 'X50 Ultra')
) AS v(marca, modelo);

-- Grupo: Edge 50 Fusion/G85/G96/S50 Neo
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Edge 50 Fusion/G85/G96/S50 Neo', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Edge 50 Fusion'),
  ('Motorola', 'G85'),
  ('Motorola', 'G96'),
  ('Motorola', 'S50 Neo')
) AS v(marca, modelo);

-- Grupo: E7/E7 Power/E7i/E7i Power
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('E7/E7 Power/E7i/E7i Power', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'E7'),
  ('Motorola', 'E7 Power'),
  ('Motorola', 'E7i'),
  ('Motorola', 'E7i Power')
) AS v(marca, modelo);

-- Grupo: E7 Plus/G9 Play
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('E7 Plus/G9 Play', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'E7 Plus'),
  ('Motorola', 'G9 Play')
) AS v(marca, modelo);

-- Grupo: E14/G04/G24/G24 Power
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('E14/G04/G24/G24 Power', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'E14'),
  ('Motorola', 'G04'),
  ('Motorola', 'G24'),
  ('Motorola', 'G24 Power')
) AS v(marca, modelo);

-- Grupo: E30/E40 versão BR
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('E30/E40 versão BR', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'E30'),
  ('Motorola', 'E40 versão BR')
) AS v(marca, modelo);

-- Grupo: Edge 20/Edge 20 Pro/X30/Edge 30 Pro/Edge Plus 2022/Edge S Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Edge 20/Edge 20 Pro/X30/Edge 30 Pro/Edge Plus 2022/Edge S Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Edge 20'),
  ('Motorola', 'Edge 20 Pro'),
  ('Motorola', 'X30'),
  ('Motorola', 'Edge 30 Pro'),
  ('Motorola', 'Edge Plus 2022'),
  ('Motorola', 'Edge S Pro')
) AS v(marca, modelo);

-- Grupo: Edge 20 Lite/Edge 20 Fusion
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Edge 20 Lite/Edge 20 Fusion', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Edge 20 Lite'),
  ('Motorola', 'Edge 20 Fusion')
) AS v(marca, modelo);

-- Grupo: Edge 2021/G Stylus 2022
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Edge 2021/G Stylus 2022', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Edge 2021'),
  ('Motorola', 'G Stylus 2022')
) AS v(marca, modelo);

-- Grupo: Edge 30 Lite/Edge 30 Neo
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Edge 30 Lite/Edge 30 Neo', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Edge 30 Lite'),
  ('Motorola', 'Edge 30 Neo')
) AS v(marca, modelo);

-- Grupo: Edge 40/Edge 40 Neo
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Edge 40/Edge 40 Neo', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Edge 40'),
  ('Motorola', 'Edge 40 Neo')
) AS v(marca, modelo);

-- Grupo: Edge/Edge Plus
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Edge/Edge Plus', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Edge'),
  ('Motorola', 'Edge Plus')
) AS v(marca, modelo);

-- Grupo: G 5G 2020/One 5G Ace
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G 5G 2020/One 5G Ace', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G 5G 2020'),
  ('Motorola', 'One 5G Ace')
) AS v(marca, modelo);

-- Grupo: G 5G Plus/G100/One 5G UW/Edge S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G 5G Plus/G100/One 5G UW/Edge S', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G 5G Plus'),
  ('Motorola', 'G100'),
  ('Motorola', 'One 5G UW'),
  ('Motorola', 'Edge S')
) AS v(marca, modelo);

-- Grupo: G Pro 2020/G Stylus 2020/G Power 2020
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G Pro 2020/G Stylus 2020/G Power 2020', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G Pro 2020'),
  ('Motorola', 'G Stylus 2020'),
  ('Motorola', 'G Power 2020')
) AS v(marca, modelo);

-- Grupo: G6 Play/E5
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G6 Play/E5', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G6 Play'),
  ('Motorola', 'E5')
) AS v(marca, modelo);

-- Grupo: G7/G7 Plus
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G7/G7 Plus', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G7'),
  ('Motorola', 'G7 Plus')
) AS v(marca, modelo);

-- Grupo: G8 Play/One Macro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G8 Play/One Macro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G8 Play'),
  ('Motorola', 'One Macro')
) AS v(marca, modelo);

-- Grupo: G8 Power Lite/One Fusion
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G8 Power Lite/One Fusion', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G8 Power Lite'),
  ('Motorola', 'One Fusion')
) AS v(marca, modelo);

-- Grupo: G9/G Play 2021
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G9/G Play 2021', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G9'),
  ('Motorola', 'G Play 2021')
) AS v(marca, modelo);

-- Grupo: G10/G20/G30/G10 Power
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G10/G20/G30/G10 Power', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G10'),
  ('Motorola', 'G20'),
  ('Motorola', 'G30'),
  ('Motorola', 'G10 Power')
) AS v(marca, modelo);

-- Grupo: G13/G23/G34/G45/G53
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G13/G23/G34/G45/G53', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G13'),
  ('Motorola', 'G23'),
  ('Motorola', 'G34'),
  ('Motorola', 'G45'),
  ('Motorola', 'G53')
) AS v(marca, modelo);

-- Grupo: G14/G32/G54/G54 Power
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G14/G32/G54/G54 Power', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G14'),
  ('Motorola', 'G32'),
  ('Motorola', 'G54'),
  ('Motorola', 'G54 Power')
) AS v(marca, modelo);

-- Grupo: G22/E22S/E32/E32S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G22/E22S/E32/E32S', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G22'),
  ('Motorola', 'E22S'),
  ('Motorola', 'E32'),
  ('Motorola', 'E32S')
) AS v(marca, modelo);

-- Grupo: G31/G41/G71
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G31/G41/G71', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G31'),
  ('Motorola', 'G41'),
  ('Motorola', 'G71')
) AS v(marca, modelo);

-- Grupo: G40 Fusion/G51/G60/G60S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G40 Fusion/G51/G60/G60S', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G40 Fusion'),
  ('Motorola', 'G51'),
  ('Motorola', 'G60'),
  ('Motorola', 'G60S')
) AS v(marca, modelo);

-- Grupo: G52/G71S/G72/G82/Edge 2022/Edge 30
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G52/G71S/G72/G82/Edge 2022/Edge 30', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G52'),
  ('Motorola', 'G71S'),
  ('Motorola', 'G72'),
  ('Motorola', 'G82'),
  ('Motorola', 'Edge 2022'),
  ('Motorola', 'Edge 30')
) AS v(marca, modelo);

-- Grupo: G67/G77
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G67/G77', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G67'),
  ('Motorola', 'G77')
) AS v(marca, modelo);

-- Grupo: G200/Edge S30
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('G200/Edge S30', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'G200'),
  ('Motorola', 'Edge S30')
) AS v(marca, modelo);

-- Grupo: One Action/Vision
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('One Action/Vision', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'One Action'),
  ('Motorola', 'Vision')
) AS v(marca, modelo);

-- Grupo: X Play/X3
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('X Play/X3', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'X Play'),
  ('Motorola', 'X3')
) AS v(marca, modelo);

-- Grupo: Z/Z Power
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Z/Z Power', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Z'),
  ('Motorola', 'Z Power')
) AS v(marca, modelo);

-- ============================================================
-- XIAOMI / REDMI / POCO — 43 grupos
-- ============================================================

-- Grupo: Mi A2/Mi 6X
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Mi A2/Mi 6X', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Mi A2'),
  ('Xiaomi / Redmi / Poco', 'Mi 6X')
) AS v(marca, modelo);

-- Grupo: Mi A2 Lite/Redmi 6 Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Mi A2 Lite/Redmi 6 Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Mi A2 Lite'),
  ('Xiaomi / Redmi / Poco', 'Redmi 6 Pro')
) AS v(marca, modelo);

-- Grupo: Mi 8 Lite/Redmi Note 6
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Mi 8 Lite/Redmi Note 6', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Mi 8 Lite'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 6')
) AS v(marca, modelo);

-- Grupo: Mi 9/Mi 9 Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Mi 9/Mi 9 Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Mi 9'),
  ('Xiaomi / Redmi / Poco', 'Mi 9 Pro')
) AS v(marca, modelo);

-- Grupo: Mi 9T/Mi 9T Pro/Redmi K20/Redmi K20 Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Mi 9T/Mi 9T Pro/Redmi K20/Redmi K20 Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Mi 9T'),
  ('Xiaomi / Redmi / Poco', 'Mi 9T Pro'),
  ('Xiaomi / Redmi / Poco', 'Redmi K20'),
  ('Xiaomi / Redmi / Poco', 'Redmi K20 Pro')
) AS v(marca, modelo);

-- Grupo: Mi 10T/Mi 10T Pro/Redmi K30S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Mi 10T/Mi 10T Pro/Redmi K30S', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Mi 10T'),
  ('Xiaomi / Redmi / Poco', 'Mi 10T Pro'),
  ('Xiaomi / Redmi / Poco', 'Redmi K30S')
) AS v(marca, modelo);

-- Grupo: Mi 11i/Mi 11X/Mi 11X Pro/Poco F3/Poco F4/Redmi K40/Redmi K40S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Mi 11i/Mi 11X/Mi 11X Pro/Poco F3/Poco F4/Redmi K40/Redmi K40S', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Mi 11i'),
  ('Xiaomi / Redmi / Poco', 'Mi 11X'),
  ('Xiaomi / Redmi / Poco', 'Mi 11X Pro'),
  ('Xiaomi / Redmi / Poco', 'Poco F3'),
  ('Xiaomi / Redmi / Poco', 'Poco F4'),
  ('Xiaomi / Redmi / Poco', 'Redmi K40'),
  ('Xiaomi / Redmi / Poco', 'Redmi K40S')
) AS v(marca, modelo);

-- Grupo: Poco C3/Redmi 9A/Redmi 9C/Redmi 9I/Redmi 10A
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco C3/Redmi 9A/Redmi 9C/Redmi 9I/Redmi 10A', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco C3'),
  ('Xiaomi / Redmi / Poco', 'Redmi 9A'),
  ('Xiaomi / Redmi / Poco', 'Redmi 9C'),
  ('Xiaomi / Redmi / Poco', 'Redmi 9I'),
  ('Xiaomi / Redmi / Poco', 'Redmi 10A')
) AS v(marca, modelo);

-- Grupo: Poco C40/Redmi 10 4G/Redmi 10 Power/Redmi 10C
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco C40/Redmi 10 4G/Redmi 10 Power/Redmi 10C', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco C40'),
  ('Xiaomi / Redmi / Poco', 'Redmi 10 4G'),
  ('Xiaomi / Redmi / Poco', 'Redmi 10 Power'),
  ('Xiaomi / Redmi / Poco', 'Redmi 10C')
) AS v(marca, modelo);

-- Grupo: Poco C50/Poco C51/Redmi A1/Redmi A1 Plus/Redmi A2/Redmi A2 Plus
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco C50/Poco C51/Redmi A1/Redmi A1 Plus/Redmi A2/Redmi A2 Plus', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco C50'),
  ('Xiaomi / Redmi / Poco', 'Poco C51'),
  ('Xiaomi / Redmi / Poco', 'Redmi A1'),
  ('Xiaomi / Redmi / Poco', 'Redmi A1 Plus'),
  ('Xiaomi / Redmi / Poco', 'Redmi A2'),
  ('Xiaomi / Redmi / Poco', 'Redmi A2 Plus')
) AS v(marca, modelo);

-- Grupo: Poco C55/Poco C61/Redmi 12C/Redmi A3/Redmi A3X
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco C55/Poco C61/Redmi 12C/Redmi A3/Redmi A3X', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco C55'),
  ('Xiaomi / Redmi / Poco', 'Poco C61'),
  ('Xiaomi / Redmi / Poco', 'Redmi 12C'),
  ('Xiaomi / Redmi / Poco', 'Redmi A3'),
  ('Xiaomi / Redmi / Poco', 'Redmi A3X')
) AS v(marca, modelo);

-- Grupo: Poco C65/Poco M6 5G/Redmi 13C 4G-5G/Redmi 13R 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco C65/Poco M6 5G/Redmi 13C 4G-5G/Redmi 13R 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco C65'),
  ('Xiaomi / Redmi / Poco', 'Poco M6 5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi 13C 4G-5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi 13R 5G')
) AS v(marca, modelo);

-- Grupo: Poco C71/Poco C75/Poco M7 5G/Redmi 14C 4G-5G/Redmi 14R/Redmi A4 5G/Redmi A5 4G/Redmi A3 Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco C71/Poco C75/Poco M7 5G/Redmi 14C 4G-5G/Redmi 14R/Redmi A4 5G/Redmi A5 4G/Redmi A3 Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco C71'),
  ('Xiaomi / Redmi / Poco', 'Poco C75'),
  ('Xiaomi / Redmi / Poco', 'Poco M7 5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi 14C 4G-5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi 14R'),
  ('Xiaomi / Redmi / Poco', 'Redmi A4 5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi A5 4G'),
  ('Xiaomi / Redmi / Poco', 'Redmi A3 Pro')
) AS v(marca, modelo);

-- Grupo: Poco C85/Redmi 15C 4G-5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco C85/Redmi 15C 4G-5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco C85'),
  ('Xiaomi / Redmi / Poco', 'Redmi 15C 4G-5G')
) AS v(marca, modelo);

-- Grupo: Poco F2 Pro/Redmi K30 Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco F2 Pro/Redmi K30 Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco F2 Pro'),
  ('Xiaomi / Redmi / Poco', 'Redmi K30 Pro')
) AS v(marca, modelo);

-- Grupo: Poco F3 GT/Poco F3 Game/Redmi K40 Gaming
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco F3 GT/Poco F3 Game/Redmi K40 Gaming', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco F3 GT'),
  ('Xiaomi / Redmi / Poco', 'Poco F3 Game'),
  ('Xiaomi / Redmi / Poco', 'Redmi K40 Gaming')
) AS v(marca, modelo);

-- Grupo: Poco F5/Poco M6 Pro 4G/Redmi Note 12 Turbo/Redmi Note 13 Pro 4G/Redmi Note 13 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco F5/Poco M6 Pro 4G/Redmi Note 12 Turbo/Redmi Note 13 Pro 4G/Redmi Note 13 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco F5'),
  ('Xiaomi / Redmi / Poco', 'Poco M6 Pro 4G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 12 Turbo'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 13 Pro 4G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 13 5G')
) AS v(marca, modelo);

-- Grupo: Poco F5 Pro/Redmi K60
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco F5 Pro/Redmi K60', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco F5 Pro'),
  ('Xiaomi / Redmi / Poco', 'Redmi K60')
) AS v(marca, modelo);

-- Grupo: Poco F6/Poco X6 Pro/Redmi K70E/Redmi Turbo 3
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco F6/Poco X6 Pro/Redmi K70E/Redmi Turbo 3', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco F6'),
  ('Xiaomi / Redmi / Poco', 'Poco X6 Pro'),
  ('Xiaomi / Redmi / Poco', 'Redmi K70E'),
  ('Xiaomi / Redmi / Poco', 'Redmi Turbo 3')
) AS v(marca, modelo);

-- Grupo: Poco M3/Redmi 9 Power/Redmi 9T/Redmi 9T Global/Redmi Note 9 4G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco M3/Redmi 9 Power/Redmi 9T/Redmi 9T Global/Redmi Note 9 4G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco M3'),
  ('Xiaomi / Redmi / Poco', 'Redmi 9 Power'),
  ('Xiaomi / Redmi / Poco', 'Redmi 9T'),
  ('Xiaomi / Redmi / Poco', 'Redmi 9T Global'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 9 4G')
) AS v(marca, modelo);

-- Grupo: Poco M3 Pro/Redmi 10 Prime/Redmi Note 10 5G/Redmi Note 10T/Redmi Note 11SE
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco M3 Pro/Redmi 10 Prime/Redmi Note 10 5G/Redmi Note 10T/Redmi Note 11SE', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco M3 Pro'),
  ('Xiaomi / Redmi / Poco', 'Redmi 10 Prime'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 10 5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 10T'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 11SE')
) AS v(marca, modelo);

-- Grupo: Poco M4/Poco M5/Redmi 10 5G/Redmi 11 Prime/Redmi Note 11E
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco M4/Poco M5/Redmi 10 5G/Redmi 11 Prime/Redmi Note 11E', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco M4'),
  ('Xiaomi / Redmi / Poco', 'Poco M5'),
  ('Xiaomi / Redmi / Poco', 'Redmi 10 5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi 11 Prime'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 11E')
) AS v(marca, modelo);

-- Grupo: Poco M4 Pro 4G/Poco M5S/Redmi Note 10 4G/Redmi Note 10S/Redmi Note 11 4G/NT11S 4G/NT12S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco M4 Pro 4G/Poco M5S/Redmi Note 10 4G/Redmi Note 10S/Redmi Note 11 4G/NT11S 4G/NT12S', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco M4 Pro 4G'),
  ('Xiaomi / Redmi / Poco', 'Poco M5S'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 10 4G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 10S'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 11 4G'),
  ('Xiaomi / Redmi / Poco', 'NT11S 4G'),
  ('Xiaomi / Redmi / Poco', 'NT12S')
) AS v(marca, modelo);

-- Grupo: Poco M4 Pro 5G/Poco X3 GT/Redmi Note 10 Pro 5G/Redmi Note 11 5G/Redmi Note 11T 5G/Redmi Note 11S 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco M4 Pro 5G/Poco X3 GT/Redmi Note 10 Pro 5G/Redmi Note 11 5G/Redmi Note 11T 5G/Redmi Note 11S 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco M4 Pro 5G'),
  ('Xiaomi / Redmi / Poco', 'Poco X3 GT'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 10 Pro 5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 11 5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 11T 5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 11S 5G')
) AS v(marca, modelo);

-- Grupo: Poco M6 4G/Poco M6 Plus/Poco M6 Pro 5G/Redmi 12/Redmi 12R/Redmi 13/Redmi Note 12R/Redmi Note 13R
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco M6 4G/Poco M6 Plus/Poco M6 Pro 5G/Redmi 12/Redmi 12R/Redmi 13/Redmi Note 12R/Redmi Note 13R', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco M6 4G'),
  ('Xiaomi / Redmi / Poco', 'Poco M6 Plus'),
  ('Xiaomi / Redmi / Poco', 'Poco M6 Pro 5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi 12'),
  ('Xiaomi / Redmi / Poco', 'Redmi 12R'),
  ('Xiaomi / Redmi / Poco', 'Redmi 13'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 12R'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 13R')
) AS v(marca, modelo);

-- Grupo: Poco X3/Poco X3 NFC/Poco X3 Pro/Mi 10T Lite/Redmi Note 9 Pro 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco X3/Poco X3 NFC/Poco X3 Pro/Mi 10T Lite/Redmi Note 9 Pro 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco X3'),
  ('Xiaomi / Redmi / Poco', 'Poco X3 NFC'),
  ('Xiaomi / Redmi / Poco', 'Poco X3 Pro'),
  ('Xiaomi / Redmi / Poco', 'Mi 10T Lite'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 9 Pro 5G')
) AS v(marca, modelo);

-- Grupo: Poco X4 GT/Redmi Note 11T Pro/Redmi Note 11T Pro Plus/Redmi Note 12T Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco X4 GT/Redmi Note 11T Pro/Redmi Note 11T Pro Plus/Redmi Note 12T Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco X4 GT'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 11T Pro'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 11T Pro Plus'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 12T Pro')
) AS v(marca, modelo);

-- Grupo: Poco X4 Pro/Redmi Note 10 Pro 4G/Redmi Note 10 Pro Max / Global/Redmi Note 11 Pro/Redmi Note 11 Pro Plus/Redmi Note 12 Pro 4G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco X4 Pro/Redmi Note 10 Pro 4G/Redmi Note 10 Pro Max / Global/Redmi Note 11 Pro/Redmi Note 11 Pro Plus/Redmi Note 12 Pro 4G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco X4 Pro'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 10 Pro 4G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 10 Pro Max / Global'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 11 Pro'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 11 Pro Plus'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 12 Pro 4G')
) AS v(marca, modelo);

-- Grupo: Poco X5/Redmi Note 12 4G/5G/Redmi Note 12R Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco X5/Redmi Note 12 4G/5G/Redmi Note 12R Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco X5'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 12 4G/5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 12R Pro')
) AS v(marca, modelo);

-- Grupo: Poco X5 Pro/Redmi Note 12 Pro 5G/Redmi Note 12 Pro Speed/Redmi Note 12 Pro Plus
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco X5 Pro/Redmi Note 12 Pro 5G/Redmi Note 12 Pro Speed/Redmi Note 12 Pro Plus', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco X5 Pro'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 12 Pro 5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 12 Pro Speed'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 12 Pro Plus')
) AS v(marca, modelo);

-- Grupo: Poco X6/Redmi Note 13 Pro 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco X6/Redmi Note 13 Pro 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco X6'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 13 Pro 5G')
) AS v(marca, modelo);

-- Grupo: Poco X7 5G/Redmi Note 13 Pro Plus/Redmi Note 14 Pro 5G/Redmi Note 14 Pro Plus
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Poco X7 5G/Redmi Note 13 Pro Plus/Redmi Note 14 Pro 5G/Redmi Note 14 Pro Plus', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Poco X7 5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 13 Pro Plus'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 14 Pro 5G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 14 Pro Plus')
) AS v(marca, modelo);

-- Grupo: Redmi 6/Redmi 6A
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Redmi 6/Redmi 6A', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Redmi 6'),
  ('Xiaomi / Redmi / Poco', 'Redmi 6A')
) AS v(marca, modelo);

-- Grupo: Redmi 8/Redmi 8A
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Redmi 8/Redmi 8A', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Redmi 8'),
  ('Xiaomi / Redmi / Poco', 'Redmi 8A')
) AS v(marca, modelo);

-- Grupo: Redmi 10X/Redmi Note 9 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Redmi 10X/Redmi Note 9 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Redmi 10X'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 9 5G')
) AS v(marca, modelo);

-- Grupo: Redmi Note 5/Redmi Note 5 Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Redmi Note 5/Redmi Note 5 Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Redmi Note 5'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 5 Pro')
) AS v(marca, modelo);

-- Grupo: Redmi Note 7/Redmi Note 7 Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Redmi Note 7/Redmi Note 7 Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Redmi Note 7'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 7 Pro')
) AS v(marca, modelo);

-- Grupo: Redmi Note 9 Pro 4G/Redmi Note 9 Pro Max/Redmi Note 9S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Redmi Note 9 Pro 4G/Redmi Note 9 Pro Max/Redmi Note 9S', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Redmi Note 9 Pro 4G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 9 Pro Max'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 9S')
) AS v(marca, modelo);

-- Grupo: Redmi Note 13 4G/Redmi Note 14 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Redmi Note 13 4G/Redmi Note 14 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Redmi Note 13 4G'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 14 5G')
) AS v(marca, modelo);

-- Grupo: Redmi Note 14S/Redmi Note 12T
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Redmi Note 14S/Redmi Note 12T', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Redmi Note 14S'),
  ('Xiaomi / Redmi / Poco', 'Redmi Note 12T')
) AS v(marca, modelo);

-- Grupo: Xiaomi 11T/Xiaomi 11T Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Xiaomi 11T/Xiaomi 11T Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Xiaomi 11T'),
  ('Xiaomi / Redmi / Poco', 'Xiaomi 11T Pro')
) AS v(marca, modelo);

-- Grupo: Xiaomi 13T/Xiaomi 13T Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Xiaomi 13T/Xiaomi 13T Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Xiaomi 13T'),
  ('Xiaomi / Redmi / Poco', 'Xiaomi 13T Pro')
) AS v(marca, modelo);

-- Grupo: Xiaomi 14T/Xiaomi 14T Pro/Redmi K70 Ultra
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Xiaomi 14T/Xiaomi 14T Pro/Redmi K70 Ultra', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi / Redmi / Poco', 'Xiaomi 14T'),
  ('Xiaomi / Redmi / Poco', 'Xiaomi 14T Pro'),
  ('Xiaomi / Redmi / Poco', 'Redmi K70 Ultra')
) AS v(marca, modelo);

-- ============================================================
-- LG — 7 grupos
-- ============================================================

-- Grupo: K9/K8 2018
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('K9/K8 2018', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('LG', 'K9'),
  ('LG', 'K8 2018')
) AS v(marca, modelo);

-- Grupo: K11/K11 Plus/K11 Alpha/K10 2018
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('K11/K11 Plus/K11 Alpha/K10 2018', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('LG', 'K11'),
  ('LG', 'K11 Plus'),
  ('LG', 'K11 Alpha'),
  ('LG', 'K10 2018')
) AS v(marca, modelo);

-- Grupo: K12/K12 Plus/K40
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('K12/K12 Plus/K40', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('LG', 'K12'),
  ('LG', 'K12 Plus'),
  ('LG', 'K40')
) AS v(marca, modelo);

-- Grupo: K12 Max/K12 Prime/K50
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('K12 Max/K12 Prime/K50', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('LG', 'K12 Max'),
  ('LG', 'K12 Prime'),
  ('LG', 'K50')
) AS v(marca, modelo);

-- Grupo: K22/K22 Plus
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('K22/K22 Plus', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('LG', 'K22'),
  ('LG', 'K22 Plus')
) AS v(marca, modelo);

-- Grupo: K42/K52/K62/K62 Plus
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('K42/K52/K62/K62 Plus', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('LG', 'K42'),
  ('LG', 'K52'),
  ('LG', 'K62'),
  ('LG', 'K62 Plus')
) AS v(marca, modelo);

-- Grupo: Q7/Q7 Plus
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Q7/Q7 Plus', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('LG', 'Q7'),
  ('LG', 'Q7 Plus')
) AS v(marca, modelo);

-- ============================================================
-- REALME — 18 grupos
-- ============================================================

-- Grupo: Realme 6 Pro/Realme X50 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme 6 Pro/Realme X50 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme 6 Pro'),
  ('Realme', 'Realme X50 5G')
) AS v(marca, modelo);

-- Grupo: Realme 7i/Realme C17/Realme A32
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme 7i/Realme C17/Realme A32', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme 7i'),
  ('Realme', 'Realme C17'),
  ('Realme', 'Realme A32')
) AS v(marca, modelo);

-- Grupo: Realme 8 4G/Realme 8 Pro 4G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme 8 4G/Realme 8 Pro 4G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme 8 4G'),
  ('Realme', 'Realme 8 Pro 4G')
) AS v(marca, modelo);

-- Grupo: Realme 9 4G/Realme 9 Pro Plus/Realme 10 4G/Realme 11 4G/Narzo 50 Pro 4G-5G/Narzo 60
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme 9 4G/Realme 9 Pro Plus/Realme 10 4G/Realme 11 4G/Narzo 50 Pro 4G-5G/Narzo 60', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme 9 4G'),
  ('Realme', 'Realme 9 Pro Plus'),
  ('Realme', 'Realme 10 4G'),
  ('Realme', 'Realme 11 4G'),
  ('Realme', 'Narzo 50 Pro 4G-5G'),
  ('Realme', 'Narzo 60')
) AS v(marca, modelo);

-- Grupo: Realme 9 5G/Realme 9 Pro/Realme 9i/Realme Q5/Realme V25
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme 9 5G/Realme 9 Pro/Realme 9i/Realme Q5/Realme V25', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme 9 5G'),
  ('Realme', 'Realme 9 Pro'),
  ('Realme', 'Realme 9i'),
  ('Realme', 'Realme Q5'),
  ('Realme', 'Realme V25')
) AS v(marca, modelo);

-- Grupo: Realme 9i 5G/Realme 10 5G/Realme 10S/Realme 10T/Realme C30/Realme C30S/Realme C33/Realme C33 2023/Realme V20/Realme V30/Narzo 50i Prime
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme 9i 5G/Realme 10 5G/Realme 10S/Realme 10T/Realme C30/Realme C30S/Realme C33/Realme C33 2023/Realme V20/Realme V30/Narzo 50i Prime', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme 9i 5G'),
  ('Realme', 'Realme 10 5G'),
  ('Realme', 'Realme 10S'),
  ('Realme', 'Realme 10T'),
  ('Realme', 'Realme C30'),
  ('Realme', 'Realme C30S'),
  ('Realme', 'Realme C33'),
  ('Realme', 'Realme C33 2023'),
  ('Realme', 'Realme V20'),
  ('Realme', 'Realme V30'),
  ('Realme', 'Narzo 50i Prime')
) AS v(marca, modelo);

-- Grupo: Realme 10 Pro Plus/Realme 11 Pro/Realme 11 Pro Plus/Realme 12 Pro/Realme 12 Pro Plus/Narzo 60 Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme 10 Pro Plus/Realme 11 Pro/Realme 11 Pro Plus/Realme 12 Pro/Realme 12 Pro Plus/Narzo 60 Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme 10 Pro Plus'),
  ('Realme', 'Realme 11 Pro'),
  ('Realme', 'Realme 11 Pro Plus'),
  ('Realme', 'Realme 12 Pro'),
  ('Realme', 'Realme 12 Pro Plus'),
  ('Realme', 'Narzo 60 Pro')
) AS v(marca, modelo);

-- Grupo: Realme 11 5G/Realme 11X 5G/Realme 12 Lite/Realme C55/Realme C67/Realme C67 4G/Realme C75 4G/Narzo 60X/Narzo 70X/Narzo N55/Realme V50/Realme V50s
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme 11 5G/Realme 11X 5G/Realme 12 Lite/Realme C55/Realme C67/Realme C67 4G/Realme C75 4G/Narzo 60X/Narzo 70X/Narzo N55/Realme V50/Realme V50s', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme 11 5G'),
  ('Realme', 'Realme 11X 5G'),
  ('Realme', 'Realme 12 Lite'),
  ('Realme', 'Realme C55'),
  ('Realme', 'Realme C67'),
  ('Realme', 'Realme C67 4G'),
  ('Realme', 'Realme C75 4G'),
  ('Realme', 'Narzo 60X'),
  ('Realme', 'Narzo 70X'),
  ('Realme', 'Narzo N55'),
  ('Realme', 'Realme V50'),
  ('Realme', 'Realme V50s')
) AS v(marca, modelo);

-- Grupo: Realme 12+/Realme 12 4G/Realme 13 4G/Realme 13+/Realme 14/Realme P1/Realme P1 Speed/Realme P3/Realme Neo 7X/Narzo 70/Narzo 70 Pro/Narzo 70 Turbo/Narzo N70
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme 12+/Realme 12 4G/Realme 13 4G/Realme 13+/Realme 14/Realme P1/Realme P1 Speed/Realme P3/Realme Neo 7X/Narzo 70/Narzo 70 Pro/Narzo 70 Turbo/Narzo N70', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme 12+'),
  ('Realme', 'Realme 12 4G'),
  ('Realme', 'Realme 13 4G'),
  ('Realme', 'Realme 13+'),
  ('Realme', 'Realme 14'),
  ('Realme', 'Realme P1'),
  ('Realme', 'Realme P1 Speed'),
  ('Realme', 'Realme P3'),
  ('Realme', 'Realme Neo 7X'),
  ('Realme', 'Narzo 70'),
  ('Realme', 'Narzo 70 Pro'),
  ('Realme', 'Narzo 70 Turbo'),
  ('Realme', 'Narzo N70')
) AS v(marca, modelo);

-- Grupo: Realme C3/Realme A11/Realme A11I/Realme 5/Realme 5I/Realme 5S/Realme 6I/Realme A55
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme C3/Realme A11/Realme A11I/Realme 5/Realme 5I/Realme 5S/Realme 6I/Realme A55', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme C3'),
  ('Realme', 'Realme A11'),
  ('Realme', 'Realme A11I'),
  ('Realme', 'Realme 5'),
  ('Realme', 'Realme 5I'),
  ('Realme', 'Realme 5S'),
  ('Realme', 'Realme 6I'),
  ('Realme', 'Realme A55')
) AS v(marca, modelo);

-- Grupo: Realme C11 2020/Realme C12/Realme C15/Realme A15/Realme A15S/Realme A16/Realme C21/Realme C21Y/Realme C25/Realme C25Y
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme C11 2020/Realme C12/Realme C15/Realme A15/Realme A15S/Realme A16/Realme C21/Realme C21Y/Realme C25/Realme C25Y', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme C11 2020'),
  ('Realme', 'Realme C12'),
  ('Realme', 'Realme C15'),
  ('Realme', 'Realme A15'),
  ('Realme', 'Realme A15S'),
  ('Realme', 'Realme A16'),
  ('Realme', 'Realme C21'),
  ('Realme', 'Realme C21Y'),
  ('Realme', 'Realme C25'),
  ('Realme', 'Realme C25Y')
) AS v(marca, modelo);

-- Grupo: Realme C11 2021/Realme C20/Realme C20A
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme C11 2021/Realme C20/Realme C20A', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme C11 2021'),
  ('Realme', 'Realme C20'),
  ('Realme', 'Realme C20A')
) AS v(marca, modelo);

-- Grupo: Realme C35/Realme Q5i/Realme V23/Realme V23i/Narzo 50/Narzo 50 5G/Narzo 50A Prime
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme C35/Realme Q5i/Realme V23/Realme V23i/Narzo 50/Narzo 50 5G/Narzo 50A Prime', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme C35'),
  ('Realme', 'Realme Q5i'),
  ('Realme', 'Realme V23'),
  ('Realme', 'Realme V23i'),
  ('Realme', 'Narzo 50'),
  ('Realme', 'Narzo 50 5G'),
  ('Realme', 'Narzo 50A Prime')
) AS v(marca, modelo);

-- Grupo: Realme C51/Realme C51S/Realme C53/Realme C61/Realme C63 4G/Realme Note 50/Realme Note 60/Realme Note 60X/Narzo N53/Narzo N61/Narzo N63
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme C51/Realme C51S/Realme C53/Realme C61/Realme C63 4G/Realme Note 50/Realme Note 60/Realme Note 60X/Narzo N53/Narzo N61/Narzo N63', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme C51'),
  ('Realme', 'Realme C51S'),
  ('Realme', 'Realme C53'),
  ('Realme', 'Realme C61'),
  ('Realme', 'Realme C63 4G'),
  ('Realme', 'Realme Note 50'),
  ('Realme', 'Realme Note 60'),
  ('Realme', 'Realme Note 60X'),
  ('Realme', 'Narzo N53'),
  ('Realme', 'Narzo N61'),
  ('Realme', 'Narzo N63')
) AS v(marca, modelo);

-- Grupo: Realme C65 4G-5G/Realme C71/Realme C63 5G/Realme C75x/Realme 12X/Realme 14X/Realme V60/Realme V60 Pro/Realme V60S/N65 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme C65 4G-5G/Realme C71/Realme C63 5G/Realme C75x/Realme 12X/Realme 14X/Realme V60/Realme V60 Pro/Realme V60S/N65 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme C65 4G-5G'),
  ('Realme', 'Realme C71'),
  ('Realme', 'Realme C63 5G'),
  ('Realme', 'Realme C75x'),
  ('Realme', 'Realme 12X'),
  ('Realme', 'Realme 14X'),
  ('Realme', 'Realme V60'),
  ('Realme', 'Realme V60 Pro'),
  ('Realme', 'Realme V60S'),
  ('Realme', 'N65 5G')
) AS v(marca, modelo);

-- Grupo: Realme GT 5 Pro/Realme GT Neo 6/Realme Neo 6 SE
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme GT 5 Pro/Realme GT Neo 6/Realme Neo 6 SE', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme GT 5 Pro'),
  ('Realme', 'Realme GT Neo 6'),
  ('Realme', 'Realme Neo 6 SE')
) AS v(marca, modelo);

-- Grupo: Realme GT Neo 3T/Realme GT2/Realme Q5 Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme GT Neo 3T/Realme GT2/Realme Q5 Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme GT Neo 3T'),
  ('Realme', 'Realme GT2'),
  ('Realme', 'Realme Q5 Pro')
) AS v(marca, modelo);

-- Grupo: Realme GT Neo 5/Realme GT Neo 5 SE/Realme GT3/Realme GT5
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Realme GT Neo 5/Realme GT Neo 5 SE/Realme GT3/Realme GT5', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Realme', 'Realme GT Neo 5'),
  ('Realme', 'Realme GT Neo 5 SE'),
  ('Realme', 'Realme GT3'),
  ('Realme', 'Realme GT5')
) AS v(marca, modelo);

-- ============================================================
-- INFINIX — 15 grupos
-- ============================================================

-- Grupo: Infinix GT 10 Pro/Infinix Note 30 Pro/Infinix Note 30 VIP
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix GT 10 Pro/Infinix Note 30 Pro/Infinix Note 30 VIP', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix GT 10 Pro'),
  ('Infinix', 'Infinix Note 30 Pro'),
  ('Infinix', 'Infinix Note 30 VIP')
) AS v(marca, modelo);

-- Grupo: Infinix GT 20 Pro/Infinix Camon 30 Pro/Infinix Note 40/Infinix Note 50 4G/Infinix Note 50 Pro 4G/Infinix Note 50 Pro+/CL8/CM5/X6853/X6855/X6856/X6858
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix GT 20 Pro/Infinix Camon 30 Pro/Infinix Note 40/Infinix Note 50 4G/Infinix Note 50 Pro 4G/Infinix Note 50 Pro+/CL8/CM5/X6853/X6855/X6856/X6858', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix GT 20 Pro'),
  ('Infinix', 'Infinix Camon 30 Pro'),
  ('Infinix', 'Infinix Note 40'),
  ('Infinix', 'Infinix Note 50 4G'),
  ('Infinix', 'Infinix Note 50 Pro 4G'),
  ('Infinix', 'Infinix Note 50 Pro+'),
  ('Infinix', 'CL8'),
  ('Infinix', 'CM5'),
  ('Infinix', 'X6853'),
  ('Infinix', 'X6855'),
  ('Infinix', 'X6856'),
  ('Infinix', 'X6858')
) AS v(marca, modelo);

-- Grupo: Infinix Hot 12/Infinix Hot 12 Play/Infinix Hot 12 Play NFC/Infinix Hot 20/Infinix Hot 30 Play/Infinix Hot 30 Play NFC/Infinix Note 12i
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix Hot 12/Infinix Hot 12 Play/Infinix Hot 12 Play NFC/Infinix Hot 20/Infinix Hot 30 Play/Infinix Hot 30 Play NFC/Infinix Note 12i', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix Hot 12'),
  ('Infinix', 'Infinix Hot 12 Play'),
  ('Infinix', 'Infinix Hot 12 Play NFC'),
  ('Infinix', 'Infinix Hot 20'),
  ('Infinix', 'Infinix Hot 30 Play'),
  ('Infinix', 'Infinix Hot 30 Play NFC'),
  ('Infinix', 'Infinix Note 12i')
) AS v(marca, modelo);

-- Grupo: Infinix Hot 12 Pro/Infinix 12i/Infinix 20i/Infinix 10i/Infinix Smart 5 (India)/Infinix Smart 6/Infinix Smart 6 HD
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix Hot 12 Pro/Infinix 12i/Infinix 20i/Infinix 10i/Infinix Smart 5 (India)/Infinix Smart 6/Infinix Smart 6 HD', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix Hot 12 Pro'),
  ('Infinix', 'Infinix 12i'),
  ('Infinix', 'Infinix 20i'),
  ('Infinix', 'Infinix 10i'),
  ('Infinix', 'Infinix Smart 5 (India)'),
  ('Infinix', 'Infinix Smart 6'),
  ('Infinix', 'Infinix Smart 6 HD')
) AS v(marca, modelo);

-- Grupo: Infinix Hot 20 Play/Infinix 20S/Infinix 11S/Infinix Zero 2023/5G-X6815/X6815B/5G 2023-X6815C/X Neo
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix Hot 20 Play/Infinix 20S/Infinix 11S/Infinix Zero 2023/5G-X6815/X6815B/5G 2023-X6815C/X Neo', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix Hot 20 Play'),
  ('Infinix', 'Infinix 20S'),
  ('Infinix', 'Infinix 11S'),
  ('Infinix', 'Infinix Zero 2023'),
  ('Infinix', '5G-X6815'),
  ('Infinix', 'X6815B'),
  ('Infinix', '5G 2023-X6815C'),
  ('Infinix', 'X Neo')
) AS v(marca, modelo);

-- Grupo: Infinix Hot 30/Infinix Hot 30 5G/Infinix Hot 40/Infinix Hot 40 Pro/Infinix Note 30/Infinix Note 30 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix Hot 30/Infinix Hot 30 5G/Infinix Hot 40/Infinix Hot 40 Pro/Infinix Note 30/Infinix Note 30 5G', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix Hot 30'),
  ('Infinix', 'Infinix Hot 30 5G'),
  ('Infinix', 'Infinix Hot 40'),
  ('Infinix', 'Infinix Hot 40 Pro'),
  ('Infinix', 'Infinix Note 30'),
  ('Infinix', 'Infinix Note 30 5G')
) AS v(marca, modelo);

-- Grupo: Infinix itel Zeno100/a100c
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix itel Zeno100/a100c', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix itel Zeno100'),
  ('Infinix', 'a100c')
) AS v(marca, modelo);

-- Grupo: Infinix itel City 200/smart20
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix itel City 200/smart20', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix itel City 200'),
  ('Infinix', 'smart20')
) AS v(marca, modelo);

-- Grupo: Infinix Note 30i/Infinix Note 11/Infinix Note 12 2023/Infinix Note 12 5G/Infinix Note 12 G88/Infinix Note 12 G96/Infinix Note 12 Pro 4G/Infinix Note 12 Pro 5G/Infinix Note 12i 2022/Infinix Zero 20
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix Note 30i/Infinix Note 11/Infinix Note 12 2023/Infinix Note 12 5G/Infinix Note 12 G88/Infinix Note 12 G96/Infinix Note 12 Pro 4G/Infinix Note 12 Pro 5G/Infinix Note 12i 2022/Infinix Zero 20', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix Note 30i'),
  ('Infinix', 'Infinix Note 11'),
  ('Infinix', 'Infinix Note 12 2023'),
  ('Infinix', 'Infinix Note 12 5G'),
  ('Infinix', 'Infinix Note 12 G88'),
  ('Infinix', 'Infinix Note 12 G96'),
  ('Infinix', 'Infinix Note 12 Pro 4G'),
  ('Infinix', 'Infinix Note 12 Pro 5G'),
  ('Infinix', 'Infinix Note 12i 2022'),
  ('Infinix', 'Infinix Zero 20')
) AS v(marca, modelo);

-- Grupo: Infinix Smart 6 Plus (India)/Infinix Hot 10 Play/Infinix 10S/Infinix 10S NFC/Infinix 10T/Infinix 11 Play
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix Smart 6 Plus (India)/Infinix Hot 10 Play/Infinix 10S/Infinix 10S NFC/Infinix 10T/Infinix 11 Play', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix Smart 6 Plus (India)'),
  ('Infinix', 'Infinix Hot 10 Play'),
  ('Infinix', 'Infinix 10S'),
  ('Infinix', 'Infinix 10S NFC'),
  ('Infinix', 'Infinix 10T'),
  ('Infinix', 'Infinix 11 Play')
) AS v(marca, modelo);

-- Grupo: Infinix Smart 7/Infinix Smart 7 (India)/Infinix Smart 7 HD/Infinix Hot 30i
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix Smart 7/Infinix Smart 7 (India)/Infinix Smart 7 HD/Infinix Hot 30i', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix Smart 7'),
  ('Infinix', 'Infinix Smart 7 (India)'),
  ('Infinix', 'Infinix Smart 7 HD'),
  ('Infinix', 'Infinix Hot 30i')
) AS v(marca, modelo);

-- Grupo: Infinix Smart 8/Infinix Smart 8 HD/Infinix Smart 8 (India)/Infinix Smart 8 Pro/Infinix Hot 40i
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix Smart 8/Infinix Smart 8 HD/Infinix Smart 8 (India)/Infinix Smart 8 Pro/Infinix Hot 40i', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix Smart 8'),
  ('Infinix', 'Infinix Smart 8 HD'),
  ('Infinix', 'Infinix Smart 8 (India)'),
  ('Infinix', 'Infinix Smart 8 Pro'),
  ('Infinix', 'Infinix Hot 40i')
) AS v(marca, modelo);

-- Grupo: Infinix Smart 9/Infinix Hot 50 5G/Infinix Hot 50i
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix Smart 9/Infinix Hot 50 5G/Infinix Hot 50i', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix Smart 9'),
  ('Infinix', 'Infinix Hot 50 5G'),
  ('Infinix', 'Infinix Hot 50i')
) AS v(marca, modelo);

-- Grupo: Infinix Smart 10/Infinix Hot 60i/Infinix Smart 10 Plus
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix Smart 10/Infinix Hot 60i/Infinix Smart 10 Plus', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix Smart 10'),
  ('Infinix', 'Infinix Hot 60i'),
  ('Infinix', 'Infinix Smart 10 Plus')
) AS v(marca, modelo);

-- Grupo: Infinix Zero X/Infinix Zero X Pro
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Infinix Zero X/Infinix Zero X Pro', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Infinix', 'Infinix Zero X'),
  ('Infinix', 'Infinix Zero X Pro')
) AS v(marca, modelo);

-- ============================================================
-- ITEL / TECNO — 2 grupos
-- ============================================================

-- Grupo: Itel Zeno100/a100c
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Itel Zeno100/a100c', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Itel / Tecno', 'Itel Zeno100'),
  ('Itel / Tecno', 'a100c')
) AS v(marca, modelo);

-- Grupo: Itel A200/A675L/Itel A200+/A675L/Spark Go 3/Tecno Pop 20/Tecno Pop X 4G (KN3)/Tecno Pop X 5G (KN8)/Tecno Spark 50 5G NFC (KN8n)/hot60i 5G/Spark Go 5G/KM8
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Itel A200/A675L/Itel A200+/A675L/Spark Go 3/Tecno Pop 20/Tecno Pop X 4G (KN3)/Tecno Pop X 5G (KN8)/Tecno Spark 50 5G NFC (KN8n)/hot60i 5G/Spark Go 5G/KM8', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Itel / Tecno', 'Itel A200/A675L'),
  ('Itel / Tecno', 'Itel A200+/A675L'),
  ('Itel / Tecno', 'Spark Go 3'),
  ('Itel / Tecno', 'Tecno Pop 20'),
  ('Itel / Tecno', 'Tecno Pop X 4G (KN3)'),
  ('Itel / Tecno', 'Tecno Pop X 5G (KN8)'),
  ('Itel / Tecno', 'Tecno Spark 50 5G NFC (KN8n)'),
  ('Itel / Tecno', 'hot60i 5G'),
  ('Itel / Tecno', 'Spark Go 5G'),
  ('Itel / Tecno', 'KM8')
) AS v(marca, modelo);

-- ============================================================
-- ASUS — 2 grupos
-- ============================================================

-- Grupo: Zenfone Live L1/Zenfone Max M1
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Zenfone Live L1/Zenfone Max M1', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Asus', 'Zenfone Live L1'),
  ('Asus', 'Zenfone Max M1')
) AS v(marca, modelo);

-- Grupo: Zenfone Max Shot/Zenfone Max Plus M2
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Zenfone Max Shot/Zenfone Max Plus M2', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Asus', 'Zenfone Max Shot'),
  ('Asus', 'Zenfone Max Plus M2')
) AS v(marca, modelo);

-- ============================================================
-- HUAWEI / HONOR — 3 grupos
-- ============================================================

-- Grupo: Honor 50 Lite/Honor Play5 Youth/Honor X20
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Honor 50 Lite/Honor Play5 Youth/Honor X20', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Huawei / Honor', 'Honor 50 Lite'),
  ('Huawei / Honor', 'Honor Play5 Youth'),
  ('Huawei / Honor', 'Honor X20')
) AS v(marca, modelo);

-- Grupo: Honor Magic3/Honor Magic3 Pro/Honor Magic3 Pro+
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Honor Magic3/Honor Magic3 Pro/Honor Magic3 Pro+', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Huawei / Honor', 'Honor Magic3'),
  ('Huawei / Honor', 'Honor Magic3 Pro'),
  ('Huawei / Honor', 'Honor Magic3 Pro+')
) AS v(marca, modelo);

-- Grupo: Honor V40 5G/Honor V40 Lite
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome, tipo)
  VALUES ('Honor V40 5G/Honor V40 Lite', 'vidro')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Huawei / Honor', 'Honor V40 5G'),
  ('Huawei / Honor', 'Honor V40 Lite')
) AS v(marca, modelo);

-- ============================================================
-- Conferência final (aborta a transação se algo não bater)
-- ============================================================
DO $$
DECLARE
  v_grupos integer;
  v_vinculos integer;
  v_pel_grupos integer;
  v_pel_vinculos integer;
  v_pel_grupos_antes integer;
  v_pel_vinculos_antes integer;
BEGIN
  SELECT count(*) INTO v_grupos FROM public.grupos_compatibilidade_pelicula WHERE tipo = 'vidro';
  SELECT count(*) INTO v_vinculos FROM public.grupo_compatibilidade_modelos m
    JOIN public.grupos_compatibilidade_pelicula g ON g.id = m.grupo_id
   WHERE g.tipo = 'vidro';
  IF v_grupos <> 167 OR v_vinculos <> 631 THEN
    RAISE EXCEPTION 'Conferência falhou: % grupos e % vínculos de vidro (esperado 167 e 631)', v_grupos, v_vinculos;
  END IF;

  SELECT count(*) INTO v_pel_grupos FROM public.grupos_compatibilidade_pelicula WHERE tipo = 'pelicula';
  SELECT count(*) INTO v_pel_vinculos FROM public.grupo_compatibilidade_modelos m
    JOIN public.grupos_compatibilidade_pelicula g ON g.id = m.grupo_id
   WHERE g.tipo = 'pelicula';
  SELECT grupos, vinculos INTO v_pel_grupos_antes, v_pel_vinculos_antes FROM _conferencia_peliculas;
  IF v_pel_grupos <> v_pel_grupos_antes OR v_pel_vinculos <> v_pel_vinculos_antes THEN
    RAISE EXCEPTION 'Conferência falhou: dados de película mudaram durante o seed';
  END IF;

  RAISE NOTICE 'OK: % grupos e % vínculos de vidro; películas intactas (% grupos, % vínculos)', v_grupos, v_vinculos, v_pel_grupos, v_pel_vinculos;
END $$;

COMMIT;
