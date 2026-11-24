/**
 * Funções puras do <InputDecimal /> (src/components/ui/input-decimal.tsx).
 *
 * Por que existe: <input type="number"> controlado pelo React zera no
 * celular. O teclado do aparelho manda vírgula; um valor parcial como "39,"
 * chega como "" em e.target.value, o React regrava "" e o campo zera. Aqui o
 * campo é texto: guardamos o que a pessoa digitou e emitimos para o
 * formulário a mesma string com PONTO que o type="number" emitia ("39.5"),
 * então parseFloat/Number do código atual continuam iguais.
 *
 * Regras (não dependem do locale do aparelho):
 * - Só dígitos, "," e "." entram; letras, espaço, "R$", "-" etc. somem.
 *   (Não há número negativo: nenhum campo de valor do app aceita.)
 * - Digitando tecla a tecla: o PRIMEIRO separador ("," ou ".") é o decimal;
 *   qualquer separador seguinte é ignorado; casas além de `casasDecimais`
 *   são cortadas.
 * - Colando (ou autopreenchendo) vários caracteres de uma vez, o texto é
 *   lido como valor completo:
 *     "1.234,56" -> "1234,56"  (o último tipo de separador é o decimal,
 *     "1,234.56" -> "1234.56"   o outro tipo é milhar)
 *     "1.234.567" -> "1234567" (o mesmo separador repetido é milhar)
 *     "1.500"    -> "1500"     (ponto com exatamente 3 dígitos é milhar,
 *                               quando casasDecimais < 3)
 *     "R$ 39,50" -> "39,50"
 * - Consequência documentada: "1.234,56" DIGITADO tecla a tecla vira
 *   "1.23" (o "." vira o decimal, a "," é ignorada e a 3ª casa é cortada).
 *   A pessoa vê na hora que a vírgula não entrou. Só a colagem entende milhar.
 * - Vazio continua vazio ("" e não "0").
 */

export const CASAS_DECIMAIS_PADRAO = 2;

export interface OpcoesSanitizarDecimal {
  casasDecimais?: number;
  /** true quando o texto chegou de uma vez (colar/autopreencher). */
  colado?: boolean;
}

function normalizarCasas(casas: number | undefined): number {
  if (casas === undefined || !Number.isFinite(casas)) return CASAS_DECIMAIS_PADRAO;
  return Math.max(0, Math.trunc(casas));
}

function contar(s: string, c: string): number {
  let n = 0;
  for (const ch of s) if (ch === c) n++;
  return n;
}

/** Resolve separadores de milhar de um valor colado inteiro. */
function resolverSeparadoresColados(s: string, casas: number): string {
  const virgulas = contar(s, ",");
  const pontos = contar(s, ".");

  if (virgulas > 0 && pontos > 0) {
    const decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    return s.split(milhar).join("");
  }

  const sep = virgulas > 0 ? "," : pontos > 0 ? "." : "";
  if (!sep) return s;

  const quantidade = sep === "," ? virgulas : pontos;
  if (quantidade > 1) return s.split(sep).join("");

  if (sep === "." && casas < 3) {
    const depois = s.slice(s.indexOf(".") + 1);
    const antes = s.slice(0, s.indexOf("."));
    if (antes.length > 0 && /^\d{3}$/.test(depois)) return antes + depois;
  }
  return s;
}

/**
 * Limpa o texto do campo e devolve o que deve aparecer na tela (mantém a
 * vírgula ou o ponto que a pessoa usou).
 */
export function sanitizarTextoDecimal(
  texto: string,
  opcoes: OpcoesSanitizarDecimal = {},
): string {
  const casas = normalizarCasas(opcoes.casasDecimais);
  let s = (texto ?? "").replace(/[^\d.,]/g, "");
  if (opcoes.colado) s = resolverSeparadoresColados(s, casas);

  let resultado = "";
  let temSeparador = false;
  let decimais = 0;
  for (const c of s) {
    if (c === "," || c === ".") {
      if (temSeparador || casas === 0) continue;
      temSeparador = true;
      resultado += c;
      continue;
    }
    if (temSeparador) {
      if (decimais >= casas) continue;
      decimais++;
    }
    resultado += c;
  }
  return resultado;
}

/**
 * Texto da tela -> string com ponto, no formato que o type="number" emitia.
 * "39,50" -> "39.50"; "39," -> "39."; ",5" -> "0.5"; "" -> "".
 */
export function normalizarTextoDecimal(texto: string): string {
  if (!texto) return "";
  const s = texto.replace(",", ".");
  return s.startsWith(".") ? `0${s}` : s;
}

/** Texto (da tela ou normalizado) -> número; vazio ou inválido -> null. */
export function parseTextoDecimal(texto: string): number | null {
  const n = normalizarTextoDecimal(texto);
  if (n === "") return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

export type ValorExternoDecimal = number | string | null | undefined;

/** Valor que vem do formulário (number/string/null) -> texto da tela. */
export function textoDoValorExterno(
  valor: ValorExternoDecimal,
  casasDecimais: number = CASAS_DECIMAIS_PADRAO,
): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return "";
    return sanitizarTextoDecimal(String(valor), { casasDecimais });
  }
  return sanitizarTextoDecimal(String(valor), { casasDecimais });
}

function numeroDoValorExterno(valor: ValorExternoDecimal): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  return parseTextoDecimal(sanitizarTextoDecimal(String(valor), { casasDecimais: 20 }));
}

/**
 * O texto da tela já representa o valor externo? Se sim, o campo mantém o
 * texto (assim "39," não vira "39"). Vazio e 0 contam como iguais: muitos
 * formulários guardam `Number(v) || 0`, e sem isso a pessoa não conseguiria
 * apagar o campo para digitar outro valor.
 */
export function textoRepresentaValor(texto: string, valor: ValorExternoDecimal): boolean {
  const a = parseTextoDecimal(texto) ?? 0;
  const b = numeroDoValorExterno(valor) ?? 0;
  return a === b;
}

function numeroDoLimite(limite: number | string | undefined): number | null {
  if (limite === undefined || limite === "") return null;
  const n = typeof limite === "number" ? limite : Number(limite);
  return Number.isFinite(n) ? n : null;
}

/**
 * Mesma checagem de faixa que o type="number" fazia com min/max (bloqueia o
 * envio nativo do <form>). "" = válido.
 */
export function mensagemForaDaFaixa(
  texto: string,
  min?: number | string,
  max?: number | string,
): string {
  const v = parseTextoDecimal(texto);
  if (v === null) return "";
  const mn = numeroDoLimite(min);
  const mx = numeroDoLimite(max);
  if (mn !== null && v < mn) return `O valor deve ser maior ou igual a ${mn}.`;
  if (mx !== null && v > mx) return `O valor deve ser menor ou igual a ${mx}.`;
  return "";
}
