import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useIdentidade } from "@/hooks/useResolvedUserId";
import { normalizarReciboVendaConfig, type ReciboVendaConfig } from "@/lib/vendas/reciboVendaConfig";
import {
  decidirPermissaoConfigRecibo,
  interpretarResultadoGravacao,
  mensagemErroGravacaoReciboVendaConfig,
  prepararGravacaoReciboVendaConfig,
  type PapelConfigRecibo,
} from "@/lib/vendas/reciboVendaConfigGravacao";

export type ResultadoSalvarReciboVendaConfig = { ok: true } | { ok: false; erro: string };

/**
 * Personalização do recibo de venda A4 da loja escolhida.
 *
 * Leitura: usa a linha que o useConfiguracaoLoja já carregou (nenhuma consulta
 * a mais). Coluna ausente ou NULL = padrão.
 *
 * Gravação (só o dono, ver decidirPermissaoConfigRecibo): UPDATE só da coluna
 * recibo_venda_config, só na linha carregada (pelo id), conferindo que voltou
 * exatamente 1 linha. Nunca cria linha nova e nunca escolhe a linha por user.id.
 *
 * @param empresaId mesma regra do useConfiguracaoLoja (null = matriz).
 */
export function useReciboVendaConfig(empresaId?: string | null) {
  const { toast } = useToast();
  const { config: linha, loading: carregandoConfig, refetch } = useConfiguracaoLoja(empresaId);
  const { isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const { isGerenteFilial, carregando: carregandoIdentidade } = useIdentidade();

  const papel: PapelConfigRecibo | null =
    carregandoPermissoes || carregandoIdentidade ? null : isGerenteFilial ? "gerente" : isFuncionario ? "funcionario" : "dono";

  const permissao = decidirPermissaoConfigRecibo({
    papel,
    carregando: carregandoConfig,
    empresaIdSelecionada: empresaId ?? null,
    linha,
  });

  const valorNoBanco = linha?.recibo_venda_config;
  const reciboConfig: ReciboVendaConfig = useMemo(() => normalizarReciboVendaConfig(valorNoBanco), [valorNoBanco]);

  const mutacao = useMutation({
    mutationFn: async (rascunho: unknown): Promise<ResultadoSalvarReciboVendaConfig> => {
      if (!permissao.podeEditar || !linha?.id) return { ok: false, erro: permissao.mensagem || "Sem permissão para alterar o recibo." };

      const preparo = prepararGravacaoReciboVendaConfig(rascunho);
      if (preparo.ok === false) return { ok: false, erro: preparo.erro };

      const { data, error } = await supabase
        .from("configuracoes_loja")
        .update({ recibo_venda_config: preparo.valor as unknown as Json | null })
        .eq("id", linha.id)
        .select("id");

      if (error) {
        console.error("Erro ao salvar recibo_venda_config:", error);
        return { ok: false, erro: mensagemErroGravacaoReciboVendaConfig(error) };
      }
      return interpretarResultadoGravacao(Array.isArray(data) ? data.length : null);
    },
    onSuccess: async (resultado) => {
      if (resultado.ok === false) {
        toast({ variant: "destructive", title: "Recibo não foi salvo", description: resultado.erro });
        return;
      }
      toast({ title: "Recibo salvo", description: "As próximas impressões e reimpressões já usam esta configuração." });
      await refetch();
    },
    onError: (error: Error) => {
      console.error("Erro ao salvar recibo_venda_config:", error);
      toast({ variant: "destructive", title: "Recibo não foi salvo", description: mensagemErroGravacaoReciboVendaConfig(null) });
    },
  });

  return {
    /** Config normalizada (sempre completa; padrão quando a coluna é NULL ou não existe). */
    reciboConfig,
    /** Linha de configuracoes_loja carregada (para a prévia: nome, logo, contatos). */
    configLoja: linha,
    carregando: carregandoConfig || papel === null,
    podeEditar: permissao.podeEditar,
    motivo: permissao.motivo,
    mensagemPermissao: permissao.mensagem,
    salvando: mutacao.isPending,
    /** Grava o rascunho (normalizado; igual ao padrão grava NULL). Mostra o aviso de sucesso ou de erro. */
    salvar: (rascunho: unknown) => mutacao.mutateAsync(rascunho),
  };
}
