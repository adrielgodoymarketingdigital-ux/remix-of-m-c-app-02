/**
 * Regra de qual loja um registro (venda ou OS) pertence na tela Multi Empresas.
 * Só leitura: nada aqui grava no banco.
 *
 * - Registro com empresa_id da matriz → matriz.
 * - Registro sem empresa_id (antigo ou lançado sem loja) → matriz, só na leitura.
 * - Registro com empresa_id de uma filial → só aquela filial.
 * - Cada registro conta em uma única loja; a matriz NÃO soma as filiais.
 */

export interface LojaLeitura {
  id: string;
  tipo: string;
}

/** Filtro de leitura de uma loja: a matriz também lê os registros sem loja. */
export interface FiltroLeituraLoja {
  empresaId: string;
  incluirSemLoja: boolean;
}

export function ehMatriz(loja: LojaLeitura): boolean {
  return loja.tipo === "matriz";
}

export function filtroLeituraLoja(loja: LojaLeitura): FiltroLeituraLoja {
  return { empresaId: loja.id, incluirSemLoja: ehMatriz(loja) };
}

/** true quando o registro com esse empresa_id deve contar nessa loja. */
export function registroDaLoja(empresaIdRegistro: string | null | undefined, loja: LojaLeitura): boolean {
  if (empresaIdRegistro === null || empresaIdRegistro === undefined || empresaIdRegistro === "") {
    return ehMatriz(loja);
  }
  return empresaIdRegistro === loja.id;
}

/** empresa_id de uma linha qualquer (linha sem o campo = sem loja). */
export function empresaIdDoRegistro(registro: unknown): string | null {
  if (typeof registro !== "object" || registro === null || !("empresa_id" in registro)) return null;
  const valor = (registro as { empresa_id?: unknown }).empresa_id;
  return typeof valor === "string" ? valor : null;
}

/** Mantém só os registros que contam nessa loja (defesa extra além do filtro da consulta). */
export function filtrarRegistrosDaLoja<T>(registros: T[], loja: LojaLeitura): T[] {
  return registros.filter((r) => registroDaLoja(empresaIdDoRegistro(r), loja));
}

/**
 * Agrupa registros por loja (id da loja → registros). Registro de loja que não
 * está na lista (ex.: filial desativada) fica de fora, como antes.
 */
export function agruparRegistrosPorLoja<T>(
  registros: T[],
  lojas: LojaLeitura[],
): Record<string, T[]> {
  const grupos: Record<string, T[]> = {};
  for (const loja of lojas) grupos[loja.id] = filtrarRegistrosDaLoja(registros, loja);
  return grupos;
}
