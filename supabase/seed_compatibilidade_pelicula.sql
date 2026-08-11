-- Seed de dados: Compatibilidade de Película (Apple, Motorola, Samsung, Xiaomi)
-- Aplicar UMA VEZ manualmente no SQL Editor do Supabase (não é migration,
-- não faz parte de `supabase db push`). Requer que as tabelas
-- grupos_compatibilidade_pelicula e grupo_compatibilidade_modelos já existam.
--
-- 209 grupos, 393 vínculos de modelo. Nomes de modelo seguem a grafia do
-- catálogo usado no wizard de OS (catalogoDispositivos.ts) sempre que o
-- modelo existe lá (ex: prefixos "Moto", "Galaxy", "Xiaomi"/"Mi", "iPhone").
-- Ver relatório de divergências e decisões de interpretação na conversa que
-- gerou este arquivo.

-- ============================================================
-- APPLE — 23 grupos
-- ============================================================

-- Grupo: APPLE IPHONE 11 PRO MAX/XS MAX
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 11 PRO MAX/XS MAX')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 11 Pro Max'),
  ('Apple', 'iPhone XS Max')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 11 PRO/X/XS
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 11 PRO/X/XS')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 11 Pro'),
  ('Apple', 'iPhone X'),
  ('Apple', 'iPhone XS')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 11/XR
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 11/XR')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 11'),
  ('Apple', 'iPhone XR')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 12 MINI
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 12 MINI')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 12 Mini')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 12 PRO MAX
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 12 PRO MAX')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 12 Pro Max')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 12/12 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 12/12 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 12'),
  ('Apple', 'iPhone 12 Pro')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 13 MINI
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 13 MINI')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 13 Mini')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 13 PRO MAX/14 PLUS
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 13 PRO MAX/14 PLUS')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 13 Pro Max'),
  ('Apple', 'iPhone 14 Plus')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 13/13 PRO/14/16E/17E
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 13/13 PRO/14/16E/17E')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 13'),
  ('Apple', 'iPhone 13 Pro'),
  ('Apple', 'iPhone 14'),
  ('Apple', 'iPhone 16e'),
  ('Apple', 'iPhone 17e')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 14 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 14 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 14 Pro')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 14 PRO MAX
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 14 PRO MAX')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 14 Pro Max')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 15
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 15')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 15')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 15 PLUS/16 PLUS
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 15 PLUS/16 PLUS')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 15 Plus'),
  ('Apple', 'iPhone 16 Plus')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 15 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 15 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 15 Pro')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 15 PRO MAX
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 15 PRO MAX')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 15 Pro Max')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 16
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 16')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 16')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 16 PRO/17
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 16 PRO/17')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 16 Pro'),
  ('Apple', 'iPhone 17')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 16 PRO MAX
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 16 PRO MAX')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 16 Pro Max')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 17 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 17 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 17 Pro')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 17 PRO MAX
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 17 PRO MAX')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 17 Pro Max')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE AIR
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE AIR')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone Air')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 6/7/8 PLUS (BRANCO/PRETO)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 6/7/8 PLUS (BRANCO/PRETO)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 6 Plus'),
  ('Apple', 'iPhone 7 Plus'),
  ('Apple', 'iPhone 8 Plus')
) AS v(marca, modelo);

-- Grupo: APPLE IPHONE 6/7/8/SE (2020/2022) (BRANCO/PRETO)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('APPLE IPHONE 6/7/8/SE (2020/2022) (BRANCO/PRETO)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Apple', 'iPhone 6'),
  ('Apple', 'iPhone 7'),
  ('Apple', 'iPhone 8'),
  ('Apple', 'iPhone SE (2020)'),
  ('Apple', 'iPhone SE (2022)')
) AS v(marca, modelo);

-- ============================================================
-- MOTOROLA — 48 grupos
-- ============================================================

-- Grupo: MOTOROLA E13
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA E13')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto E13')
) AS v(marca, modelo);

