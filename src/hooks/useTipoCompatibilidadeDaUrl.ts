import { useSearchParams } from "react-router-dom";
import { TipoCompatibilidade, lerTipoCompatibilidade } from "@/lib/compatibilidade/compatibilidade";

/** Aba Películas | Vidros guardada na URL (?tipo=vidro; sem parâmetro = película). */
export function useTipoCompatibilidadeDaUrl(): [TipoCompatibilidade, (tipo: TipoCompatibilidade) => void] {
  const [params, setParams] = useSearchParams();
  const tipo = lerTipoCompatibilidade(params.get("tipo"));
  const trocar = (novo: TipoCompatibilidade) => {
    const proximos = new URLSearchParams(params);
    if (novo === "vidro") proximos.set("tipo", "vidro");
    else proximos.delete("tipo");
    setParams(proximos, { replace: true });
  };
  return [tipo, trocar];
}
