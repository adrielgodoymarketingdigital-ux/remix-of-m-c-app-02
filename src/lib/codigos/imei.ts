/**
 * IMEI e número de série lidos por código de barras ou OCR (leitor dos campos
 * do cadastro de dispositivo). Sem dependências (testado com Deno em
 * scripts/testes-imei/). Só números sintéticos nos testes.
 */

/** Dígito verificador Luhn (o 15º dígito do IMEI é o Luhn dos 14 primeiros). */
function luhnValido(digitos: string): boolean {
  let soma = 0;
  for (let i = 0; i < digitos.length; i++) {
    let d = digitos.charCodeAt(digitos.length - 1 - i) - 48;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    soma += d;
  }
  return soma % 10 === 0;
}

/** Exatamente 15 dígitos (ignora espaços, hífens e barras) com Luhn válido. */
export function validarImei(texto: string | null | undefined): boolean {
  const d = (texto ?? "").replace(/[\s\-/]/g, "");
  return /^\d{15}$/.test(d) && luhnValido(d);
}

/** Separadores aceitos entre grupos de dígitos de um mesmo IMEI. */
const SEPARADOR = /^[ \t\r\n\-/]+$/;

/**
 * Todos os IMEIs válidos de um texto qualquer (QR com IMEI1 e IMEI2, tela
 * *#06#, OCR), sem repetidos e na ordem em que aparecem.
 *
 * - Prefixos "IMEI", "IMEI1:", "IMEI 2" etc. são removidos (viram quebra).
 * - Grupos de dígitos separados por espaço, hífen, barra ou quebra de linha
 *   podem formar um IMEI ("35 123456 789012 3").
 * - Um bloco contínuo de dígitos só vale se tiver exatamente 15 dígitos ou se
 *   for parte de um IMEI agrupado: 14 ou 16 dígitos soltos, ou 15 dígitos
 *   dentro de um número maior, não contam.
 */
export function extrairImeis(texto: string | null | undefined): string[] {
  const limpo = (texto ?? "").replace(/IMEI\s*[12]?\s*[:#.-]?/gi, "\n");
  const resultado: string[] = [];
  // Divide em "trechos" de dígitos+separadores; qualquer outro caractere encerra o trecho.
  const trechos = limpo.split(/[^\d \t\r\n\-/]+/);
  for (const trecho of trechos) {
    const grupos: string[] = [];
    for (const parte of trecho.split(/(\d+)/)) {
      if (/^\d+$/.test(parte)) grupos.push(parte);
      else if (parte && !SEPARADOR.test(parte)) grupos.push("|");
    }
    let i = 0;
    while (i < grupos.length) {
      let acumulado = "";
      let j = i;
      let achou = false;
      while (j < grupos.length && grupos[j] !== "|" && acumulado.length + grupos[j].length <= 15) {
        acumulado += grupos[j];
        j++;
        if (acumulado.length === 15) {
          if (luhnValido(acumulado)) {
            if (!resultado.includes(acumulado)) resultado.push(acumulado);
            achou = true;
          }
          break;
        }
      }
      i = achou ? j : i + 1;
    }
  }
  return resultado;
}

/** Dígito verificador do EAN-13 (código de barras da caixa). */
function ean13Valido(d: string): boolean {
  if (!/^\d{13}$/.test(d)) return false;
  const soma = d.slice(0, 12).split("").reduce((acc, c, i) => acc + Number(c) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (soma % 10)) % 10 === Number(d[12]);
}

/**
 * Número de série normalizado (maiúsculas, sem espaço/hífen/barra) ou null.
 * Aceita letras e números com 5 a 20 caracteres. Recusa um número de 15
 * dígitos com Luhn válido (provável IMEI) e um EAN-13 válido (código da caixa).
 */
export function serieValida(texto: string | null | undefined): string | null {
  const s = (texto ?? "").toUpperCase().replace(/[\s\-/]/g, "");
  if (!/^[A-Z0-9]{5,20}$/.test(s)) return null;
  if (/^\d{15}$/.test(s) && luhnValido(s)) return null;
  if (ean13Valido(s)) return null;
  return s;
}

/**
 * Candidatos a número de série num texto de OCR: palavras que passam em
 * serieValida e têm pelo menos um dígito (evita pegar "SERIE", "NUMERO", "MODELO").
 */
export function extrairSeries(texto: string | null | undefined): string[] {
  const resultado: string[] = [];
  for (const palavra of (texto ?? "").split(/[\s:;,]+/)) {
    const s = serieValida(palavra);
    if (s && /\d/.test(s) && !resultado.includes(s)) resultado.push(s);
  }
  return resultado;
}

/**
 * Confirmação de leitura por OCR: só valem os candidatos que apareceram no
 * quadro anterior E no atual (mesmo valor em 2 quadros seguidos), na ordem do atual.
 */
export function confirmarEntreQuadros(anteriores: readonly string[], atuais: readonly string[]): string[] {
  return atuais.filter((c, i) => anteriores.includes(c) && atuais.indexOf(c) === i);
}