-- Grupo: MOTOROLA E15/G05/G15 (POWER)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA E15/G05/G15 (POWER)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto E15'),
  ('Motorola', 'Moto G05'),
  ('Motorola', 'Moto G15 Power')
) AS v(marca, modelo);

-- Grupo: MOTOROLA E20
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA E20')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto E20')
) AS v(marca, modelo);

-- Grupo: MOTOROLA E22
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA E22')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto E22')
) AS v(marca, modelo);

-- Grupo: MOTOROLA E30/E40/G (2022)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA E30/E40/G (2022)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto E30'),
  ('Motorola', 'Moto E40'),
  ('Motorola', 'Moto G (2022)')
) AS v(marca, modelo);

-- Grupo: MOTOROLA EDGE 20/20 PRO/30 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA EDGE 20/20 PRO/30 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto Edge 20'),
  ('Motorola', 'Moto Edge 20 Pro'),
  ('Motorola', 'Moto Edge 30 Pro')
) AS v(marca, modelo);

-- Grupo: MOTOROLA EDGE 20 LITE/20 FUSION
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA EDGE 20 LITE/20 FUSION')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto Edge 20 Lite'),
  ('Motorola', 'Moto Edge 20 Fusion')
) AS v(marca, modelo);

-- Grupo: MOTOROLA EDGE 2022
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA EDGE 2022')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto Edge 2022')
) AS v(marca, modelo);

-- Grupo: MOTOROLA EDGE 30/G52
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA EDGE 30/G52')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto Edge 30'),
  ('Motorola', 'Moto G52')
) AS v(marca, modelo);

-- Grupo: MOTOROLA EDGE 30 NEO/50 NEO/60 NEO/S50/THINKPHONE 25
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA EDGE 30 NEO/50 NEO/60 NEO/S50/THINKPHONE 25')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto Edge 30 Neo'),
  ('Motorola', 'Moto Edge 50 Neo'),
  ('Motorola', 'Moto Edge 60 Neo'),
  ('Motorola', 'Moto Edge S50'),
  ('Motorola', 'Moto ThinkPhone 25')
) AS v(marca, modelo);

-- Grupo: MOTOROLA EDGE 70
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA EDGE 70')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto Edge 70')
) AS v(marca, modelo);

-- Grupo: MOTOROLA EDGE S30
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA EDGE S30')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto Edge S30')
) AS v(marca, modelo);

