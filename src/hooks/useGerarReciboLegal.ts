// "Gerar novo recibo" nas telas: chama o orquestrador único, mostra os avisos
// (pt-BR/es) e guarda quais compras estão gerando (botão desabilitado, sem clique duplo).
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  avisosDoRecibo,
  gerarEBaixarReciboLegal,
  reciboComProblema,
  type ResultadoReciboLegal,
} from "@/lib/origem/gerarEBaixarReciboLegal";
import { dependenciasReciboLegal } from "@/lib/origem/dependenciasReciboLegal";
import { ErroReciboLegal } from "@/lib/origem/erroReciboLegal";

export function useGerarReciboLegal() {
  const { t } = useTranslation("comum");
  const emCurso = useRef(new Set<string>());
  const [gerandoIds, setGerandoIds] = useState<ReadonlySet<string>>(() => new Set());

  /**
   * `depois` roda com o recibo já gravado (baixar/abrir o PDF) ANTES do aviso final:
   * o downloadPDFRobust chama toast.dismiss() sem id, que apagaria o resumo das fotos.
   * Falha em `depois` não desfaz nem esconde o recibo gerado.
   */
  const gerar = useCallback(
    async (compraId: string, depois?: (resultado: ResultadoReciboLegal) => unknown): Promise<ResultadoReciboLegal | null> => {
      if (!compraId || emCurso.current.has(compraId)) return null;
      emCurso.current.add(compraId);
      setGerandoIds(new Set(emCurso.current));
      const idToast = `recibo-legal-${compraId}`;
      toast.loading(t("reciboLegal.gerando"), { id: idToast });
      try {
        const resultado = await gerarEBaixarReciboLegal(compraId, dependenciasReciboLegal());
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
        console.error("[recibo legal] erro ao gerar", { compraId, erro });
        if (erro instanceof ErroReciboLegal) {
          const descricao = t(`reciboLegal.erros.${erro.codigo}`, { campos: erro.campos.join(", ") });
          toast.error(t("reciboLegal.erro"), {
            id: idToast,
            description: descricao,
            duration: 10000,
            action: erro.codigo === "loja_incompleta"
              ? { label: t("reciboLegal.configurar"), onClick: () => { window.location.href = "/configuracoes"; } }
              : undefined,
          });
        } else {
          toast.error(t("reciboLegal.erro"), { id: idToast, description: erro instanceof Error ? erro.message : undefined, duration: 10000 });
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
