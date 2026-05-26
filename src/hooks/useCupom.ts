import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CupomStatus = "idle" | "loading" | "valid" | "invalid" | "error";

export interface CupomDesconto {
  cupomId: string;
  codigo: string;
  tipo: "flat" | "percent";
  valor: number;
  descricao: string;
}

export function useCupom() {
  const [codigo, setCodigo] = useState("");
  const [status, setStatus] = useState<CupomStatus>("idle");
  const [desconto, setDesconto] = useState<CupomDesconto | null>(null);
  const [mensagemErro, setMensagemErro] = useState("");

  const validar = useCallback(async () => {
    const codigoTrimado = codigo.trim();
    if (!codigoTrimado) return;

    setStatus("loading");
    setMensagemErro("");
    setDesconto(null);

    try {
      const { data, error } = await supabase.functions.invoke("validar-cupom", {
        body: { codigo: codigoTrimado },
      });

      if (error) {
        setStatus("error");
        setMensagemErro("Erro ao verificar cupom. Tente novamente.");
        return;
      }

      if (data?.valido) {
        setDesconto({
          cupomId: data.cupomId,
          codigo: data.codigo,
          tipo: data.tipo,
          valor: data.valor,
          descricao: data.descricao,
        });
        setStatus("valid");
      } else {
        setStatus("invalid");
        setMensagemErro(data?.mensagem ?? "Cupom inválido ou expirado.");
      }
    } catch {
      setStatus("error");
      setMensagemErro("Erro ao verificar cupom. Tente novamente.");
    }
  }, [codigo]);

  const limpar = useCallback(() => {
    setCodigo("");
    setStatus("idle");
    setDesconto(null);
    setMensagemErro("");
  }, []);

  /**
   * Aplica o desconto sobre um valor em centavos.
   * Nunca retorna valor negativo.
   */
  const calcularPrecoFinal = useCallback(
    (centavos: number): number => {
      if (!desconto) return centavos;

      let final: number;
      if (desconto.tipo === "percent") {
        final = Math.round(centavos * (1 - desconto.valor / 100));
      } else {
        final = centavos - desconto.valor;
      }

      return Math.max(0, final);
    },
    [desconto]
  );

  return {
    codigo,
    setCodigo,
    status,
    desconto,
    mensagemErro,
    validar,
    limpar,
    calcularPrecoFinal,
  };
}