-- Grupo: MOTOROLA EDGE X30
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA EDGE X30')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto Edge X30')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G PLAY 2024
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G PLAY 2024')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G Play 2024')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G POWER (2025)/G75
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G POWER (2025)/G75')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G Power (2025)'),
  ('Motorola', 'Moto G75')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G POWER (2022/2024)/G PLAY (2023/2026)/G (2025/2026)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G POWER (2022/2024)/G PLAY (2023/2026)/G (2025/2026)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G Power 2022'),
  ('Motorola', 'Moto G Power 2024'),
  ('Motorola', 'Moto G Play 2023'),
  ('Motorola', 'Moto G Play 2026'),
  ('Motorola', 'Moto G 2025'),
  ('Motorola', 'Moto G 2026')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G STYLUS 5G (2022)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G STYLUS 5G (2022)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G Stylus 5G (2022)')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G STYLUS 5G 2023
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G STYLUS 5G 2023')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G Stylus 5G 2023')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G04(S)/G24/G24 POWER/E14
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G04(S)/G24/G24 POWER/E14')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G04(S)'),
  ('Motorola', 'Moto G24'),
  ('Motorola', 'Moto G24 Power'),
  ('Motorola', 'Moto E14')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G06 (POWER)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G06 (POWER)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G06 Power')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G10/G10 POWER/G20/G30/E7/E7 POWER
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G10/G10 POWER/G20/G30/E7/E7 POWER')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G10'),
  ('Motorola', 'Moto G10 Power'),
  ('Motorola', 'Moto G20'),
  ('Motorola', 'Moto G30'),
  ('Motorola', 'Moto E7'),
  ('Motorola', 'Moto E7 Power')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G13/G23/G34/G45/G53
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G13/G23/G34/G45/G53')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G13'),
  ('Motorola', 'Moto G23'),
  ('Motorola', 'Moto G34'),
  ('Motorola', 'Moto G45'),
  ('Motorola', 'Moto G53')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G14/G54/G55/G64/G73
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G14/G54/G55/G64/G73')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G14'),
  ('Motorola', 'Moto G54'),
  ('Motorola', 'Moto G55'),
  ('Motorola', 'Moto G64'),
  ('Motorola', 'Moto G73')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G17 (POWER)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G17 (POWER)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G17 Power')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G200 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G200 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G200 5G')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G22/E22S (I)/E32(S)/G (2023/2024)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G22/E22S (I)/E32(S)/G (2023/2024)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G22'),
  ('Motorola', 'Moto E22s (i)'),
  ('Motorola', 'Moto E32(S)'),
  ('Motorola', 'Moto G 2023'),
  ('Motorola', 'Moto G 2024')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G31/G32/G41/G62 5G/G71 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G31/G32/G41/G62 5G/G71 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G31'),
  ('Motorola', 'Moto G32'),
  ('Motorola', 'Moto G41'),
  ('Motorola', 'Moto G62 5G'),
  ('Motorola', 'Moto G71 5G')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G35
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G35')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G35')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G40 FUSION/G60(S)/EDGE 2021
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G40 FUSION/G60(S)/EDGE 2021')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G40 Fusion'),
  ('Motorola', 'Moto G60(S)'),
  ('Motorola', 'Moto Edge 2021')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G42
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G42')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G42')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G50 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G50 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G50 5G')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G51
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G51')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G51')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G56
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G56')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G56')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G57 POWER/G67 POWER/G100(S) (BETA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G57 POWER/G67 POWER/G100(S) (BETA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G57 Power'),
  ('Motorola', 'Moto G67 Power'),
  ('Motorola', 'Moto G100(S) (Beta)')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G67/G77 (BETA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G67/G77 (BETA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G67 (Beta)'),
  ('Motorola', 'Moto G77 (Beta)')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G71S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G71S')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G71s')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G72
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G72')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G72')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G8
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G8')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G8')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G8 PLAY
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G8 PLAY')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G8 Play')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G8 POWER LITE
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G8 POWER LITE')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G8 Power Lite')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G82
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G82')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G82')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G84
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G84')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G84')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G86 (POWER)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G86 (POWER)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G86 Power')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G9 PLUS
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G9 PLUS')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G9 Plus')
) AS v(marca, modelo);

-- Grupo: MOTOROLA G9 POWER
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA G9 POWER')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto G9 Power')
) AS v(marca, modelo);

-- Grupo: MOTOROLA ONE FUSION/G9/G9 PLAY
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA ONE FUSION/G9/G9 PLAY')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto One Fusion'),
  ('Motorola', 'Moto G9'),
  ('Motorola', 'Moto G9 Play')
) AS v(marca, modelo);

-- Grupo: MOTOROLA SIGNATURE (BETA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA SIGNATURE (BETA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto Signature (Beta)')
) AS v(marca, modelo);

-- Grupo: MOTOROLA THINKPHONE
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('MOTOROLA THINKPHONE')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Motorola', 'Moto ThinkPhone')
) AS v(marca, modelo);

-- ============================================================
-- SAMSUNG — 71 grupos
-- ============================================================

