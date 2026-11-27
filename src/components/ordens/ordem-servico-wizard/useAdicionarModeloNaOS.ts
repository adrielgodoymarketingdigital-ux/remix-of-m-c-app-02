import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { useCatalogoDispositivosCustom } from "@/hooks/useCatalogoDispositivosCustom";
import {
  NOVO_MODELO_MAX,
  NOVO_MODELO_MIN,
  podeAdicionarModelo,
  validarNovoModelo,
} from "@/lib/ordemServico/novoModeloCatalogo";

type CriarCatalogo = ReturnType<typeof useCatalogoDispositivosCustom>["criar"];

interface ContextoModelo {
  tipo: string;
  marca: string;
  /** Marcas da lista do tipo (fixas + da loja). */
  marcas: readonly string[];
  /** Modelos já existentes deste tipo + marca (fixos + da loja). */
  modelosExistentes: readonly string[];
}

/**
 * Props do "Adicionar novo modelo" para o ComboboxComTextoLivre do Modelo.
 * `criar` tem de ser da MESMA instância de useCatalogoDispositivosCustom que
 * alimenta a lista: é ela que recarrega e mostra o modelo novo na hora.
 */
export function useAdicionarModeloNaOS(criar: CriarCatalogo) {
  const { t } = useTranslation("servicos");

  return ({ tipo, marca, marcas, modelosExistentes }: ContextoModelo) => {
    if (!podeAdicionarModelo(tipo, marca, marcas)) {
      return { dicaAdicionarIndisponivel: t("novoModeloOS.escolhaMarcaPrimeiro") };
    }
    const onAdicionarNovo = async (nomeDigitado: string): Promise<string | null> => {
      const r = validarNovoModelo(nomeDigitado, modelosExistentes);
      if (r.ok === false) {
        if (r.motivo === "duplicado" && r.existente) {
          toast.info(t("novoModeloOS.duplicado"));
          return r.existente;
        }
        if (r.motivo === "curto") toast.error(t("novoModeloOS.curto", { min: NOVO_MODELO_MIN }));
        else if (r.motivo === "longo") toast.error(t("novoModeloOS.longo", { max: NOVO_MODELO_MAX }));
        else toast.error(t("novoModeloOS.vazio"));
        return null;
      }
      try {
        // Em falha (rede/RLS) o hook já mostra o toast de erro e devolve null.
        const criado = await criar("modelo", r.nome, { tipoValor: tipo, marcaNome: marca });
        return criado ? criado.nome : null;
      } catch (error) {
        // Só quando o hook lança antes de tentar (sem usuário identificado).
        console.error("Erro ao adicionar modelo ao catálogo:", error);
        toast.error(t("novoModeloOS.erroSalvar"));
        return null;
      }
    };
    return { onAdicionarNovo, rotuloAdicionar: t("novoModeloOS.adicionar") };
  };
}
