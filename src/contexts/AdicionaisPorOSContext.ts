import { createContext, useContext } from "react";
import type { AdicionaisPorOS, ResumoDispositivoAdicional } from "@/lib/ordemServico/dispositivosAdicionaisOS";

/**
 * Resumo dos dispositivos adicionais por OS para a lista, os kanbans e a
 * exportação (vem de useOrdensServico().adicionaisPorOs, uma consulta por loja).
 * Fora do provider, ou sem adicionais, nada aparece — a tela fica como antes.
 */
const AdicionaisPorOSContext = createContext<AdicionaisPorOS>({});

export const AdicionaisPorOSProvider = AdicionaisPorOSContext.Provider;

const SEM_ADICIONAIS: ResumoDispositivoAdicional[] = [];

export function useAdicionaisPorOS(): AdicionaisPorOS {
  return useContext(AdicionaisPorOSContext);
}

export function useAdicionaisDaOS(osId: string): ResumoDispositivoAdicional[] {
  return useContext(AdicionaisPorOSContext)[osId] ?? SEM_ADICIONAIS;
}