-- Grupo: SAMSUNG A01 CORE/M01 CORE
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A01 CORE/M01 CORE')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A01 Core'),
  ('Samsung', 'Galaxy M01 Core')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A02(S)/A03(S)/A03 CORE/M32 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A02(S)/A03(S)/A03 CORE/M32 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A02(S)'),
  ('Samsung', 'Galaxy A03(S)'),
  ('Samsung', 'Galaxy A03 Core'),
  ('Samsung', 'Galaxy M32 5G')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A04(E) (S)/M04
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A04(E) (S)/M04')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A04e'),
  ('Samsung', 'Galaxy A04s'),
  ('Samsung', 'Galaxy M04')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A05/F05/M05
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A05/F05/M05')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A05'),
  ('Samsung', 'Galaxy F05'),
  ('Samsung', 'Galaxy M05')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A05S/F14 4G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A05S/F14 4G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A05s'),
  ('Samsung', 'Galaxy F14 4G')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A06 (5G)/A07 (5G)/F06 5G/F07/M06/M07
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A06 (5G)/A07 (5G)/F06 5G/F07/M06/M07')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A06 (5G)'),
  ('Samsung', 'Galaxy A07 (5G)'),
  ('Samsung', 'Galaxy F06 5G'),
  ('Samsung', 'Galaxy F07'),
  ('Samsung', 'Galaxy M06'),
  ('Samsung', 'Galaxy M07')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A10(S)/M10/M01S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A10(S)/M10/M01S')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A10(S)'),
  ('Samsung', 'Galaxy M10'),
  ('Samsung', 'Galaxy M01s')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A12 (NACHO)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A12 (NACHO)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A12 (Nacho)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A13 (5G)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A13 (5G)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A13 (5G)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A14 (5G)/F14/M14
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A14 (5G)/F14/M14')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A14 (5G)'),
  ('Samsung', 'Galaxy F14'),
  ('Samsung', 'Galaxy M14')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A15 (5G)/F15/M15
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A15 (5G)/F15/M15')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A15 (5G)'),
  ('Samsung', 'Galaxy F15'),
  ('Samsung', 'Galaxy M15')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A16 (5G)/A17 (4G)/A26/F16/F17/F36/M16/M17/M36
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A16 (5G)/A17 (4G)/A26/F16/F17/F36/M16/M17/M36')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A16 (5G)'),
  ('Samsung', 'Galaxy A17 (4G)'),
  ('Samsung', 'Galaxy A26'),
  ('Samsung', 'Galaxy F16'),
  ('Samsung', 'Galaxy F17'),
  ('Samsung', 'Galaxy F36'),
  ('Samsung', 'Galaxy M16'),
  ('Samsung', 'Galaxy M17'),
  ('Samsung', 'Galaxy M36')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A20/A30(S)/A50(S)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A20/A30(S)/A50(S)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A20'),
  ('Samsung', 'Galaxy A30(S)'),
  ('Samsung', 'Galaxy A50(S)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A21
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A21')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A21')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A22 5G/F42 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A22 5G/F42 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A22 5G'),
  ('Samsung', 'Galaxy F42 5G')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A23 (5G)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A23 (5G)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A23 (5G)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A24 4G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A24 4G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A24 4G')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A25
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A25')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A25')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A31/A22 4G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A31/A22 4G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A31'),
  ('Samsung', 'Galaxy A22 4G')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A32 4G/M32 4G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A32 4G/M32 4G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A32 4G'),
  ('Samsung', 'Galaxy M32 4G')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A32 5G/M12
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A32 5G/M12')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A32 5G'),
  ('Samsung', 'Galaxy M12')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A33 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A33 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A33 5G')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A34
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A34')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A34')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A35
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A35')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A35')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A36/A56/F56/M56
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A36/A56/F56/M56')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A36'),
  ('Samsung', 'Galaxy A56'),
  ('Samsung', 'Galaxy F56'),
  ('Samsung', 'Galaxy M56')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A42 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A42 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A42 5G')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A52(S) (5G)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A52(S) (5G)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A52(S) (5G)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A53 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A53 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A53 5G')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A54
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A54')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A54')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A55/M35
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A55/M35')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A55'),
  ('Samsung', 'Galaxy M35')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A70(S)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A70(S)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A70(S)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A71/F62/M62
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A71/F62/M62')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A71'),
  ('Samsung', 'Galaxy F62'),
  ('Samsung', 'Galaxy M62')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A72 (5G)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A72 (5G)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A72 (5G)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG A73 5G/M53
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG A73 5G/M53')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy A73 5G'),
  ('Samsung', 'Galaxy M53')
) AS v(marca, modelo);

