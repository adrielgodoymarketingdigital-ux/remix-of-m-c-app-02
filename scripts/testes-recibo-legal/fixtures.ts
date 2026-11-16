// Bytes mínimos de cada formato, gerados aqui (sem arquivos binários no git).
import { deflateSync } from "node:zlib";

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(tipo: string, dados: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + dados.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, dados.length);
  out.set(new TextEncoder().encode(tipo), 4);
  out.set(dados, 8);
  dv.setUint32(8 + dados.length, crc32(out.subarray(4, 8 + dados.length)));
  return out;
}
/** PNG RGB válido w×h, cor sólida. */
export function png(w: number, h: number, cor: [number, number, number] = [200, 30, 30]): Uint8Array {
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(cor, y * (w * 3 + 1) + 1 + x * 3);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const partes = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(deflateSync(raw))),
    chunk("IEND", new Uint8Array()),
  ];
  const total = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}
export const pngDataUrl = (w: number, h: number, cor?: [number, number, number]) =>
  "data:image/png;base64," + btoa(String.fromCharCode(...png(w, h, cor)));

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
export const WEBP = new Uint8Array([...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WEBPVP8 "), 0, 0, 0, 0]);
export const HEIC = new Uint8Array([0, 0, 0, 0x18, ...ascii("ftypheic"), 0, 0, 0, 0, ...ascii("mif1heic")]);
export const HEIF_MIF1 = new Uint8Array([0, 0, 0, 0x18, ...ascii("ftypmif1"), 0, 0, 0, 0]);
export const PDF = new Uint8Array(ascii("%PDF-1.7\n%âãÏÓ\n"));
export const GIF = new Uint8Array(ascii("GIF89a\x01\x00\x01\x00"));
export const TEXTO = new Uint8Array(ascii("<html><body>404</body></html>"));
