/**
 * MD5 (hex) do texto em UTF-8 — o MESMO valor da coluna gerada
 * garantias_textos_venda.texto_md5 (md5(texto) no Postgres). Usado só para
 * achar um texto congelado que já existe sem mandar o texto inteiro na URL.
 * Não é segurança: é só a chave do índice único (user_id, texto_md5).
 * O WebCrypto não tem MD5; implementação clássica (RFC 1321).
 */
const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

export function md5Hex(texto: string): string {
  const dados = new TextEncoder().encode(texto);
  const bits = dados.length * 8;
  const tamanho = (((dados.length + 8) >>> 6) + 1) * 64;
  const buf = new Uint8Array(tamanho);
  buf.set(dados);
  buf[dados.length] = 0x80;
  const vista = new DataView(buf.buffer);
  vista.setUint32(tamanho - 8, bits >>> 0, true);
  vista.setUint32(tamanho - 4, Math.floor(bits / 2 ** 32), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let bloco = 0; bloco < tamanho; bloco += 64) {
    for (let i = 0; i < 16; i++) M[i] = vista.getUint32(bloco + i * 4, true);
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const tmp = d;
      d = c;
      c = b;
      const soma = (a + f + K[i] + M[g]) >>> 0;
      b = (b + ((soma << S[i]) | (soma >>> (32 - S[i])))) >>> 0;
      a = tmp;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  const saida = new DataView(new ArrayBuffer(16));
  [a0, b0, c0, d0].forEach((v, i) => saida.setUint32(i * 4, v, true));
  return Array.from(new Uint8Array(saida.buffer), (x) => x.toString(16).padStart(2, "0")).join("");
}