-- Grupo: SAMSUNG F04
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG F04')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy F04')
) AS v(marca, modelo);

-- Grupo: SAMSUNG F34/M34 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG F34/M34 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy F34'),
  ('Samsung', 'Galaxy M34 5G')
) AS v(marca, modelo);

-- Grupo: SAMSUNG F70E/M17E
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG F70E/M17E')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy F70E'),
  ('Samsung', 'Galaxy M17E')
) AS v(marca, modelo);

-- Grupo: SAMSUNG J2 CORE 2020
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG J2 CORE 2020')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy J2 Core 2020')
) AS v(marca, modelo);

-- Grupo: SAMSUNG M13/M23/M33/F13/F23
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG M13/M23/M33/F13/F23')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy M13'),
  ('Samsung', 'Galaxy M23'),
  ('Samsung', 'Galaxy M33'),
  ('Samsung', 'Galaxy F13'),
  ('Samsung', 'Galaxy F23')
) AS v(marca, modelo);

-- Grupo: SAMSUNG M21(S) 2021/M31 (PRIME)/F41
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG M21(S) 2021/M31 (PRIME)/F41')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy M21(S) 2021'),
  ('Samsung', 'Galaxy M31 (Prime)'),
  ('Samsung', 'Galaxy F41')
) AS v(marca, modelo);

-- Grupo: SAMSUNG M42 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG M42 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy M42 5G')
) AS v(marca, modelo);

-- Grupo: SAMSUNG M54/F54
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG M54/F54')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy M54'),
  ('Samsung', 'Galaxy F54')
) AS v(marca, modelo);

-- Grupo: SAMSUNG NOTE 10 (CURVA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG NOTE 10 (CURVA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy Note 10 (Curva)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG NOTE 10 LITE
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG NOTE 10 LITE')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy Note 10 Lite')
) AS v(marca, modelo);

-- Grupo: SAMSUNG NOTE 10 PLUS (5G) (CURVA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG NOTE 10 PLUS (5G) (CURVA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy Note 10 Plus (5G) (Curva)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG NOTE 20 (5G) (TELA RETA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG NOTE 20 (5G) (TELA RETA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy Note 20 (5G) (Tela Reta)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG NOTE 20 ULTRA (5G) (CURVA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG NOTE 20 ULTRA (5G) (CURVA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy Note 20 Ultra (5G) (Curva)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S10 (CURVA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S10 (CURVA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S10 (Curva)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S10 LITE
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S10 LITE')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S10 Lite')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S10 PLUS (CURVA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S10 PLUS (CURVA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S10 Plus (Curva)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S20 (CURVA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S20 (CURVA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S20 (Curva)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S20 FE (5G) (2022)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S20 FE (5G) (2022)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S20 FE (5G) (2022)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S20 PLUS (CURVA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S20 PLUS (CURVA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S20 Plus (Curva)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S20 ULTRA (CURVA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S20 ULTRA (CURVA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S20 Ultra (Curva)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S21 (5G)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S21 (5G)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S21 (5G)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S21 FE 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S21 FE 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S21 FE 5G')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S21 PLUS 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S21 PLUS 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S21 Plus 5G')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S22 5G/S23
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S22 5G/S23')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S22 5G'),
  ('Samsung', 'Galaxy S23')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S22 PLUS 5G/S23 PLUS
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S22 PLUS 5G/S23 PLUS')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S22 Plus 5G'),
  ('Samsung', 'Galaxy S23 Plus')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S23 FE
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S23 FE')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S23 FE')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S24/S25
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S24/S25')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S24'),
  ('Samsung', 'Galaxy S25')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S24 FE
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S24 FE')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S24 FE')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S24 PLUS/S25 PLUS
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S24 PLUS/S25 PLUS')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S24 Plus'),
  ('Samsung', 'Galaxy S25 Plus')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S24 ULTRA
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S24 ULTRA')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S24 Ultra')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S25 EDGE/S26 PLUS
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S25 EDGE/S26 PLUS')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S25 Edge'),
  ('Samsung', 'Galaxy S26 Plus')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S25 FE
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S25 FE')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S25 FE')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S25 ULTRA
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S25 ULTRA')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S25 Ultra')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S26
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S26')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S26')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S26 ULTRA
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S26 ULTRA')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S26 Ultra')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S8 PLUS/S9 PLUS (CURVA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S8 PLUS/S9 PLUS (CURVA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S8 Plus (Curva)'),
  ('Samsung', 'Galaxy S9 Plus (Curva)')
) AS v(marca, modelo);

-- Grupo: SAMSUNG S8/S9 (CURVA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('SAMSUNG S8/S9 (CURVA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Samsung', 'Galaxy S8 (Curva)'),
  ('Samsung', 'Galaxy S9 (Curva)')
) AS v(marca, modelo);

-- ============================================================
-- XIAOMI — 67 grupos
-- ============================================================

-- Grupo: XIAOMI 11I/11I HYPERCHARGE 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI 11I/11I HYPERCHARGE 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Mi 11i'),
  ('Xiaomi', 'Mi 11i HyperCharge 5G')
) AS v(marca, modelo);

-- Grupo: XIAOMI 13/14/15
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI 13/14/15')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Xiaomi 13'),
  ('Xiaomi', 'Xiaomi 14'),
  ('Xiaomi', 'Xiaomi 15')
) AS v(marca, modelo);

