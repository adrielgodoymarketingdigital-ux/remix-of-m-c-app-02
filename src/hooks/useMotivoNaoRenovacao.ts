import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AssinaturaParaModal,
  buildCicloVencimentoRef,
  deveConsiderarModalNaoRenovacao,
  MotivoNaoRenovacaoCategoria,
} from "@/lib/motivosNaoRenovacao";

interface UseMotivoNaoRenovacaoResult {
  aberto: boolean;
  salvando: boolean;
  /** Registra a resposta escolhida (categoria + texto opcional p/ "outro") e fecha. */
  registrarResposta: (
    categoria: MotivoNaoRenovacaoCategoria,
    texto?: string,
  ) => Promise<void>;
  /** Fecha sem responder. A linha já foi criada na exibição — não reaparece no ciclo. */
  descartar: () => void;
}

/**
 * Controla o modal "Por que você não renovou?".
 *
 * - Reaproveita a detecção de plano vencido do `useVerificacaoAcesso`
 *   (recebe `statusAcesso` e `assinatura` já carregados — não faz fetch de
 *   assinatura).
 * - Mostra UMA vez por ciclo de vencimento (chave `ciclo_vencimento_ref`).
 *   A linha em `motivos_nao_renovacao` é criada no momento da exibição
 *   (`modal_exibido_em`); a partir daí o modal não reaparece nesse ciclo,
 *   tenha o usuário respondido ou apenas fechado.
 * - Nunca bloqueia nada: é só estado de um <Dialog> comum.
 */
export function useMotivoNaoRenovacao(
  statusAcesso: string | null | undefined,
  assinatura: AssinaturaParaModal | null | undefined,
): UseMotivoNaoRenovacaoResult {
  const habilitado = deveConsiderarModalNaoRenovacao(statusAcesso, assinatura);

  const cicloRef = useMemo(
    () => (habilitado && assinatura ? buildCicloVencimentoRef(assinatura) : null),
    [habilitado, assinatura],
  );
  const userId = assinatura?.user_id ?? null;
  const lsKey = cicloRef ? `mec_motivo_nao_renov:${cicloRef}` : null;

  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const processadoRef = useRef(false);

  // Já foi mostrado/respondido neste ciclo? (RLS deixa o usuário ver só o dele)
  const { data: registroExistente, isLoading } = useQuery({
    queryKey: ["motivo-nao-renovacao", userId, cicloRef],
    enabled: !!cicloRef && !!userId,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motivos_nao_renovacao")
        .select("id, respondido_em, modal_exibido_em")
        .eq("user_id", userId as string)
        .eq("ciclo_vencimento_ref", cicloRef as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Decide exibir e marca a exibição (uma única vez por montagem/ciclo).
  useEffect(() => {
    if (!cicloRef || !userId || isLoading || processadoRef.current) return;

    // Curto-circuito local: evita re-perguntar antes do round-trip do insert
    // e cobre falhas de rede na escrita (prioridade: não ser chato).
    try {
      if (lsKey && localStorage.getItem(lsKey)) {
        processadoRef.current = true;
        return;
      }
    } catch {
      /* localStorage indisponível — segue no fluxo do banco */
    }

    // Já existe linha para este ciclo → não perguntar de novo.
    if (registroExistente) {
      processadoRef.current = true;
      return;
    }

    processadoRef.current = true;

    void (async () => {
      try {
        const { error } = await supabase
          .from("motivos_nao_renovacao")
          .upsert(
            {
              user_id: userId,
              assinatura_id: assinatura?.id ?? null,
              ciclo_vencimento_ref: cicloRef,
              modal_exibido_em: new Date().toISOString(),
              plano_tipo: assinatura?.plano_tipo ?? null,
              status_assinatura: assinatura?.status ?? null,
            },
            { onConflict: "user_id,ciclo_vencimento_ref", ignoreDuplicates: true },
          );
        if (error) throw error;
      } catch (e) {
        console.error("[useMotivoNaoRenovacao] falha ao registrar exibição do modal", e);
      }
      try {
        if (lsKey) localStorage.setItem(lsKey, "1");
      } catch {
        /* ignore */
      }
      setAberto(true);
    })();
  }, [cicloRef, userId, isLoading, registroExistente, lsKey, assinatura]);

  const registrarResposta = useCallback(
    async (categoria: MotivoNaoRenovacaoCategoria, texto?: string) => {
      if (!cicloRef || !userId) {
        setAberto(false);
        return;
      }
      setSalvando(true);
      try {
        const { error } = await supabase.from("motivos_nao_renovacao").upsert(
          {
            user_id: userId,
            assinatura_id: assinatura?.id ?? null,
            ciclo_vencimento_ref: cicloRef,
            plano_tipo: assinatura?.plano_tipo ?? null,
            status_assinatura: assinatura?.status ?? null,
            motivo_categoria: categoria,
            motivo_texto: texto && texto.trim() ? texto.trim() : null,
            respondido_em: new Date().toISOString(),
          },
          { onConflict: "user_id,ciclo_vencimento_ref" },
        );
        if (error) throw error;
      } catch (e) {
        console.error("[useMotivoNaoRenovacao] falha ao salvar resposta", e);
      } finally {
        setSalvando(false);
        setAberto(false);
      }
    },
    [cicloRef, userId, assinatura],
  );

  const descartar = useCallback(() => setAberto(false), []);

  return { aberto, salvando, registrarResposta, descartar };
}
