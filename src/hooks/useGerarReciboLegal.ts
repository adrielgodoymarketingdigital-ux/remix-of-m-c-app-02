// "Gerar novo recibo" nas telas: chama o orquestrador único com as REGRAS DO PONTO
// (validações iguais às da origin/main em cada tela), mostra os avisos (pt-BR/es) e
// guarda quais compras estão gerando (botão desabilitado, sem clique duplo).
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  avisosDoRecibo,
  BloqueioReciboLegal,
  gerarEBaixarReciboLegal,
  reciboComProblema,
  type ResultadoReciboLegal,
} from "@/lib/origem/gerarEBaixarReciboLegal";
import { dependenciasReciboLegal } from "@/lib/origem/dependenciasReciboLegal";
import { ErroReciboLegal } from "@/lib/origem/erroReciboLegal";
import type { FalhaRecibo, RegrasReciboLegal } from "@/lib/origem/regrasReciboLegal";

export interface OpcoesGerarRecibo {
  regras: RegrasReciboLegal;
  /**
   * Roda com o recibo já gravado (baixar/abrir o PDF) ANTES do aviso final: o
   * downloadPDFRobust chama toast.dismiss() sem id, que apagaria o resumo das fotos.
   * Falha aqui não desfaz nem esconde o recibo gerado.
   */
  depois?: (resultado: ResultadoReciboLegal) => unknown;
  /** Mostra o bloqueio do jeito da tela (as de Dispositivos e o diálogo usavam o toast do shadcn). */
  aoBloquear?: (falha: FalhaRecibo) => void;
}

/** Padrão (TabelaCompras usava sonner): título, descrição e o botão "Configurar" quando havia. */
export function mostrarBloqueioSonner(falha: FalhaRecibo) {
  toast.error(falha.titulo, {
    description: falha.descricao,
    action: falha.configurar ? { label: "Configurar", onClick: () => { window.location.href = "/configuracoes"; } } : undefined,
  });
}

export function useGerarReciboLegal() {
  const { t } = useTranslation("comum");
  const emCurso = useRef(new Set<string>());
  const [gerandoIds, setGerandoIds] = useState<ReadonlySet<string>>(() => new Set());

  const gerar = useCallback(
    async (compraId: string, { regras, depois, aoBloquear = mostrarBloqueioSonner }: OpcoesGerarRecibo): Promise<ResultadoReciboLegal | null> => {
      if (!compraId || emCurso.current.has(compraId)) return null;
      emCurso.current.add(compraId);
      setGerandoIds(new Set(emCurso.current));
      const idToast = `recibo-legal-${compraId}`;
      toast.loading(t("reciboLegal.gerando"), { id: idToast });
      try {
        const resultado = await gerarEBaixarReciboLegal(compraId, dependenciasReciboLegal(), regras);
        try {
          await depois?.(resultado);
        } catch (erroDepois) {
          console.error("[recibo legal] recibo gerado, falha ao baixar/abrir", { compraId, erroDepois });
        }
        const descricao = avisosDoRecibo(resultado).map((a) => t(a.chave, a.valores)).join(" · ");
        const mostrar = reciboComProblema(resultado) ? toast.warning : toast.success;
        mostrar(t("reciboLegal.gerado"), { id: idToast, description: descricao || undefined, duration: reciboComProblema(resultado) ? 10000 : 5000 });
        return resultado;
      } catch (erro) {
        console.error("[recibo legal] erro ao gerar", { compraId, ponto: regras.ponto, erro });
        toast.dismiss(idToast);
        if (erro instanceof BloqueioReciboLegal) {
          aoBloquear(erro.falha);
        } else if (erro instanceof ErroReciboLegal && erro.codigo === "termo_nao_atualizado") {
          aoBloquear(regras.falhaInesperada(t("reciboLegal.erros.termo_nao_atualizado")));
        } else {
          aoBloquear(regras.falhaInesperada(erro instanceof Error ? erro.message : undefined));
        }
        return null;
      } finally {
        emCurso.current.delete(compraId);
        setGerandoIds(new Set(emCurso.current));
      }
    },
    [t],
  );

  const gerando = useCallback((compraId: string | null | undefined) => !!compraId && gerandoIds.has(compraId), [gerandoIds]);

  return { gerar, gerando, t };
}
