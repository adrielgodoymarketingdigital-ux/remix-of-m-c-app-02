import {
  adicionaisCorrespondemBusca,
  serieCorrespondeBusca,
  type AdicionaisPorOS,
  type ResumoDispositivoAdicional,
} from "./dispositivosAdicionaisOS.ts";

export { serieCorrespondeBusca };

/**
 * Busca do campo da lista de OS (useOrdensServico). Módulo puro, testado com
 * Deno em scripts/testes-os-multi/buscaListaOS.test.ts.
 *
 * Critérios: nome e CPF do cliente, IMEI, modelo, marca, número da OS, defeito,
 * número de série e os aparelhos adicionais (IMEI, modelo, marca, série).
 */

/** O mínimo da OS que a busca lê. */
export interface OSParaBusca {
  id: string;
  numero_os?: string | null;
  defeito_relatado?: string | null;
  dispositivo_imei?: string | null;
  dispositivo_modelo?: string | null;
  dispositivo_marca?: string | null;
  dispositivo_numero_serie?: string | null;
  cliente?: { nome?: string | null; cpf?: string | null } | null;
}

/** Uma OS bate com o termo (já aparado e em minúsculas, não vazio)? */
export function osCorrespondeBusca(
  o: OSParaBusca,
  termo: string,
  adicionais: readonly ResumoDispositivoAdicional[] | null | undefined,
): boolean {
  const nome = o.cliente?.nome?.toLowerCase() || "";
  const cpf = o.cliente?.cpf?.toLowerCase() || "";
  const imei = o.dispositivo_imei?.toLowerCase() || "";
  const modelo = o.dispositivo_modelo?.toLowerCase() || "";
  const marca = o.dispositivo_marca?.toLowerCase() || "";
  const numeroOs = o.numero_os?.toLowerCase() || "";
  const defeito = o.defeito_relatado?.toLowerCase() || "";

  return (
    nome.includes(termo) ||
    cpf.includes(termo) ||
    imei.includes(termo) ||
    modelo.includes(termo) ||
    marca.includes(termo) ||
    numeroOs.includes(termo) ||
    defeito.includes(termo) ||
    serieCorrespondeBusca(o.dispositivo_numero_serie, termo) ||
    adicionaisCorrespondemBusca(adicionais, termo)
  );
}

/**
 * Filtra a lista pelo texto digitado. Termo vazio (ou só espaços) devolve a
 * MESMA lista, sem copiar — como antes.
 */
export function filtrarOSPorBusca<T extends OSParaBusca>(
  ordens: T[],
  busca: string,
  adicionaisPorOs: AdicionaisPorOS,
): T[] {
  const termo = busca.trim().toLowerCase();
  if (!termo) return ordens;
  return ordens.filter((o) => osCorrespondeBusca(o, termo, adicionaisPorOs[o.id]));
}
