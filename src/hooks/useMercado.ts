import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18nVisivel } from "@/hooks/useI18nVisivel";
import type { Idioma } from "@/lib/i18n/idiomas";
import { infoMercadoDoPerfil, MERCADO_BRASIL, type InfoMercado, type PerfilRegional } from "@/lib/i18n/mercado";
import { CHAVE_IDIOMA_LOCAL, resolverIdioma } from "@/lib/i18n/resolverIdioma";

const CHAVE_PERFIL_REGIONAL = ["perfil-regional"] as const;

async function carregarPerfilRegional(): Promise<PerfilRegional | null> {
  // getSession lê a sessão local (getUser iria ao servidor de Auth).
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("idioma, mercado, pais, moeda, fuso_horario")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function lerIdiomaLocal(): string | null {
  try {
    return localStorage.getItem(CHAVE_IDIOMA_LOCAL);
  } catch {
    return null;
  }
}

/** Idioma pela ordem de resolverIdioma: perfil (undefined enquanto carrega) e, depois, o navegador. */
function idiomaResolvido(perfilIdioma: string | null | undefined): Idioma {
  return resolverIdioma({
    perfil: perfilIdioma,
    hostname: window.location.hostname,
    parametroLang: new URLSearchParams(window.location.search).get("lang"),
    armazenado: lerIdiomaLocal(),
    navegador: navigator.languages?.length ? navigator.languages : [navigator.language],
  });
}

/**
 * Idioma, mercado, moeda, país, fuso e capacidades da conta. Para quem
 * i18nVisivelPara não libera (hoje: todo não-admin) devolve MERCADO_BRASIL
 * sem consultar nada nem ler o navegador. Liberado, lê as colunas regionais
 * de profiles (uma vez; mesmo cache em todas as telas): o idioma segue
 * resolverIdioma (enquanto o perfil carrega, a última escolha salva neste
 * navegador) e o resto, enquanto carrega ou se der erro, é o do Brasil.
 *
 * Mercado, moeda, país e fuso vêm do perfil de quem está logado — certo para o
 * dono. Funcionário e gerente de filial terão de herdar da loja (como
 * get_mercado_loja() faz com o mercado) antes da liberação a todos.
 */
export function useMercado(): InfoMercado & { carregando: boolean } {
  const visivel = useI18nVisivel();
  const { data: perfil, isLoading } = useQuery({
    queryKey: CHAVE_PERFIL_REGIONAL,
    queryFn: carregarPerfilRegional,
    enabled: visivel,
    staleTime: 5 * 60_000,
  });
  const carregando = visivel && isLoading;
  return useMemo(() => {
    if (!visivel) return { ...MERCADO_BRASIL, carregando: false };
    return { ...infoMercadoDoPerfil(perfil), idioma: idiomaResolvido(perfil?.idioma), carregando };
  }, [visivel, perfil, carregando]);
}

/** Grava profiles.idioma do usuário logado (a trava do banco só deixa mudar o idioma). */
export function useSalvarIdioma() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (idioma: Idioma) => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user.id;
      if (!userId) throw new Error("Sem sessão");
      const { error } = await supabase.from("profiles").update({ idioma }).eq("user_id", userId);
      if (error) throw error;
      return idioma;
    },
    onSuccess: (idioma) => {
      queryClient.setQueryData<PerfilRegional | null>(CHAVE_PERFIL_REGIONAL, (atual) => (atual ? { ...atual, idioma } : atual));
    },
  });
}
