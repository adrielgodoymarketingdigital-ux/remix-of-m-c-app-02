/**
 * Regras regionais que os formatadores precisam ANTES de o banco informar
 * (docs/i18n/pais-moeda.md, P1). A fonte de verdade é o banco
 * (moedas_suportadas e paises_suportados, P2); quando get_regiao_loja() existir
 * (P4), casas e símbolo chegam pelo ContextoFormato e estas tabelas viram só a
 * reserva. Os valores têm de ser os mesmos do seed da P2.
 *
 * Sem React e sem navegador (testado com Deno em scripts/testes-i18n/).
 */

/** "Otro país": ISO 3166-1 reservado para "desconhecido". Formata como es-419. */
export const PAIS_OUTRO = "ZZ";

/**
 * Casas decimais da moeda (decisão do dono). COP sai sem centavos mesmo com a
 * ISO dizendo 2; não depender do padrão do Intl, que muda entre navegadores.
 * BRL fica de fora de propósito: o Brasil segue o Intl como sempre.
 */
export const CASAS_DECIMAIS_MOEDA: Readonly<Record<string, number>> = {
  COP: 0,
  CLP: 0,
  PYG: 0,
  CRC: 2,
  BOB: 2,
  MXN: 2,
  USD: 2,
};

/** Países em que o dólar é a moeda local: a loja mostra "$", não "US$". */
export const PAISES_DOLARIZADOS: ReadonlySet<string> = new Set(["EC", "PA", "SV"]);

/** Fuso de cada país quando o da conta falta ou é inválido (tabela 1.1 do documento). */
export const FUSO_PADRAO_PAIS: Readonly<Record<string, string>> = {
  BR: "America/Sao_Paulo",
  MX: "America/Mexico_City",
  CO: "America/Bogota",
  CL: "America/Santiago",
  BO: "America/La_Paz",
  AR: "America/Argentina/Buenos_Aires",
  PE: "America/Lima",
  UY: "America/Montevideo",
  EC: "America/Guayaquil",
  CR: "America/Costa_Rica",
  PA: "America/Panama",
  GT: "America/Guatemala",
  DO: "America/Santo_Domingo",
  SV: "America/El_Salvador",
  HN: "America/Tegucigalpa",
  PY: "America/Asuncion",
  [PAIS_OUTRO]: "UTC",
};

/** Fuso padrão do país; país desconhecido ou "Otro país" = UTC. */
export function fusoPadraoDoPais(pais: string | null | undefined): string {
  return (pais && FUSO_PADRAO_PAIS[pais]) || "UTC";
}

const fusosConferidos = new Map<string, boolean>();

/** O runtime conhece este fuso IANA? (iPhone antigo pode não conhecer America/Coyhaique.) */
export function ehFusoValido(fuso: string | null | undefined): fuso is string {
  if (!fuso) return false;
  let ok = fusosConferidos.get(fuso);
  if (ok === undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: fuso });
      ok = true;
    } catch {
      ok = false;
    }
    fusosConferidos.set(fuso, ok);
  }
  return ok;
}
