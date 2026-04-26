CREATE OR REPLACE FUNCTION public.gerar_catalogo_slug(nome text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  slug_base TEXT;
  slug_final TEXT;
  contador INT := 0;
BEGIN
  -- Normalizar o nome para slug
  slug_base := lower(
    regexp_replace(
      regexp_replace(
        translate(nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiioooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
        '[^a-zA-Z0-9]+', '-', 'g'
      ),
      '^-+|-+$', '', 'g'
    )
  );

  slug_final := slug_base;

  -- Verificar unicidade e adicionar número se necessário
  WHILE EXISTS (SELECT 1 FROM public.configuracoes_loja WHERE catalogo_slug = slug_final) LOOP
    contador := contador + 1;
    slug_final := slug_base || '-' || contador;
  END LOOP;

  RETURN slug_final;
END;
$function$;