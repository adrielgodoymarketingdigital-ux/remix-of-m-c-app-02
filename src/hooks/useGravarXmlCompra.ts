import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useIdentidade } from "@/hooks/useResolvedUserId";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useAssinatura } from "@/hooks/useAssinatura";
import {
  caminhoXmlCompra,
  conferirLimitePlano,
  erroUploadEhObjetoExistente,
  interpretarErroImportacao,
  lerRetornoImportacao,
  MENSAGEM_ERRO_GENERICO,
  textoJaImportada,
  type ErroImportacao,
  type PayloadImportacao,
  type RetornoImportacao,
} from "@/lib/nfe/gravarImportacao";

/**
 * Rede da importação de XML de compra (etapa 4). Leituras (SELECT sob a RLS)
 * para liberar o botão e, só depois da confirmação, as duas escritas: upload
 * do XML original ao bucket privado notas-compra-xml e a RPC
 * importar_nfe_compra (que grava tudo numa transação).
 */

/**
 * CNPJ/CPF da empresa ATIVA para conferir o destinatário da nota:
 * matriz → configuração da loja; filial → empresas.cnpj da filial.
 */
export function useDocumentoEmpresaAtiva(habilitado: boolean): { documento: string | null; carregando: boolean } {
  const { empresaId, isFilial, carregando: carregandoIdentidade } = useIdentidade();
  const { config, loading: carregandoConfig } = useConfiguracaoLoja();
  const filial = useQuery({
    queryKey: ["xml-compra-cnpj-filial", empresaId],
    enabled: habilitado && isFilial && !!empresaId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("cnpj").eq("id", empresaId as string).maybeSingle();
      if (error) throw error;
      return data?.cnpj ?? null;
    },
  });
  if (carregandoIdentidade) return { documento: null, carregando: true };
  if (isFilial) return { documento: filial.data ?? null, carregando: filial.isLoading };
  return { documento: config?.cnpj ?? null, carregando: carregandoConfig };
}

/** Nota já importada nesta loja? SELECT em compras_xml_importadas pela chave (dono + chave = UNIQUE). */
export function useNotaJaImportada(chave: string | null) {
  const { userId, carregando } = useIdentidade();
  const query = useQuery({
    queryKey: ["xml-compra-ja-importada", userId, chave],
    enabled: !!chave && !!userId && !carregando,
    staleTime: 0,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras_xml_importadas")
        .select("created_at")
        .eq("user_id", userId as string)
        .eq("chave_acesso", chave as string)
        .maybeSingle();
      if (error) throw error;
      return data ? textoJaImportada({ criadaEm: data.created_at }) : null;
    },
  });
  return {
    jaImportada: query.data ?? null,
    verificando: !!chave && (carregando || !userId || query.isLoading),
    falhou: query.isError,
    tentarDeNovo: query.refetch,
  };
}

/**
 * Limite do plano para os cadastros novos da nota. Usa a mesma conta do
 * cadastro manual (useAssinatura.podeCadastrarProduto: produtos + peças
 * criados no mês, juntos). Só consulta quando a nota cria algum cadastro.
 */
export function useLimitePlanoImportacao(novos: number): { verificando: boolean; bloqueio: string | null } {
  const { podeCadastrarProduto, limites, carregando } = useAssinatura();
  const { userId } = useIdentidade();
  const precisa = novos > 0 && limites.produtos_mes !== -1;
  const query = useQuery({
    queryKey: ["xml-compra-limite-plano", userId, limites.produtos_mes],
    // Enquanto a assinatura carrega, useAssinatura devolve os limites do Free.
    enabled: precisa && !carregando,
    staleTime: 0,
    queryFn: () => podeCadastrarProduto(),
  });
  if (novos <= 0) return { verificando: false, bloqueio: null };
  if (carregando) return { verificando: true, bloqueio: null };
  if (limites.produtos_mes === -1) return { verificando: false, bloqueio: null };
  if (!query.data) return { verificando: true, bloqueio: null };
  return { verificando: false, bloqueio: conferirLimitePlano(novos, query.data) };
}

export interface ResultadoEnvioXml {
  ok: boolean;
}
// Sem união discriminada: o app roda sem strictNullChecks e o `if (r.ok)` não estreitaria.
export interface ResultadoGravacao {
  ok: boolean;
  retorno: RetornoImportacao | null;
  erro: ErroImportacao | null;
}

/** As duas escritas, chamadas pela tela só depois da confirmação. */
export function useGravarXmlCompra() {
  const { userId } = useIdentidade();
  const queryClient = useQueryClient();

  /**
   * (a) XML original no bucket; objeto que já existe conta como sucesso.
   * Vai como bytes (ArrayBuffer): com File/Blob o storage-js monta um
   * FormData e ignora o contentType (o tipo do arquivo pode vir vazio e o
   * bucket só aceita application/xml e text/xml).
   */
  const enviarXml = useCallback(async (arquivo: Blob, chave: string): Promise<ResultadoEnvioXml> => {
    if (!userId) return { ok: false };
    try {
      const bytes = await arquivo.arrayBuffer();
      const { error } = await supabase.storage
        .from("notas-compra-xml")
        .upload(caminhoXmlCompra(userId, chave), bytes, { upsert: false, contentType: "application/xml" });
      return !error || erroUploadEhObjetoExistente(error) ? { ok: true } : { ok: false };
    } catch {
      return { ok: false };
    }
  }, [userId]);

  /** (b) RPC importar_nfe_compra. Nunca registra nem mostra o payload. */
  const gravar = useCallback(async (payload: PayloadImportacao): Promise<ResultadoGravacao> => {
    try {
      const { data, error } = await supabase.rpc("importar_nfe_compra", { payload: payload as unknown as Json });
      if (error) {
        console.error("importar_nfe_compra falhou:", error.code);
        return { ok: false, retorno: null, erro: interpretarErroImportacao(error) };
      }
      const retorno = lerRetornoImportacao(data);
      if (!retorno) return { ok: false, retorno: null, erro: { tipo: "generico", mensagem: MENSAGEM_ERRO_GENERICO } };
      return { ok: true, retorno, erro: null };
    } catch {
      return { ok: false, retorno: null, erro: interpretarErroImportacao(null) };
    }
  }, []);

  /** Depois de gravar: tudo que mostra estoque, custo ou cadastros recarrega. */
  const invalidarCaches = useCallback(() => {
    const prefixos = ["xml-compra-candidatos", "xml-compra-ja-importada", "xml-compra-limite-plano", "primeiros-passos"];
    return queryClient.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey[0];
        return typeof k === "string" && (prefixos.includes(k) || /produt|peca|peça|estoque/i.test(k));
      },
    });
  }, [queryClient]);

  return { enviarXml, gravar, invalidarCaches };
}
