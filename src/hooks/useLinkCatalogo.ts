/**
 * Link, publicação e Salvar único do Catálogo no COMPUTADOR (>= 1024px). Celular e tablet
 * continuam com o GerenciadorLinkCatalogo e os Salvar de antes.
 *
 * Lê catalogo_slug, catalogo_ativo e catalogo_config (este só para saber o que está salvo e
 * comparar com a tela) e grava os três num update só, com .select() para conferir que uma
 * linha foi mesmo atualizada.
 *
 * Mesma consulta das telas antigas (user.id + empresa_id nulo): o problema do funcionário e da
 * filial está anotado em docs/pendencias-catalogo.md (item 1) e NÃO é corrigido aqui. A
 * diferença: se nenhuma linha for atualizada, o resultado é "sem_permissao", nunca sucesso.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  formatarLink,
  linkDoNomeDaLoja,
  montarGravacao,
  precisaConferirLink,
  resultadoGravacao,
  type DisponibilidadeLink,
  type ErroAntesDeGravar,
} from "@/lib/catalogo/gravacaoCatalogoDesktop";

export type ResultadoSalvarCatalogo =
  | { ok: true; ativo: boolean }
  | { ok: false; motivo: ErroAntesDeGravar | "sem_permissao" | "erro" };

export interface LinkCatalogo {
  /** Primeira leitura terminou (com ou sem linha). */
  carregado: boolean;
  slug: string;
  ativo: boolean;
  /** Como está no banco (ou no último Salvar bem-sucedido). */
  slugSalvo: string;
  ativoSalvo: boolean;
  /** catalogo_config como está no banco (ou no último Salvar); null = loja sem config salva. */
  configSalva: Record<string, unknown> | null;
  conferindo: boolean;
  disponivel: DisponibilidadeLink;
  alterarSlug: (valor: string) => void;
  alterarAtivo: (valor: boolean) => void;
  gerarAutomatico: () => Promise<void>;
  linkCompleto: string;
  salvando: boolean;
  salvar: (configAtual: unknown) => Promise<ResultadoSalvarCatalogo>;
}

export function useLinkCatalogo(): LinkCatalogo {
  const [carregado, setCarregado] = useState(false);
  const [slug, setSlug] = useState("");
  const [ativo, setAtivo] = useState(false);
  const [slugSalvo, setSlugSalvo] = useState("");
  const [ativoSalvo, setAtivoSalvo] = useState(false);
  const [configSalva, setConfigSalva] = useState<Record<string, unknown> | null>(null);
  const [nomeLoja, setNomeLoja] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const [disponivel, setDisponivel] = useState<DisponibilidadeLink>(null);
  const [salvando, setSalvando] = useState(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from("configuracoes_loja")
          .select("catalogo_slug, catalogo_ativo, catalogo_config, nome_loja")
          .eq("user_id", user.id)
          .is("empresa_id", null)
          .maybeSingle();
        if (error) {
          console.error("Erro ao carregar o link do catálogo:", error);
          return;
        }
        if (!montado.current || !data) return;
        setSlug(data.catalogo_slug || "");
        setSlugSalvo(data.catalogo_slug || "");
        setAtivo(data.catalogo_ativo || false);
        setAtivoSalvo(data.catalogo_ativo || false);
        setConfigSalva(
          data.catalogo_config && typeof data.catalogo_config === "object" && !Array.isArray(data.catalogo_config)
            ? (data.catalogo_config as Record<string, unknown>)
            : null,
        );
        setNomeLoja(data.nome_loja || "");
      } finally {
        if (montado.current) setCarregado(true);
      }
    })();
    return () => {
      montado.current = false;
    };
  }, []);

  // "Link em uso?" — mesma consulta da tela antiga, 500 ms depois de parar de digitar.
  useEffect(() => {
    const salvo = { slug: slugSalvo, ativo: ativoSalvo };
    if (!precisaConferirLink(salvo, slug)) {
      setDisponivel(null);
      setConferindo(false);
      return;
    }
    setDisponivel(null);
    setConferindo(true);
    let cancelado = false;
    const espera = setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelado) return;
        const { data, error } = await supabase
          .from("configuracoes_loja")
          .select("id")
          .eq("catalogo_slug", slug.trim())
          .neq("user_id", user.id)
          .maybeSingle();
        if (cancelado) return;
        if (error) {
          console.error("Erro ao conferir o link:", error);
          return;
        }
        setDisponivel(!data);
      } finally {
        if (!cancelado) setConferindo(false);
      }
    }, 500);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [slug, slugSalvo, ativoSalvo]);

  const alterarSlug = useCallback((valor: string) => setSlug(formatarLink(valor)), []);
  const alterarAtivo = useCallback((valor: boolean) => setAtivo(valor), []);
  const gerarAutomatico = useCallback(async () => {
    setSlug(linkDoNomeDaLoja(nomeLoja));
  }, [nomeLoja]);

  const salvar = useCallback(
    async (configAtual: unknown): Promise<ResultadoSalvarCatalogo> => {
      const gravacao = montarGravacao({ slug: slugSalvo, ativo: ativoSalvo }, { catalogo: configAtual, slug, ativo }, disponivel);
      // "in" e não "ok": o projeto roda sem strictNullChecks, e aí o TS não estreita pelo booleano.
      if ("erro" in gravacao) return { ok: false, motivo: gravacao.erro };
      setSalvando(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { ok: false, motivo: "sem_permissao" };
        const { data, error } = await supabase
          .from("configuracoes_loja")
          .update({ ...gravacao.dados, catalogo_config: gravacao.dados.catalogo_config as Json })
          .eq("user_id", user.id)
          .is("empresa_id", null)
          .select("id");
        if (error) {
          console.error("Erro ao salvar o catálogo:", error);
          return { ok: false, motivo: "erro" };
        }
        if (resultadoGravacao(data) !== "ok") return { ok: false, motivo: "sem_permissao" };
        const novoSlug = gravacao.dados.catalogo_slug ?? slugSalvo;
        const novoAtivo = gravacao.dados.catalogo_ativo ?? ativoSalvo;
        setSlugSalvo(novoSlug);
        setSlug(novoSlug);
        setAtivoSalvo(novoAtivo);
        setConfigSalva(gravacao.dados.catalogo_config as Record<string, unknown>);
        return { ok: true, ativo: novoAtivo };
      } catch (erro) {
        console.error("Erro ao salvar o catálogo:", erro);
        return { ok: false, motivo: "erro" };
      } finally {
        setSalvando(false);
      }
    },
    [slugSalvo, ativoSalvo, slug, ativo, disponivel],
  );

  const linkCompleto = `${window.location.origin}/c/${slug}`;

  return {
    carregado,
    slug,
    ativo,
    slugSalvo,
    ativoSalvo,
    configSalva,
    conferindo,
    disponivel,
    alterarSlug,
    alterarAtivo,
    gerarAutomatico,
    linkCompleto,
    salvando,
    salvar,
  };
}