-- Grupo: XIAOMI 13T (PRO)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI 13T (PRO)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Xiaomi 13T (Pro)')
) AS v(marca, modelo);

-- Grupo: XIAOMI 14T (PRO)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI 14T (PRO)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Xiaomi 14T (Pro)')
) AS v(marca, modelo);

-- Grupo: XIAOMI 15 PRO/15S PRO/15 ULTRA
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI 15 PRO/15S PRO/15 ULTRA')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Xiaomi 15 Pro'),
  ('Xiaomi', 'Xiaomi 15S Pro'),
  ('Xiaomi', 'Xiaomi 15 Ultra')
) AS v(marca, modelo);

-- Grupo: XIAOMI 17/17 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI 17/17 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Xiaomi 17'),
  ('Xiaomi', 'Xiaomi 17 Pro')
) AS v(marca, modelo);

-- Grupo: XIAOMI 17 PRO MAX/17 ULTRA (BETA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI 17 PRO MAX/17 ULTRA (BETA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Xiaomi 17 Pro Max'),
  ('Xiaomi', 'Xiaomi 17 Ultra (Beta)')
) AS v(marca, modelo);

-- Grupo: XIAOMI BLACK SHARK 4(S) (PRO)/5 (RS) (PRO)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI BLACK SHARK 4(S) (PRO)/5 (RS) (PRO)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Black Shark 4(S) (Pro)'),
  ('Xiaomi', 'Black Shark 5 (RS) (Pro)')
) AS v(marca, modelo);

-- Grupo: XIAOMI MI 10T LITE 5G/10I 5G/POCO M2 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI MI 10T LITE 5G/10I 5G/POCO M2 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Mi 10T Lite 5G'),
  ('Xiaomi', 'Mi 10i 5G'),
  ('Xiaomi', 'Poco M2 Pro')
) AS v(marca, modelo);

