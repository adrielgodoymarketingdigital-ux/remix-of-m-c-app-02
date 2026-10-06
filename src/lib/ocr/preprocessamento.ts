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

/** Limiar de Otsu: separa as duas "populações" do histograma (fundo e texto). */
export function limiarOtsu(histograma: ArrayLike<number>, total: number): number {
  let somaTotal = 0;
  for (let v = 0; v < 256; v++) somaTotal += v * histograma[v];
  let somaFundo = 0;
  let pesoFundo = 0;
  let melhor = 0;
  let limiar = 127;
  for (let v = 0; v < 256; v++) {
    pesoFundo += histograma[v];
    if (pesoFundo === 0) continue;
    const pesoFrente = total - pesoFundo;
    if (pesoFrente === 0) break;
    somaFundo += v * histograma[v];
    const mediaFundo = somaFundo / pesoFundo;
    const mediaFrente = (somaTotal - somaFundo) / pesoFrente;
    const variancia = pesoFundo * pesoFrente * (mediaFundo - mediaFrente) ** 2;
    if (variancia > melhor) {
      melhor = variancia;
      limiar = v;
    }
  }
  return limiar;
}

/**
 * Tons de cinza → suavização 3×3 (tira o ruído do sensor) → binarização por
 * Otsu (texto preto, fundo branco). Se a maior parte dos pixels ficar abaixo
 * do limiar, o fundo é escuro (tela em modo escuro) e a imagem é invertida —
 * o Tesseract lê melhor texto escuro em fundo claro. Altera `rgba` no lugar.
 *
 * (Esticar o contraste por percentis amplificava o ruído do fundo, que é >95%
 * dos pixels, e o OCR passava a "ler" o ruído como letras.)
 */
export function preprocessarPixels(rgba: Uint8ClampedArray, largura: number, altura: number): { invertido: boolean; limiar: number } {
  const n = largura * altura;
  if (n === 0 || rgba.length < n * 4) return { invertido: false, limiar: 0 };
  const cinza = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    cinza[i] = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  }
  const suave = new Uint8Array(n);
  const histograma = new Uint32Array(256);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      let soma = 0;
      let cont = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= altura) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= largura) continue;
          soma += cinza[yy * largura + xx];
          cont++;
        }
      }
      const v = Math.round(soma / cont);
      suave[y * largura + x] = v;
      histograma[v]++;
    }
  }
  const limiar = limiarOtsu(histograma, n);
  let abaixo = 0;
  for (let v = 0; v <= limiar; v++) abaixo += histograma[v];
  const invertido = abaixo > n / 2;
  for (let i = 0; i < n; i++) {
    const escuro = suave[i] <= limiar;
    // texto (minoria) sempre preto; fundo (maioria) sempre branco
    const v = escuro !== invertido ? 0 : 255;
    const o = i * 4;
    rgba[o] = rgba[o + 1] = rgba[o + 2] = v;
    rgba[o + 3] = 255;
  }
  return { invertido, limiar };
}
