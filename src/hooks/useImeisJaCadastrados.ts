import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { validarImei } from "@/lib/codigos/imei";
import { useResolvedUserId } from "./useResolvedUserId";

/**
 * IMEIs (válidos) que já existem em OUTRO dispositivo da mesma loja — só para
 * um aviso não bloqueante no cadastro (o mesmo aparelho pode voltar para a loja).
 *
 * Uma consulta por mudança (com espera de 400 ms), filtrada pelo user_id do dono
 * (índice idx_dispositivos_user_id) e pelos IMEIs informados: não varre a tabela.
 * Compara o texto exato gravado em imei/imei2 dos dispositivos não excluídos.
 */
export function useImeisJaCadastrados(imeis: (string | null | undefined)[], idAtual?: string | null): Set<string> {
  const donoId = useResolvedUserId();
  const chave = [...new Set(imeis.map((i) => (i ?? "").replace(/\D/g, "")).filter(validarImei))].sort().join(",");
  const [repetidos, setRepetidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!donoId || !chave) {
      setRepetidos((atual) => (atual.size ? new Set() : atual));
      return;
    }
    let cancelado = false;
    const timer = setTimeout(async () => {
      const lista = chave.split(",");
      let consulta = supabase
        .from("dispositivos")
        .select("id, imei, imei2")
        .eq("user_id", donoId)
        .is("deleted_at", null)
        .or(`imei.in.(${chave}),imei2.in.(${chave})`)
        .limit(50);
      if (idAtual) consulta = consulta.neq("id", idAtual);
      const { data, error } = await consulta;
      if (cancelado) return;
      if (error) {
        console.error("[imei] checagem de IMEI já cadastrado", { codigo: error.code, mensagem: error.message });
        return;
      }
      const achados = new Set<string>();
      for (const d of data ?? []) {
        for (const x of [d.imei, d.imei2]) if (x && lista.includes(x)) achados.add(x);
      }
      setRepetidos(achados);
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [donoId, chave, idAtual]);

  return repetidos;
}