-- Grupo: XIAOMI MI 11I/11X (PRO)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI MI 11I/11X (PRO)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Mi 11i'),
  ('Xiaomi', 'Mi 11X (Pro)')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO C40/REDMI 10 POWER/10C
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO C40/REDMI 10 POWER/10C')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco C40'),
  ('Xiaomi', 'Redmi 10 Power'),
  ('Xiaomi', 'Redmi 10C')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO C50/C51
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO C50/C51')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco C50'),
  ('Xiaomi', 'Poco C51')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO C55
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO C55')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco C55')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO C85 (BETA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO C85 (BETA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco C85 (Beta)')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO C85 4G/REDMI 15C 4G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO C85 4G/REDMI 15C 4G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco C85 4G'),
  ('Xiaomi', 'Redmi 15C 4G')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO C85X (BETA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO C85X (BETA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco C85X (Beta)')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO F3 GT/F4 GT
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO F3 GT/F4 GT')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco F3 GT'),
  ('Xiaomi', 'Poco F4 GT')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO F3/M2 RELOADED
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO F3/M2 RELOADED')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco F3'),
  ('Xiaomi', 'Poco M2 Reloaded')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO F5/F5 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO F5/F5 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco F5'),
  ('Xiaomi', 'Poco F5 Pro')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO F6
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO F6')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco F6')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO F6 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO F6 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco F6 Pro')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO F7/NOTE 15 PRO/15T (PRO)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO F7/NOTE 15 PRO/15T (PRO)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco F7'),
  ('Xiaomi', 'Redmi Note 15 Pro'),
  ('Xiaomi', 'Redmi Note 15T (Pro)')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO F7 PRO/F7 ULTRA
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO F7 PRO/F7 ULTRA')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco F7 Pro'),
  ('Xiaomi', 'Poco F7 Ultra')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO F8 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO F8 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco F8 Pro')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO M7
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO M7')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco M7')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO M7 PLUS
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO M7 PLUS')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco M7 Plus')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO X3/X3 NFC/X3 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO X3/X3 NFC/X3 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco X3'),
  ('Xiaomi', 'Poco X3 NFC'),
  ('Xiaomi', 'Poco X3 Pro')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO X4 PRO 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO X4 PRO 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco X4 Pro 5G')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO X5
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO X5')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco X5')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO X5 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO X5 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco X5 Pro')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO X6
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO X6')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco X6')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO X6 NEO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO X6 NEO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco X6 Neo')
) AS v(marca, modelo);

