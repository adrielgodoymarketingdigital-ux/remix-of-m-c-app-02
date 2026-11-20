/**
 * Posição das marcações de avaria no desenho do aparelho.
 *
 * A tela de marcação (MarcacaoAvarias) grava cada ponto em % de uma caixa 9:16,
 * com o desenho centralizado nela (SVG em `absolute inset-0`, proporção mantida).
 * Os desenhos da OS impressa e da tela de visualização (SilhuetaComAvarias)
 * têm a proporção do próprio aparelho (tablet 4:3, notebook 10:7…). Aqui o ponto
 * gravado vira posição no desenho, para cair exatamente onde foi marcado.
 * Nada do que está gravado muda: a conversão é feita só na hora de desenhar.
 */

/** viewBox (largura, altura) de cada desenho em components/ordens/silhuetas. */
export const VIEWBOX_DESENHO: Record<string, [number, number]> = {
  celular: [180, 320],
  tablet: [320, 240],
  notebook: [400, 280],
  computador: [200, 300],
  desktop: [180, 300],
  relogio_smart: [200, 280],
  impressora: [260, 220],
  video_game: [300, 180],
  televisao: [320, 220],
  estabilizador: [260, 180],
  nobreak: [260, 190],
  projetor: [280, 180],
};

/** Proporção da caixa da tela de marcação (aspect-[9/16]). */
const CAIXA_MARCACAO = { largura: 9, altura: 16 };

/**
 * Tipo do desenho a partir de ordens_servico.dispositivo_tipo, normalizado como na
 * tela de marcação ("Relogio_Smart" → "relogio_smart", "Video Game" → "video_game").
 * Nomes antigos (smartphone, relogio, smartwatch) continuam valendo; tipo
 * desconhecido usa o desenho de celular, como sempre.
 */
export function tipoDoDesenho(tipoDispositivo: string | null | undefined): string {
  const t = (tipoDispositivo || "").toLowerCase().replace(/ /g, "_");
  if (t === "smartphone") return "celular";
  if (t === "relogio" || t === "smartwatch") return "relogio_smart";
  return VIEWBOX_DESENHO[t] ? t : "celular";
}

/**
 * Ponto gravado (x, y em % da caixa 9:16 da marcação) → fração (0 a 1) da
 * largura e da altura do desenho com esse viewBox.
 */
export function pontoNoDesenho(x: number, y: number, viewBox: [number, number]): { fx: number; fy: number } {
  const [largura, altura] = viewBox;
  const { largura: cl, altura: ca } = CAIXA_MARCACAO;
  const escala = Math.min(cl / largura, ca / altura);
  const sobraX = (cl - largura * escala) / 2;
  const sobraY = (ca - altura * escala) / 2;
  return {
    fx: ((x / 100) * cl - sobraX) / (largura * escala),
    fy: ((y / 100) * ca - sobraY) / (altura * escala),
  };
}
