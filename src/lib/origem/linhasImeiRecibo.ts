/**
 * Linhas de IMEI da seção "3. DESCRIÇÃO DO DISPOSITIVO" do recibo legal de compra
 * (gerarReciboLegalPDF). Função pura, sem jsPDF (testada com Deno em
 * scripts/testes-recibo-legal/linhasImeiRecibo.test.ts).
 *
 * - IMEI 1: mesma regra de antes (sai se tiver qualquer texto, sem aparar), para
 *   a compra sem IMEI 2 gerar exatamente o mesmo PDF.
 * - IMEI 2: sai só com conteúdo depois de aparar (vazio ou só espaços = nenhuma
 *   linha), e sai aparado.
 * - IMEI 2 igual ao IMEI 1 sai também: o recibo mostra o que está no cadastro do
 *   aparelho (esconder mascararia um erro de digitação).
 * - IMEI 2 sem IMEI 1 sai como "IMEI 2", fiel ao cadastro.
 */
export const ROTULO_IMEI = "IMEI";
export const ROTULO_IMEI2 = "IMEI 2";

export function linhasImeiRecibo(imei?: string | null, imei2?: string | null): string[] {
  const linhas: string[] = [];
  if (imei) linhas.push(`${ROTULO_IMEI}: ${imei}`);
  const segundo = (imei2 ?? "").trim();
  if (segundo) linhas.push(`${ROTULO_IMEI2}: ${segundo}`);
  return linhas;
}

/**
 * Quebra cada linha só quando ela não cabe na largura (assim a linha que cabe sai
 * com o mesmo texto de sempre, sem passar pelo splitTextToSize).
 */
export function quebrarLinhasQueNaoCabem(
  linhas: readonly string[],
  largura: number,
  medir: (texto: string) => number,
  quebrar: (texto: string, largura: number) => string[],
): string[] {
  return linhas.flatMap((linha) => (medir(linha) > largura ? quebrar(linha, largura) : [linha]));
}
