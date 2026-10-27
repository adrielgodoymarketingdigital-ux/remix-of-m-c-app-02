import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type comumPtBR from "@/locales/pt-BR/comum";
import type { Traducao } from "@/locales/tipos";

export type NomesFormaPagamento = Traducao<typeof comumPtBR.formaPagamento>;

/**
 * Nomes das formas de pagamento NA TELA, no idioma aplicado (tabela única em
 * comum.formaPagamento). Para o banco e o recibo use os nomes em pt-BR fixo de
 * lib/formaPagamento.ts.
 */
export function useNomesFormaPagamento(): NomesFormaPagamento {
  const { t } = useTranslation("comum");
  return useMemo(() => t("formaPagamento", { returnObjects: true }) as NomesFormaPagamento, [t]);
}