-- Grupo: XIAOMI POCO X6 PRO/X7 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI POCO X6 PRO/X7 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Poco X6 Pro'),
  ('Xiaomi', 'Poco X7 Pro')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI 10/NOTE 10 5G/10T 5G/11SE
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI 10/NOTE 10 5G/10T 5G/11SE')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi 10'),
  ('Xiaomi', 'Redmi Note 10 5G'),
  ('Xiaomi', 'Redmi 10T 5G'),
  ('Xiaomi', 'Redmi 11SE')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI 10 5G/11 PRIME (5G)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI 10 5G/11 PRIME (5G)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi 10 5G'),
  ('Xiaomi', 'Redmi 11 Prime (5G)')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI 12 (R)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI 12 (R)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi 12(R)')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI 12C
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI 12C')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi 12C')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI 13/13X
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI 13/13X')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi 13'),
  ('Xiaomi', 'Redmi 13X')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI 13C (5G)/13R/POCO C65/M6
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI 13C (5G)/13R/POCO C65/M6')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi 13C (5G)'),
  ('Xiaomi', 'Redmi 13R'),
  ('Xiaomi', 'Poco C65'),
  ('Xiaomi', 'Poco M6')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI 14C (5G)/14R/POCO C75 (5G)/A5 4G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI 14C (5G)/14R/POCO C75 (5G)/A5 4G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi 14C (5G)'),
  ('Xiaomi', 'Redmi 14R'),
  ('Xiaomi', 'Poco C75 (5G)'),
  ('Xiaomi', 'Redmi A5 4G')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI 15 4G (5G)/POCO M7 4G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI 15 4G (5G)/POCO M7 4G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi 15 4G'),
  ('Xiaomi', 'Redmi 15 5G'),
  ('Xiaomi', 'Poco M7 4G')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI 15C
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI 15C')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi 15C')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI A1/A1+/A2/A2+/9C
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI A1/A1+/A2/A2+/9C')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi A1'),
  ('Xiaomi', 'Redmi A1+'),
  ('Xiaomi', 'Redmi A2'),
  ('Xiaomi', 'Redmi A2+'),
  ('Xiaomi', 'Redmi 9C')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI A3/A3X/POCO C61
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI A3/A3X/POCO C61')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi A3'),
  ('Xiaomi', 'Redmi A3X'),
  ('Xiaomi', 'Poco C61')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI K40/K40 PRO/K40 PRO PLUS
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI K40/K40 PRO/K40 PRO PLUS')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi K40'),
  ('Xiaomi', 'Redmi K40 Pro'),
  ('Xiaomi', 'Redmi K40 Pro Plus')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI K60(E) (PRO) (ULTRA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI K60(E) (PRO) (ULTRA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi K60E'),
  ('Xiaomi', 'Redmi K60 Pro'),
  ('Xiaomi', 'Redmi K60 Ultra')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI K80/K80 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI K80/K80 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi K80'),
  ('Xiaomi', 'Redmi K80 Pro')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI K80 ULTRA/NOTE 15 PRO 5G (BETA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI K80 ULTRA/NOTE 15 PRO 5G (BETA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi K80 Ultra'),
  ('Xiaomi', 'Redmi Note 15 Pro 5G (Beta)')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI K90
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI K90')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi K90')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI K90 PRO MAX/POCO F8 ULTRA
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI K90 PRO MAX/POCO F8 ULTRA')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi K90 Pro Max'),
  ('Xiaomi', 'Poco F8 Ultra')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 9
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 9')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 9')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 9 PRO/PRO MAX/9S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 9 PRO/PRO MAX/9S')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 9 Pro'),
  ('Xiaomi', 'Redmi Note 9 Pro Max'),
  ('Xiaomi', 'Redmi Note 9S')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 10(S)/POCO M5S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 10(S)/POCO M5S')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 10(S)'),
  ('Xiaomi', 'Poco M5S')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 10 PRO/10 PRO MAX
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 10 PRO/10 PRO MAX')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 10 Pro'),
  ('Xiaomi', 'Redmi Note 10 Pro Max')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 11 4G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 11 4G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 11 4G')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 11(S)/NOTE 12S
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 11(S)/NOTE 12S')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 11(S)'),
  ('Xiaomi', 'Redmi Note 12S')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 11E/POCO M5
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 11E/POCO M5')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 11E'),
  ('Xiaomi', 'Poco M5')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 11 PRO (5G)/PRO PLUS 5G
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 11 PRO (5G)/PRO PLUS 5G')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 11 Pro (5G)'),
  ('Xiaomi', 'Redmi Note 11 Pro Plus 5G')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 11R
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 11R')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 11R')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 12 (4G)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 12 (4G)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 12 (4G)')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 12 PRO (PRO+) (EXPLORER) (SPEED)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 12 PRO (PRO+) (EXPLORER) (SPEED)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 12 Pro (Pro+) (Explorer) (Speed)')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 13
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 13')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 13')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 13 PRO/POCO M6 PRO
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 13 PRO/POCO M6 PRO')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 13 Pro'),
  ('Xiaomi', 'Poco M6 Pro')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 14 (S) (5G)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 14 (S) (5G)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 14(S) (5G)')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 15 PRO 4G (BETA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 15 PRO 4G (BETA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 15 Pro 4G (Beta)')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI NOTE 15 PRO PLUS/TURBO 5 MAX/POCO M8 PRO (BETA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI NOTE 15 PRO PLUS/TURBO 5 MAX/POCO M8 PRO (BETA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Note 15 Pro Plus'),
  ('Xiaomi', 'Redmi Turbo 5 Max'),
  ('Xiaomi', 'Poco M8 Pro')
) AS v(marca, modelo);

-- Grupo: XIAOMI REDMI TURBO 5 (BETA)
WITH novo_grupo AS (
  INSERT INTO public.grupos_compatibilidade_pelicula (nome)
  VALUES ('XIAOMI REDMI TURBO 5 (BETA)')
  RETURNING id
)
INSERT INTO public.grupo_compatibilidade_modelos (grupo_id, marca, modelo)
SELECT id, v.marca, v.modelo FROM novo_grupo, (VALUES
  ('Xiaomi', 'Redmi Turbo 5 (Beta)')
) AS v(marca, modelo);