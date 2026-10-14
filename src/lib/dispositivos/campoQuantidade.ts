/**
 * Campo "Quantidade" do cadastro de dispositivo (DialogCadastroDispositivo).
 *
 * O texto digitado fica separado do valor do formulário: o campo pode ficar vazio
 * enquanto a pessoa edita (antes, apagar mandava `undefined` ao react-hook-form,
 * que devolvia o valor padrão 1 — o "1" voltava e "2" virava "12").
 *
 * - Só dígitos inteiros.
 * - Aumentar a quantidade vale na hora (só acrescenta unidades em branco).
 * - Diminuir, vazio ou 0 só vale ao sair do campo / Enter: assim, digitando "25"
 *   a lista não passa por 2 e não descarta as unidades já preenchidas.
 * - Ao confirmar: vazio, 0 ou inválido viram o mínimo (1).
 * Sem dependências (testado com Deno em scripts/testes-campo-quantidade/).
 */

export const QUANTIDADE_MINIMA = 1;

/** Mantém só os dígitos ("2a,-5" → "25", " 4 un" → "4"). */
export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

/** Quantidade final ao sair do campo: inteiro >= mínimo (e <= máximo, se houver). */
export function normalizarQuantidade(texto: string, max?: number): number {
  const n = Number.parseInt(somenteDigitos(texto), 10);
  const valido = Number.isFinite(n) && n >= QUANTIDADE_MINIMA ? n : QUANTIDADE_MINIMA;
  return max !== undefined ? Math.min(valido, max) : valido;
}

/**
 * Valor a aplicar no formulário enquanto a pessoa digita, ou null para esperar a
 * confirmação: só quando o texto é um número válido MAIOR que a quantidade atual.
 */
export function quantidadeAoDigitar(texto: string, atual: number, max?: number): number | null {
  const digitos = somenteDigitos(texto);
  if (!digitos) return null;
  const n = Number.parseInt(digitos, 10);
  if (!Number.isFinite(n) || n < QUANTIDADE_MINIMA || n <= atual) return null;
  return max !== undefined ? Math.min(n, max) : n;
}
