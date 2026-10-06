/**
 * Pré-processamento do recorte da câmera antes do OCR de números (tela de
 * outro celular, etiqueta). Puro, sobre os bytes RGBA do canvas (testado com
 * Deno em scripts/testes-imei/).
 */

/** Largura-alvo do recorte enviado ao OCR: amplia recortes pequenos (até 3×), nunca reduz. */
export function escalaParaOcr(larguraRecorte: number, alvo = 1200): number {
  if (!(larguraRecorte > 0)) return 1;
  return Math.min(3, Math.max(1, alvo / larguraRecorte));
}

/**
 * Tons de cinza + aumento de contraste (estica do percentil 5 ao 95) e, se o
 * fundo for escuro (tela em modo escuro), inverte para texto escuro em fundo
 * claro, que é o que o Tesseract lê melhor. Altera `rgba` no lugar.
 */
export function preprocessarPixels(rgba: Uint8ClampedArray): { invertido: boolean } {
  const n = rgba.length / 4;
  if (n === 0) return { invertido: false };
  const cinza = new Uint8Array(n);
  const histograma = new Uint32Array(256);
  let soma = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const y = Math.round(0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]);
    cinza[i] = y;
    histograma[y]++;
    soma += y;
  }
  const percentil = (p: number) => {
    const alvo = n * p;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += histograma[v];
      if (acc >= alvo) return v;
    }
    return 255;
  };
  const baixo = percentil(0.05);
  const alto = percentil(0.95);
  const faixa = Math.max(1, alto - baixo);
  // Fundo é a maioria dos pixels: média baixa = fundo escuro.
  const invertido = soma / n < 110;
  for (let i = 0; i < n; i++) {
    let v = Math.round(((cinza[i] - baixo) * 255) / faixa);
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    if (invertido) v = 255 - v;
    const o = i * 4;
    rgba[o] = rgba[o + 1] = rgba[o + 2] = v;
    rgba[o + 3] = 255;
  }
  return { invertido };
}
