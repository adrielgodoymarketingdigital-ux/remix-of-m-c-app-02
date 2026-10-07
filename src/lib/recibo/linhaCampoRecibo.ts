/**
 * Linhas de campo dos recibos ("Nome: Fulano", "Produto: Apple iPhone 14"),
 * classe .recibo-info: <div class="recibo-info"><span>Rótulo:</span><span>valor</span></div>.
 *
 * Térmico (58/80mm): rótulo à esquerda e valor encostado na direita — a
 * largura do papel é pequena e fica legível (igual a antes).
 * A4: valor logo depois do rótulo, na mesma linha. Antes o valor ia para a
 * ponta direita da folha (justify-content: space-between) e ficava a ~17cm
 * do rótulo. O rótulo tem largura automática; valor comprido quebra linha
 * dentro do espaço dele, sem invadir o rótulo.
 * Sem React nem navegador: testado com Deno em scripts/testes-recibo-cabecalho/.
 */

/** Espaço entre o rótulo e o valor no A4. */
export const ESPACO_ROTULO_VALOR_A4_PX = 4;

export function cssLinhaCampoRecibo(termico: boolean): string {
  if (termico) {
    return `
    .recibo-info {
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
      margin: 1mm 0;
    }`;
  }
  return `
    .recibo-info {
      display: flex;
      justify-content: flex-start;
      align-items: baseline;
      gap: ${ESPACO_ROTULO_VALOR_A4_PX}px;
      font-size: 12px;
      margin: 1mm 0;
    }
    .recibo-info > span:first-child { flex: 0 0 auto; white-space: nowrap; }
    .recibo-info > span:last-child { flex: 0 1 auto; min-width: 0; overflow-wrap: anywhere; text-align: left; }`;
}
